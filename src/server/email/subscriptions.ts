import { randomUUID } from "node:crypto";
import type postgres from "postgres";

import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "./crypto";
import { getDatabase } from "./database";
import { getAppEnv } from "./env";
import { syncConfirmedMarketingContact } from "./marketing-sync";
import { enqueueEmail } from "./outbox";

export const MARKETING_TOPIC_KEY = "conteudos-e-novidades";
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const OPT_IN_REQUESTS_PER_HOUR = 3;

export type ContactRecord = {
  id: string;
  email: string;
  name: string | null;
  marketing_status:
    | "never_subscribed"
    | "pending"
    | "subscribed"
    | "unsubscribed"
    | "blocked";
  marketing_status_updated_at: Date | null;
  marketing_opted_out_at: Date | null;
  marketing_confirmed_at: Date | null;
  marketing_sync_generation: string | null;
};

type ConfirmationRow = ContactRecord & {
  token_id: string;
  consent_version: string;
  expires_at: Date;
  used_at: Date | null;
  token_created_at: Date;
};

/** Upserts the minimum contact identity without altering subscription state. */
export async function upsertContact(
  transaction: postgres.TransactionSql,
  input: { email: string; name?: string | null },
): Promise<ContactRecord> {
  const [contact] = await transaction<ContactRecord[]>`
    INSERT INTO contacts (id, email, name)
    VALUES (${randomUUID()}, ${input.email}, ${input.name ?? null})
    ON CONFLICT (email) DO UPDATE
    SET name = COALESCE(EXCLUDED.name, contacts.name)
    RETURNING
      id,
      email,
      name,
      marketing_status,
      marketing_status_updated_at,
      marketing_opted_out_at,
      marketing_confirmed_at,
      marketing_sync_generation
  `;

  if (!contact) {
    throw new Error("CONTACT_UPSERT_FAILED");
  }

  return contact;
}

/**
 * Records explicit opt-in intent and enqueues a double-opt-in message. Repeated
 * requests are silently rate-limited so the endpoint cannot enumerate users.
 */
export async function enqueueDoubleOptIn(
  transaction: postgres.TransactionSql,
  input: {
    contact: ContactRecord;
    consentVersion: string;
    source: "contact_form" | "newsletter_form";
  },
): Promise<{ queued: boolean }> {
  if (
    input.contact.marketing_status === "blocked" ||
    input.contact.marketing_status === "subscribed" ||
    (input.contact.marketing_status === "pending" &&
      input.contact.marketing_sync_generation !== null)
  ) {
    return { queued: false };
  }

  const [recentRequests] = await transaction<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM consent_events
    WHERE contact_id = ${input.contact.id}
      AND action = 'opt_in_requested'
      AND occurred_at >= now() - interval '1 hour'
  `;

  if ((recentRequests?.count ?? 0) >= OPT_IN_REQUESTS_PER_HOUR) {
    return { queued: false };
  }

  const token = generateConfirmationToken();
  const tokenId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS);

  await transaction`
    UPDATE confirmation_tokens
    SET expires_at = LEAST(expires_at, now())
    WHERE contact_id = ${input.contact.id}
      AND used_at IS NULL
      AND expires_at > now()
  `;

  await transaction`
    INSERT INTO confirmation_tokens (
      id,
      contact_id,
      token_hash,
      consent_version,
      source,
      expires_at
    ) VALUES (
      ${tokenId},
      ${input.contact.id},
      ${hashConfirmationToken(token)},
      ${input.consentVersion},
      ${input.source},
      ${expiresAt}
    )
  `;

  await transaction`
    INSERT INTO consent_events (
      id,
      contact_id,
      topic_key,
      action,
      source,
      consent_version,
      occurred_at
    ) VALUES (
      ${randomUUID()},
      ${input.contact.id},
      ${MARKETING_TOPIC_KEY},
      'opt_in_requested',
      ${input.source},
      ${input.consentVersion},
      now()
    )
  `;

  await transaction`
    UPDATE contacts
    SET
      marketing_status = 'pending',
      marketing_status_updated_at = now(),
      marketing_confirmed_at = NULL,
      marketing_blocked_reason = NULL,
      marketing_sync_status = 'idle',
      marketing_sync_generation = NULL,
      marketing_sync_attempts = 0,
      marketing_sync_next_attempt_at = NULL,
      marketing_sync_last_error = NULL
    WHERE id = ${input.contact.id}
  `;

  const confirmationUrl = new URL(
    "/api/newsletter/confirm",
    getAppEnv().APP_URL,
  );
  confirmationUrl.searchParams.set("token", token);

  await enqueueEmail(transaction, {
    eventId: `newsletter-confirm/${tokenId}`,
    template: "newsletter-confirm-opt-in",
    recipient: input.contact.email,
    payload: {
      ...(input.contact.name ? { name: input.contact.name } : {}),
      confirmationUrl: confirmationUrl.toString(),
    },
  });

  return { queued: true };
}

/** Consumes a 24-hour token once, then synchronizes its committed proof. */
export async function confirmNewsletterSubscription(
  token: string,
): Promise<"confirmed" | "invalid"> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return "invalid";
  }

  const database = getDatabase();
  const tokenHash = hashConfirmationToken(token);

  const persisted = await database.begin(async (transaction) => {
    const [confirmation] = await transaction<ConfirmationRow[]>`
      SELECT
        confirmation_tokens.id AS token_id,
        confirmation_tokens.consent_version,
        confirmation_tokens.expires_at,
        confirmation_tokens.used_at,
        confirmation_tokens.created_at AS token_created_at,
        contacts.id,
        contacts.email,
        contacts.name,
        contacts.marketing_status,
        contacts.marketing_status_updated_at,
        contacts.marketing_opted_out_at,
        contacts.marketing_confirmed_at,
        contacts.marketing_sync_generation
      FROM confirmation_tokens
      INNER JOIN contacts
        ON contacts.id = confirmation_tokens.contact_id
      WHERE confirmation_tokens.token_hash = ${tokenHash}
      FOR UPDATE OF confirmation_tokens, contacts
    `;

    if (
      !confirmation ||
      confirmation.used_at ||
      confirmation.expires_at.getTime() <= Date.now() ||
      confirmation.marketing_status === "blocked" ||
      (confirmation.marketing_opted_out_at &&
        confirmation.marketing_opted_out_at.getTime() >=
          confirmation.token_created_at.getTime())
    ) {
      return { result: "invalid" as const };
    }

    await transaction`
      UPDATE confirmation_tokens
      SET used_at = now()
      WHERE id = ${confirmation.token_id}
        AND used_at IS NULL
    `;

    await transaction`
      UPDATE contacts
      SET
        marketing_status = 'pending',
        marketing_status_updated_at = now(),
        marketing_confirmed_at = now(),
        marketing_blocked_reason = NULL,
        marketing_sync_status = 'pending',
        marketing_sync_generation = ${confirmation.token_id},
        marketing_sync_attempts = 0,
        marketing_sync_next_attempt_at = now(),
        marketing_sync_last_error = NULL
      WHERE id = ${confirmation.id}
    `;

    await transaction`
      INSERT INTO consent_events (
        id,
        contact_id,
        topic_key,
        action,
        source,
        consent_version,
        occurred_at
      ) VALUES (
        ${randomUUID()},
        ${confirmation.id},
        ${MARKETING_TOPIC_KEY},
        'opt_in_confirmed',
        'double_opt_in',
        ${confirmation.consent_version},
        now()
      )
    `;

    return {
      result: "confirmed" as const,
      contactId: confirmation.id,
    };
  });

  if (persisted.result === "invalid") {
    return "invalid";
  }

  try {
    await syncConfirmedMarketingContact(persisted.contactId);
  } catch {
    // The committed pending sync remains recoverable by email-reconcile.
  }

  return "confirmed";
}
