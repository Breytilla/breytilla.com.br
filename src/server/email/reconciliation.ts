import { randomUUID } from "node:crypto";

import { getDatabase } from "./database";
import { processPendingMarketingSyncs } from "./marketing-sync";
import {
  getMarketingContactState,
  removeFromMarketingSegment,
} from "./resend";
import { MARKETING_TOPIC_KEY } from "./subscriptions";

const RECONCILIATION_BATCH_SIZE = 25;

type ReconciliationContact = {
  id: string;
  resend_contact_id: string;
  marketing_status: "pending" | "subscribed" | "unsubscribed" | "blocked";
  marketing_confirmed_at: Date | null;
  marketing_blocked_reason: string | null;
};

async function selectReconciliationBatch(): Promise<ReconciliationContact[]> {
  return getDatabase()<ReconciliationContact[]>`
    SELECT
      id,
      resend_contact_id,
      marketing_status,
      marketing_confirmed_at,
      marketing_blocked_reason
    FROM contacts
    WHERE resend_contact_id IS NOT NULL
      AND (
        marketing_status = 'subscribed'
        OR (
          marketing_status = 'pending'
          AND marketing_confirmed_at IS NULL
          AND marketing_status_updated_at IS NOT NULL
        )
        OR (
          marketing_status = 'blocked'
          AND marketing_blocked_reason LIKE 'reconciliation_%'
        )
        OR (
          marketing_status = 'unsubscribed'
          AND marketing_blocked_reason = 'reconciliation_segment_cleanup'
        )
      )
    ORDER BY marketing_last_reconciled_at ASC NULLS FIRST, id ASC
    LIMIT ${RECONCILIATION_BATCH_SIZE}
  `;
}

async function markReconciliationFailure(
  contact: ReconciliationContact,
  reason: "reconciliation_provider_error" | "reconciliation_contact_missing",
): Promise<void> {
  await getDatabase()`
    UPDATE contacts
    SET
      marketing_status = 'blocked',
      marketing_status_updated_at = now(),
      marketing_blocked_reason = ${reason},
      marketing_last_reconciled_at = now(),
      marketing_sync_status = 'idle',
      marketing_sync_next_attempt_at = NULL
    WHERE id = ${contact.id}
      AND marketing_status NOT IN ('unsubscribed')
  `;
}

async function markProviderOptOut(
  contact: ReconciliationContact,
): Promise<void> {
  await getDatabase().begin(async (transaction) => {
    const [updated] = await transaction<{ id: string }[]>`
      UPDATE contacts
      SET
        marketing_status = 'unsubscribed',
        marketing_status_updated_at = now(),
        marketing_opted_out_at = now(),
        marketing_blocked_reason = 'reconciliation_segment_cleanup',
        marketing_last_reconciled_at = now(),
        marketing_sync_status = 'idle',
        marketing_sync_generation = NULL,
        marketing_sync_next_attempt_at = NULL,
        marketing_sync_last_error = NULL
      WHERE id = ${contact.id}
      RETURNING id
    `;

    if (updated && contact.marketing_status !== "unsubscribed") {
      await transaction`
        INSERT INTO consent_events (
          id,
          contact_id,
          topic_key,
          action,
          source,
          occurred_at
        ) VALUES (
          ${randomUUID()},
          ${updated.id},
          ${MARKETING_TOPIC_KEY},
          'opted_out',
          'resend_reconciliation',
          now()
        )
      `;
    }
  });
}

async function markSegmentCleanupComplete(
  contact: ReconciliationContact,
): Promise<void> {
  await getDatabase()`
    UPDATE contacts
    SET
      marketing_blocked_reason = NULL,
      marketing_last_reconciled_at = now()
    WHERE id = ${contact.id}
      AND marketing_status = 'unsubscribed'
      AND marketing_blocked_reason = 'reconciliation_segment_cleanup'
  `;
}

async function markProviderOptIn(
  contact: ReconciliationContact,
): Promise<void> {
  await getDatabase()`
    UPDATE contacts
    SET
      marketing_status = CASE
        WHEN marketing_status = 'blocked'
          AND marketing_blocked_reason LIKE 'reconciliation_%'
        THEN 'pending'
        ELSE marketing_status
      END,
      marketing_status_updated_at = CASE
        WHEN marketing_status = 'blocked'
          AND marketing_blocked_reason LIKE 'reconciliation_%'
        THEN now()
        ELSE marketing_status_updated_at
      END,
      marketing_blocked_reason = CASE
        WHEN marketing_status = 'blocked'
          AND marketing_blocked_reason LIKE 'reconciliation_%'
        THEN NULL
        ELSE marketing_blocked_reason
      END,
      marketing_sync_status = CASE
        WHEN marketing_status = 'blocked'
          AND marketing_blocked_reason LIKE 'reconciliation_%'
        THEN 'pending'
        ELSE marketing_sync_status
      END,
      marketing_sync_next_attempt_at = CASE
        WHEN marketing_status = 'blocked'
          AND marketing_blocked_reason LIKE 'reconciliation_%'
        THEN now()
        ELSE marketing_sync_next_attempt_at
      END,
      marketing_last_reconciled_at = now()
    WHERE id = ${contact.id}
      AND marketing_status NOT IN ('unsubscribed')
  `;
}

async function keepPendingContactFailClosed(
  contact: ReconciliationContact,
): Promise<void> {
  await removeFromMarketingSegment(contact.resend_contact_id);
  await getDatabase()`
    UPDATE contacts
    SET marketing_last_reconciled_at = now()
    WHERE id = ${contact.id}
      AND marketing_status = 'pending'
  `;
}

async function failClosedAfterReconciliationError(
  contact: ReconciliationContact,
  reason: "reconciliation_provider_error" | "reconciliation_contact_missing",
): Promise<void> {
  let persistenceError: unknown;
  try {
    await markReconciliationFailure(contact, reason);
  } catch (error) {
    persistenceError = error;
  }

  try {
    await removeFromMarketingSegment(contact.resend_contact_id);
  } catch {
    // The reconciliation_* reason keeps the contact selected for another pass.
  }

  if (persistenceError) {
    throw persistenceError;
  }
}

/**
 * Reconciles a small provider-to-database page. Provider opt-outs always win;
 * unknown or divergent provider state makes the contact locally ineligible.
 */
export async function reconcileMarketingContacts(): Promise<{
  checked: number;
  optedOut: number;
  eligible: number;
  failedClosed: number;
  syncChecked: number;
  syncSucceeded: number;
  syncFailed: number;
}> {
  const sync = await processPendingMarketingSyncs();
  const contacts = await selectReconciliationBatch();
  let optedOut = 0;
  let eligible = 0;
  let failedClosed = 0;

  for (const contact of contacts) {
    try {
      // Cleanup must not depend on reading a provider contact that may already
      // have been deleted. Segment removal tolerates a missing contact.
      if (contact.marketing_status === "unsubscribed") {
        await removeFromMarketingSegment(contact.resend_contact_id);
        await markSegmentCleanupComplete(contact);
        optedOut += 1;
        continue;
      }

      const state = await getMarketingContactState(contact.resend_contact_id);

      if (!state.exists) {
        await failClosedAfterReconciliationError(
          contact,
          "reconciliation_contact_missing",
        );
        failedClosed += 1;
        continue;
      }

      if (contact.marketing_status === "pending") {
        await keepPendingContactFailClosed(contact);
        failedClosed += 1;
        continue;
      }

      const providerOptedOut =
        state.globallyUnsubscribed || state.topicSubscription === "opt_out";
      const providerStateMissing = state.topicSubscription === undefined;

      if (providerOptedOut) {
        // Persist the opt-out first; Segment cleanup can safely be retried.
        await markProviderOptOut(contact);
        await removeFromMarketingSegment(contact.resend_contact_id);
        await markSegmentCleanupComplete(contact);
        optedOut += 1;
        continue;
      }

      if (providerStateMissing) {
        await failClosedAfterReconciliationError(
          contact,
          "reconciliation_provider_error",
        );
        failedClosed += 1;
        continue;
      }

      await markProviderOptIn(contact);
      eligible += 1;
    } catch {
      await failClosedAfterReconciliationError(
        contact,
        "reconciliation_provider_error",
      );
      failedClosed += 1;
    }
  }

  const recoveredSync = await processPendingMarketingSyncs();

  return {
    checked: contacts.length,
    optedOut,
    eligible,
    failedClosed,
    syncChecked: sync.checked + recoveredSync.checked,
    syncSucceeded: sync.synced + recoveredSync.synced,
    syncFailed: sync.failed + recoveredSync.failed,
  };
}
