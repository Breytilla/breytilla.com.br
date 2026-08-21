import { randomUUID } from "node:crypto";
import type postgres from "postgres";

import { decryptOutboxPayload, encryptOutboxPayload } from "./crypto";
import { getDatabase } from "./database";
import { getTransactionalEnv } from "./env";
import { EmailProviderError, getTransactionalResend } from "./resend";
import { renderTransactionalTemplate } from "./templates";

export type EmailPayloadByTemplate = {
  "contact-request-received": {
    name: string;
  };
  "contact-request-internal": {
    name: string;
    email: string;
    phone?: string;
    preferredChannel: "email" | "whatsapp" | "phone";
    requestId: string;
    submittedAt: string;
  };
  "newsletter-confirm-opt-in": {
    name?: string;
    confirmationUrl: string;
  };
};

export type TransactionalTemplateName = keyof EmailPayloadByTemplate;

type EnqueueEmailInput<T extends TransactionalTemplateName> = {
  eventId: string;
  template: T;
  recipient: string;
  payload: EmailPayloadByTemplate[T];
};

type OutboxRow = {
  id: string;
  event_id: string;
  template_name: TransactionalTemplateName;
  template_version: string;
  recipient_email: string;
  encrypted_payload: string;
  attempts: number;
};

const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
] as const;

const OUTBOX_BATCH_SIZE = 25;
const DELIVERY_CONCURRENCY = 5;

/** Adds a typed transactional message to the database outbox. */
export async function enqueueEmail<T extends TransactionalTemplateName>(
  transaction: postgres.TransactionSql,
  input: EnqueueEmailInput<T>,
): Promise<void> {
  await transaction`
    INSERT INTO email_outbox (
      id,
      event_id,
      stream,
      template_name,
      template_version,
      recipient_email,
      encrypted_payload
    ) VALUES (
      ${randomUUID()},
      ${input.eventId},
      'transactional',
      ${input.template},
      'v1',
      ${input.recipient},
      ${encryptOutboxPayload(input.payload)}
    )
    ON CONFLICT (event_id) DO NOTHING
  `;
}

async function claimOutboxBatch(): Promise<OutboxRow[]> {
  const database = getDatabase();

  return database.begin(async (transaction) => {
    return transaction<OutboxRow[]>`
      WITH dispatchable AS (
        SELECT id
        FROM email_outbox
        WHERE (
          status IN ('pending', 'retrying')
          AND next_attempt_at <= now()
        ) OR (
          status = 'processing'
          AND locked_at < now() - interval '15 minutes'
        )
        ORDER BY next_attempt_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${OUTBOX_BATCH_SIZE}
      )
      UPDATE email_outbox AS outbox
      SET
        status = 'processing',
        locked_at = now(),
        attempts = outbox.attempts + 1,
        last_error_code = NULL
      FROM dispatchable
      WHERE outbox.id = dispatchable.id
      RETURNING
        outbox.id,
        outbox.event_id,
        outbox.template_name,
        outbox.template_version,
        outbox.recipient_email,
        outbox.encrypted_payload,
        outbox.attempts
    `;
  });
}

function safeErrorCode(error: unknown): string {
  if (error instanceof EmailProviderError) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  }
  return "UNKNOWN_ERROR";
}

async function markOutboxFailure(row: OutboxRow, error: unknown): Promise<void> {
  const retryDelay = RETRY_DELAYS_MS[row.attempts - 1];
  const errorCode = safeErrorCode(error);

  if (retryDelay !== undefined) {
    await getDatabase()`
      UPDATE email_outbox
      SET
        status = 'retrying',
        next_attempt_at = ${new Date(Date.now() + retryDelay)},
        locked_at = NULL,
        last_error_code = ${errorCode}
      WHERE id = ${row.id}
        AND status = 'processing'
    `;
    return;
  }

  await getDatabase()`
    UPDATE email_outbox
    SET
      status = 'failed',
      locked_at = NULL,
      last_error_code = ${errorCode}
    WHERE id = ${row.id}
      AND status = 'processing'
  `;
}

async function deliverOutboxRow(row: OutboxRow): Promise<boolean> {
  try {
    const payload = decryptOutboxPayload(row.encrypted_payload);
    const rendered = await renderTransactionalTemplate(
      row.template_name,
      payload,
    );
    const { EMAIL_TRANSACTIONAL_FROM, EMAIL_REPLY_TO } =
      getTransactionalEnv();

    const result = await getTransactionalResend().emails.send(
      {
        from: EMAIL_TRANSACTIONAL_FROM,
        to: row.recipient_email,
        replyTo: EMAIL_REPLY_TO,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: [
          { name: "stream", value: "transactional" },
          { name: "template", value: row.template_name },
          { name: "version", value: row.template_version },
          { name: "outbox_id", value: row.id },
        ],
      },
      { idempotencyKey: `transactional/${row.event_id}`.slice(0, 256) },
    );

    if (result.error) {
      throw new EmailProviderError(
        `RESEND_${result.error.statusCode ?? "ERROR"}_${result.error.name}`,
      );
    }
    if (!result.data?.id) {
      throw new EmailProviderError("RESEND_EMAIL_ID_MISSING");
    }

    await getDatabase()`
      UPDATE email_outbox
      SET
        status = 'sent',
        resend_email_id = ${result.data.id},
        sent_at = now(),
        locked_at = NULL,
        last_error_code = NULL
      WHERE id = ${row.id}
        AND status = 'processing'
    `;

    return true;
  } catch (error) {
    await markOutboxFailure(row, error);
    return false;
  }
}

/** Claims and dispatches one bounded batch, safe for concurrent cron invocations. */
export async function processEmailOutbox(): Promise<{
  claimed: number;
  sent: number;
  failedOrRetried: number;
}> {
  const rows = await claimOutboxBatch();
  let sent = 0;

  for (let index = 0; index < rows.length; index += DELIVERY_CONCURRENCY) {
    const chunk = rows.slice(index, index + DELIVERY_CONCURRENCY);
    const results = await Promise.all(chunk.map(deliverOutboxRow));
    sent += results.filter(Boolean).length;
  }

  return {
    claimed: rows.length,
    sent,
    failedOrRetried: rows.length - sent,
  };
}
