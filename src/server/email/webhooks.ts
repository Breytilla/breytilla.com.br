import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import type { WebhookEventPayload } from "resend";

import { normalizeEmail } from "./crypto";
import { getDatabase } from "./database";
import { getMarketingTopicSubscription } from "./resend";
import { MARKETING_TOPIC_KEY } from "./subscriptions";

type WebhookClaim = "claimed" | "duplicate";
type MarketingBlockAction = "bounced" | "complained" | "suppressed";

function eventDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_WEBHOOK_CREATED_AT");
  }
  return parsed;
}

async function claimWebhookEvent(input: {
  transaction: postgres.TransactionSql;
  providerEventId: string;
  type: string;
  createdAt: Date;
}): Promise<WebhookClaim> {
  const inserted = await input.transaction<{ id: string }[]>`
    INSERT INTO webhook_events (
      id,
      provider_event_id,
      event_type,
      provider_created_at
    ) VALUES (
      ${randomUUID()},
      ${input.providerEventId},
      ${input.type},
      ${input.createdAt}
    )
    ON CONFLICT (provider_event_id) DO NOTHING
    RETURNING id
  `;

  if (inserted.length > 0) {
    return "claimed";
  }

  const [existing] = await input.transaction<
    { status: "processing" | "processed" | "failed" }[]
  >`
    SELECT status
    FROM webhook_events
    WHERE provider_event_id = ${input.providerEventId}
    FOR UPDATE
  `;

  if (existing?.status === "processed") {
    return "duplicate";
  }
  if (!existing) {
    throw new Error("WEBHOOK_CLAIM_MISSING");
  }

  await input.transaction`
    UPDATE webhook_events
    SET
      status = 'processing',
      attempts = attempts + 1,
      last_error_code = NULL
    WHERE provider_event_id = ${input.providerEventId}
  `;

  return "claimed";
}

async function insertConsentEvent(
  transaction: postgres.TransactionSql,
  input: {
    contactId: string;
    action: "opted_out" | MarketingBlockAction;
    providerEventId: string;
    occurredAt: Date;
  },
): Promise<void> {
  await transaction`
    INSERT INTO consent_events (
      id,
      contact_id,
      topic_key,
      action,
      source,
      provider_event_id,
      occurred_at
    ) VALUES (
      ${randomUUID()},
      ${input.contactId},
      ${MARKETING_TOPIC_KEY},
      ${input.action},
      'resend_webhook',
      ${input.providerEventId},
      ${input.occurredAt}
    )
    ON CONFLICT (provider_event_id, contact_id, action)
      WHERE provider_event_id IS NOT NULL
      DO NOTHING
  `;
}

async function blockMarketingForEmail(
  transaction: postgres.TransactionSql,
  input: {
    email: string;
    action: MarketingBlockAction;
    providerEventId: string;
    occurredAt: Date;
  },
): Promise<void> {
  const [contact] = await transaction<{ id: string }[]>`
    UPDATE contacts
    SET
      marketing_status = CASE
        WHEN marketing_status_updated_at IS NULL
          OR marketing_status_updated_at <= ${input.occurredAt}
        THEN 'blocked'
        ELSE marketing_status
      END,
      marketing_status_updated_at = GREATEST(
        COALESCE(marketing_status_updated_at, '-infinity'::timestamptz),
        ${input.occurredAt}
      ),
      marketing_opted_out_at = GREATEST(
        COALESCE(marketing_opted_out_at, '-infinity'::timestamptz),
        ${input.occurredAt}
      ),
      marketing_blocked_reason = CASE
        WHEN marketing_status_updated_at IS NULL
          OR marketing_status_updated_at <= ${input.occurredAt}
        THEN ${input.action}
        ELSE marketing_blocked_reason
      END,
      marketing_sync_status = CASE
        WHEN marketing_status_updated_at IS NULL
          OR marketing_status_updated_at <= ${input.occurredAt}
        THEN 'idle'
        ELSE marketing_sync_status
      END,
      marketing_sync_generation = CASE
        WHEN marketing_status_updated_at IS NULL
          OR marketing_status_updated_at <= ${input.occurredAt}
        THEN NULL
        ELSE marketing_sync_generation
      END,
      marketing_sync_next_attempt_at = CASE
        WHEN marketing_status_updated_at IS NULL
          OR marketing_status_updated_at <= ${input.occurredAt}
        THEN NULL
        ELSE marketing_sync_next_attempt_at
      END,
      marketing_sync_last_error = CASE
        WHEN marketing_status_updated_at IS NULL
          OR marketing_status_updated_at <= ${input.occurredAt}
        THEN NULL
        ELSE marketing_sync_last_error
      END
    WHERE email = ${input.email}
    RETURNING id
  `;

  if (contact) {
    await insertConsentEvent(transaction, {
      contactId: contact.id,
      action: input.action,
      providerEventId: input.providerEventId,
      occurredAt: input.occurredAt,
    });
  }
}

async function syncContactUpdated(
  transaction: postgres.TransactionSql,
  input: {
    providerEventId: string;
    contactId: string;
    email: string;
    optedOut: boolean;
    occurredAt: Date;
  },
): Promise<void> {
  let [contact] = await transaction<{ id: string }[]>`
    SELECT id
    FROM contacts
    WHERE resend_contact_id = ${input.contactId}
    FOR UPDATE
  `;

  if (!contact) {
    [contact] = await transaction<{ id: string }[]>`
      SELECT id
      FROM contacts
      WHERE email = ${input.email}
      FOR UPDATE
    `;
  }

  if (!contact && input.optedOut) {
    [contact] = await transaction<{ id: string }[]>`
      INSERT INTO contacts (
        id,
        email,
        resend_contact_id,
        marketing_status,
        marketing_status_updated_at,
        marketing_opted_out_at,
        marketing_blocked_reason
      ) VALUES (
        ${randomUUID()},
        ${input.email},
        ${input.contactId},
        'unsubscribed',
        ${input.occurredAt},
        ${input.occurredAt},
        'reconciliation_segment_cleanup'
      )
      ON CONFLICT (email) DO UPDATE
      SET resend_contact_id = EXCLUDED.resend_contact_id
      RETURNING id
    `;
  }

  if (!contact) {
    return;
  }

  if (input.optedOut) {
    await transaction`
      UPDATE contacts
      SET
        resend_contact_id = ${input.contactId},
        marketing_status = CASE
          WHEN marketing_status_updated_at IS NULL
            OR marketing_status_updated_at <= ${input.occurredAt}
          THEN 'unsubscribed'
          ELSE marketing_status
        END,
        marketing_status_updated_at = GREATEST(
          COALESCE(marketing_status_updated_at, '-infinity'::timestamptz),
          ${input.occurredAt}
        ),
        marketing_opted_out_at = GREATEST(
          COALESCE(marketing_opted_out_at, '-infinity'::timestamptz),
          ${input.occurredAt}
        ),
        marketing_blocked_reason = CASE
          WHEN marketing_status_updated_at IS NULL
            OR marketing_status_updated_at <= ${input.occurredAt}
          THEN 'reconciliation_segment_cleanup'
          ELSE marketing_blocked_reason
        END,
        marketing_sync_status = CASE
          WHEN marketing_status_updated_at IS NULL
            OR marketing_status_updated_at <= ${input.occurredAt}
          THEN 'idle'
          ELSE marketing_sync_status
        END,
        marketing_sync_generation = CASE
          WHEN marketing_status_updated_at IS NULL
            OR marketing_status_updated_at <= ${input.occurredAt}
          THEN NULL
          ELSE marketing_sync_generation
        END,
        marketing_sync_next_attempt_at = CASE
          WHEN marketing_status_updated_at IS NULL
            OR marketing_status_updated_at <= ${input.occurredAt}
          THEN NULL
          ELSE marketing_sync_next_attempt_at
        END,
        marketing_sync_last_error = CASE
          WHEN marketing_status_updated_at IS NULL
            OR marketing_status_updated_at <= ${input.occurredAt}
          THEN NULL
          ELSE marketing_sync_last_error
        END
      WHERE id = ${contact.id}
    `;

    await insertConsentEvent(transaction, {
      contactId: contact.id,
      action: "opted_out",
      providerEventId: input.providerEventId,
      occurredAt: input.occurredAt,
    });
    return;
  }

  // An opt-in webhook is never authoritative enough to reverse a local opt-out.
  await transaction`
    UPDATE contacts
    SET resend_contact_id = ${input.contactId}
    WHERE id = ${contact.id}
  `;
}

async function applyEmailEvent(
  transaction: postgres.TransactionSql,
  input: {
    providerEventId: string;
    event: Extract<WebhookEventPayload, { type: `email.${string}` }>;
    occurredAt: Date;
  },
): Promise<void> {
  const statusByType = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.failed": "failed",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.suppressed": "suppressed",
  } as const;

  if (!(input.event.type in statusByType)) {
    return;
  }

  const status = statusByType[
    input.event.type as keyof typeof statusByType
  ];
  const emailId = input.event.data.email_id;
  const taggedOutboxId =
    "tags" in input.event.data
      ? input.event.data.tags?.outbox_id
      : undefined;

  await transaction`
    WITH matched AS (
      SELECT
        outbox.id,
        (
          outbox.provider_status_at IS NULL
          OR (
            ${input.occurredAt} >= outbox.provider_status_at
            AND (
              outbox.status = ${status}
              OR (
                outbox.status = 'sent'
                AND ${status} IN (
                  'delayed',
                  'delivered',
                  'failed',
                  'bounced',
                  'complained',
                  'suppressed'
                )
              )
              OR (
                outbox.status = 'delayed'
                AND ${status} IN (
                  'delivered',
                  'failed',
                  'bounced',
                  'complained',
                  'suppressed'
                )
              )
              OR (
                outbox.status = 'delivered'
                AND ${status} = 'complained'
              )
            )
          )
        ) AS should_apply
      FROM email_outbox AS outbox
      WHERE outbox.resend_email_id = ${emailId}
        OR (
          ${taggedOutboxId ?? null}::text IS NOT NULL
          AND outbox.id::text = ${taggedOutboxId ?? null}
          AND (
            outbox.resend_email_id IS NULL
            OR outbox.resend_email_id = ${emailId}
          )
        )
    )
    UPDATE email_outbox AS outbox
    SET
      status = CASE
        WHEN matched.should_apply THEN ${status}
        ELSE outbox.status
      END,
      resend_email_id = COALESCE(outbox.resend_email_id, ${emailId}),
      provider_status_at = CASE
        WHEN matched.should_apply THEN ${input.occurredAt}
        ELSE outbox.provider_status_at
      END,
      sent_at = CASE
        WHEN matched.should_apply AND ${status} = 'sent'
        THEN COALESCE(outbox.sent_at, ${input.occurredAt})
        ELSE outbox.sent_at
      END,
      delivered_at = CASE
        WHEN matched.should_apply AND ${status} = 'delivered'
        THEN ${input.occurredAt}
        ELSE outbox.delivered_at
      END,
      last_error_code = CASE
        WHEN NOT matched.should_apply THEN outbox.last_error_code
        WHEN ${status} IN ('failed', 'bounced', 'complained', 'suppressed')
          THEN upper(replace(${input.event.type}, '.', '_'))
        ELSE NULL
      END
    FROM matched
    WHERE outbox.id = matched.id
  `;

  const blockActionByType: Partial<
    Record<typeof input.event.type, MarketingBlockAction>
  > = {
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.suppressed": "suppressed",
  };
  const blockAction = blockActionByType[input.event.type];

  if (!blockAction) {
    return;
  }

  const normalizedRecipients = [
    ...new Set(
      input.event.data.to
        .map(normalizeEmail)
        .filter((email) => email.length > 0),
    ),
  ];

  for (const email of normalizedRecipients) {
    await blockMarketingForEmail(transaction, {
      email,
      action: blockAction,
      providerEventId: input.providerEventId,
      occurredAt: input.occurredAt,
    });
  }
}

/** Deduplicates and applies one verified webhook to delivery and consent state. */
export async function handleResendWebhook(input: {
  providerEventId: string;
  event: WebhookEventPayload;
}): Promise<"processed" | "duplicate"> {
  const occurredAt = eventDate(input.event.created_at);
  const topicSubscription =
    input.event.type === "contact.updated"
      ? await getMarketingTopicSubscription(input.event.data.id)
      : undefined;

  return getDatabase().begin(async (transaction) => {
    const claim = await claimWebhookEvent({
      transaction,
      providerEventId: input.providerEventId,
      type: input.event.type,
      createdAt: occurredAt,
    });

    if (claim === "duplicate") {
      return "duplicate" as const;
    }

    if (input.event.type === "contact.updated") {
      await syncContactUpdated(transaction, {
        providerEventId: input.providerEventId,
        contactId: input.event.data.id,
        email: normalizeEmail(input.event.data.email),
        optedOut:
          input.event.data.unsubscribed || topicSubscription === "opt_out",
        occurredAt,
      });
    } else if (input.event.type.startsWith("email.")) {
      await applyEmailEvent(transaction, {
        providerEventId: input.providerEventId,
        event: input.event as Extract<
          WebhookEventPayload,
          { type: `email.${string}` }
        >,
        occurredAt,
      });
    }

    await transaction`
      UPDATE webhook_events
      SET
        status = 'processed',
        processed_at = now(),
        last_error_code = NULL
      WHERE provider_event_id = ${input.providerEventId}
        AND status = 'processing'
    `;

    return "processed" as const;
  });
}
