import { randomUUID } from "node:crypto";

import { normalizeEmail } from "./crypto";
import { getDatabase } from "./database";
import { getInternalRecipient } from "./env";
import { enqueueEmail } from "./outbox";
import {
  enqueueDoubleOptIn,
  upsertContact,
} from "./subscriptions";
import type { ContactRequestInput } from "./validation";

const CONTACT_REQUESTS_PER_HOUR = 5;
const CONTACT_REQUESTS_GLOBAL_PER_MINUTE = 20;
const CONTACT_REQUESTS_GLOBAL_PER_HOUR = 120;

export class ContactRequestRateLimitError extends Error {
  constructor() {
    super("CONTACT_REQUEST_RATE_LIMITED");
    this.name = "ContactRequestRateLimitError";
  }
}

/** Persists one contact request and all resulting messages in a single transaction. */
export async function createContactRequest(
  input: ContactRequestInput,
): Promise<void> {
  const database = getDatabase();
  const email = normalizeEmail(input.email);
  const requestId = randomUUID();
  const submittedAt = new Date().toISOString();

  await database.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(hashtext('breytilla_contact_rate_limit'))
    `;
    const [globalActivity] = await transaction<
      { last_minute: number; last_hour: number }[]
    >`
      SELECT
        count(*) FILTER (
          WHERE created_at >= now() - interval '1 minute'
        )::int AS last_minute,
        count(*) FILTER (
          WHERE created_at >= now() - interval '1 hour'
        )::int AS last_hour
      FROM contact_requests
      WHERE created_at >= now() - interval '1 hour'
    `;

    if (
      (globalActivity?.last_minute ?? 0) >=
        CONTACT_REQUESTS_GLOBAL_PER_MINUTE ||
      (globalActivity?.last_hour ?? 0) >= CONTACT_REQUESTS_GLOBAL_PER_HOUR
    ) {
      throw new ContactRequestRateLimitError();
    }

    const contact = await upsertContact(transaction, {
      email,
      name: input.name,
    });

    const [recentRequests] = await transaction<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM contact_requests
      WHERE contact_id = ${contact.id}
        AND created_at >= now() - interval '1 hour'
    `;

    if ((recentRequests?.count ?? 0) >= CONTACT_REQUESTS_PER_HOUR) {
      throw new ContactRequestRateLimitError();
    }

    await transaction`
      INSERT INTO contact_requests (
        id,
        contact_id,
        phone,
        preferred_channel,
        marketing_opt_in
      ) VALUES (
        ${requestId},
        ${contact.id},
        ${input.phone ?? null},
        ${input.preferredChannel},
        ${input.marketingOptIn}
      )
    `;

    await enqueueEmail(transaction, {
      eventId: `contact-received/${requestId}`,
      template: "contact-request-received",
      recipient: email,
      payload: { name: input.name },
    });

    await enqueueEmail(transaction, {
      eventId: `contact-internal/${requestId}`,
      template: "contact-request-internal",
      recipient: normalizeEmail(getInternalRecipient()),
      payload: {
        name: input.name,
        email,
        ...(input.phone ? { phone: input.phone } : {}),
        preferredChannel: input.preferredChannel,
        requestId,
        submittedAt,
      },
    });

    if (input.marketingOptIn && input.consentVersion) {
      await enqueueDoubleOptIn(transaction, {
        contact,
        consentVersion: input.consentVersion,
        source: "contact_form",
      });
    }
  });
}
