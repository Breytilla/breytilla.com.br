import { normalizeEmail } from "./crypto";
import { getDatabase } from "./database";
import { enqueueDoubleOptIn, upsertContact } from "./subscriptions";
import type { NewsletterRequestInput } from "./validation";

const NEWSLETTER_REQUESTS_GLOBAL_PER_MINUTE = 30;
const NEWSLETTER_REQUESTS_GLOBAL_PER_HOUR = 240;

/** Records newsletter intent and queues double opt-in without revealing contact state. */
export async function requestNewsletterOptIn(
  input: NewsletterRequestInput,
): Promise<void> {
  const database = getDatabase();
  const email = normalizeEmail(input.email);

  await database.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(hashtext('breytilla_newsletter_rate_limit'))
    `;
    const [globalActivity] = await transaction<
      { last_minute: number; last_hour: number }[]
    >`
      SELECT
        count(*) FILTER (
          WHERE occurred_at >= now() - interval '1 minute'
        )::int AS last_minute,
        count(*) FILTER (
          WHERE occurred_at >= now() - interval '1 hour'
        )::int AS last_hour
      FROM consent_events
      WHERE action = 'opt_in_requested'
        AND occurred_at >= now() - interval '1 hour'
    `;

    if (
      (globalActivity?.last_minute ?? 0) >=
        NEWSLETTER_REQUESTS_GLOBAL_PER_MINUTE ||
      (globalActivity?.last_hour ?? 0) >= NEWSLETTER_REQUESTS_GLOBAL_PER_HOUR
    ) {
      return;
    }

    const contact = await upsertContact(transaction, {
      email,
      name: input.firstName,
    });
    await enqueueDoubleOptIn(transaction, {
      contact,
      consentVersion: input.consentVersion,
      source: "newsletter_form",
    });
  });
}
