import { getDatabase } from "./database";
import {
  EmailProviderError,
  ensureMarketingSubscriber,
  removeEmailFromMarketingSegment,
  removeFromMarketingSegment,
} from "./resend";

type ConfirmedSyncContact = {
  id: string;
  email: string;
  name: string | null;
  marketing_confirmed_at: Date;
  marketing_sync_generation: string;
};

export type MarketingSyncResult = "synced" | "failed" | "ineligible";

type CurrentSyncState = {
  marketing_status: string;
  marketing_confirmed_at: Date | null;
  marketing_sync_generation: string | null;
  marketing_sync_status: string;
};

function syncErrorCode(error: unknown): string {
  if (error instanceof EmailProviderError) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  }
  return "UNKNOWN_ERROR";
}

async function recordSyncFailure(
  contact: ConfirmedSyncContact,
  error: unknown,
): Promise<void> {
  await getDatabase()`
    UPDATE contacts
    SET
      marketing_sync_status = 'failed',
      marketing_sync_attempts = marketing_sync_attempts + 1,
      marketing_sync_next_attempt_at = now() + interval '1 hour',
      marketing_sync_last_error = ${syncErrorCode(error)}
    WHERE id = ${contact.id}
      AND marketing_status IN ('pending', 'subscribed')
      AND marketing_confirmed_at = ${contact.marketing_confirmed_at}
      AND marketing_sync_generation = ${contact.marketing_sync_generation}
  `;
}

async function shouldCompensateProviderEligibility(
  contact: ConfirmedSyncContact,
): Promise<boolean> {
  const [current] = await getDatabase()<CurrentSyncState[]>`
    SELECT
      marketing_status,
      marketing_confirmed_at,
      marketing_sync_generation,
      marketing_sync_status
    FROM contacts
    WHERE id = ${contact.id}
  `;

  if (!current) {
    return true;
  }

  const hasEligibleIntent =
    (current.marketing_status === "pending" ||
      current.marketing_status === "subscribed") &&
    current.marketing_confirmed_at !== null &&
    current.marketing_sync_generation !== null;

  if (
    hasEligibleIntent &&
    current.marketing_sync_generation !== contact.marketing_sync_generation
  ) {
    return false;
  }

  return !(
    hasEligibleIntent &&
    current.marketing_sync_generation === contact.marketing_sync_generation &&
    current.marketing_sync_status === "synced"
  );
}

async function compensateIfStillOwned(
  contact: ConfirmedSyncContact,
  resendContactId?: string,
): Promise<void> {
  if (!(await shouldCompensateProviderEligibility(contact))) {
    return;
  }

  if (resendContactId) {
    await removeFromMarketingSegment(resendContactId);
  } else {
    await removeEmailFromMarketingSegment(contact.email);
  }
}

/**
 * Synchronizes one already-committed consent proof to Resend. Provider
 * eligibility is compensated if local state changes or final persistence fails.
 */
export async function syncConfirmedMarketingContact(
  contactId: string,
): Promise<MarketingSyncResult> {
  const [contact] = await getDatabase()<ConfirmedSyncContact[]>`
    SELECT
      id,
      email,
      name,
      marketing_confirmed_at,
      marketing_sync_generation
    FROM contacts
    WHERE id = ${contactId}
      AND marketing_status IN ('pending', 'subscribed')
      AND marketing_confirmed_at IS NOT NULL
      AND marketing_sync_generation IS NOT NULL
      AND marketing_sync_status IN ('pending', 'failed')
      AND (
        marketing_sync_next_attempt_at IS NULL
        OR marketing_sync_next_attempt_at <= now()
      )
  `;

  if (!contact) {
    return "ineligible";
  }

  try {
    const resendContactId = await ensureMarketingSubscriber({
      email: contact.email,
      name: contact.name,
    });

    const updated = await getDatabase()<{ id: string }[]>`
      UPDATE contacts
      SET
        resend_contact_id = ${resendContactId},
        marketing_status = 'subscribed',
        marketing_status_updated_at = now(),
        marketing_sync_status = 'synced',
        marketing_sync_attempts = marketing_sync_attempts + 1,
        marketing_sync_next_attempt_at = NULL,
        marketing_sync_last_error = NULL
      WHERE id = ${contact.id}
        AND marketing_status IN ('pending', 'subscribed')
        AND marketing_confirmed_at = ${contact.marketing_confirmed_at}
        AND marketing_sync_generation = ${contact.marketing_sync_generation}
      RETURNING id
    `;

    if (updated.length === 0) {
      await compensateIfStillOwned(contact, resendContactId);
      return "ineligible";
    }

    return "synced";
  } catch (error) {
    try {
      await compensateIfStillOwned(contact);
    } catch {
      // The persisted failed state keeps this contact in the recovery queue.
    }

    await recordSyncFailure(contact, error);
    return "failed";
  }
}

/** Retries a bounded page of locally-confirmed provider synchronizations. */
export async function processPendingMarketingSyncs(
  limit = 10,
): Promise<{ checked: number; synced: number; failed: number }> {
  const candidates = await getDatabase()<{ id: string }[]>`
    SELECT id
    FROM contacts
    WHERE marketing_status IN ('pending', 'subscribed')
      AND marketing_confirmed_at IS NOT NULL
      AND marketing_sync_generation IS NOT NULL
      AND marketing_sync_status IN ('pending', 'failed')
      AND (
        marketing_sync_next_attempt_at IS NULL
        OR marketing_sync_next_attempt_at <= now()
      )
    ORDER BY marketing_sync_next_attempt_at ASC NULLS FIRST, marketing_confirmed_at ASC
    LIMIT ${Math.max(1, Math.min(limit, 25))}
  `;

  let synced = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const result = await syncConfirmedMarketingContact(candidate.id);
    if (result === "synced") {
      synced += 1;
    } else if (result === "failed") {
      failed += 1;
    }
  }

  return { checked: candidates.length, synced, failed };
}
