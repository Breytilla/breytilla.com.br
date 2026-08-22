import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

const appEnvSchema = z.object({
  APP_URL: z.string().url(),
});

const cronEnvSchema = z.object({
  CRON_SECRET: z.string().min(16),
});

const outboxEncryptionEnvSchema = z.object({
  EMAIL_OUTBOX_ENCRYPTION_KEY: z.string().min(32),
});

const transactionalEnvSchema = z.object({
  RESEND_TRANSACTIONAL_API_KEY: z.string().min(1),
  EMAIL_TRANSACTIONAL_FROM: z.string().min(3),
  EMAIL_REPLY_TO: z.string().email(),
});

const marketingEnvSchema = z.object({
  RESEND_MARKETING_API_KEY: z.string().min(1),
  RESEND_MARKETING_TOPIC_ID: z.string().min(1),
  RESEND_MARKETING_SEGMENT_ID: z.string().min(1),
});

const campaignEnvSchema = marketingEnvSchema.extend({
  EMAIL_MARKETING_FROM: z.string().min(3),
  EMAIL_REPLY_TO: z.string().email(),
});

const webhookEnvSchema = z.object({
  RESEND_WEBHOOK_SECRET: z.string().min(1),
});

const internalRecipientEnvSchema = z.object({
  EMAIL_INTERNAL_TO: z.string().email(),
});

type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
type AppEnv = z.infer<typeof appEnvSchema>;
type CronEnv = z.infer<typeof cronEnvSchema>;
type OutboxEncryptionEnv = z.infer<typeof outboxEncryptionEnvSchema>;
type TransactionalEnv = z.infer<typeof transactionalEnvSchema>;
type MarketingEnv = z.infer<typeof marketingEnvSchema>;
type CampaignEnv = z.infer<typeof campaignEnvSchema>;
type WebhookEnv = z.infer<typeof webhookEnvSchema>;

let databaseEnv: DatabaseEnv | undefined;
let appEnv: AppEnv | undefined;
let cronEnv: CronEnv | undefined;
let outboxEncryptionEnv: OutboxEncryptionEnv | undefined;
let transactionalEnv: TransactionalEnv | undefined;
let marketingEnv: MarketingEnv | undefined;
let campaignEnv: CampaignEnv | undefined;
let webhookEnv: WebhookEnv | undefined;

/** Reads database configuration on first runtime use, never during module load. */
export function getDatabaseEnv(): DatabaseEnv {
  databaseEnv ??= databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL ?? process.env.POSTGRES_URL,
  });
  return databaseEnv;
}

/** Reads the canonical public URL on first runtime use. */
export function getAppEnv(): AppEnv {
  appEnv ??= appEnvSchema.parse(process.env);
  return appEnv;
}

/** Reads the scheduler credential independently from all other settings. */
export function getCronEnv(): CronEnv {
  cronEnv ??= cronEnvSchema.parse(process.env);
  return cronEnv;
}

/** Reads the stable key dedicated to encrypted outbox payloads. */
export function getOutboxEncryptionEnv(): OutboxEncryptionEnv {
  outboxEncryptionEnv ??= outboxEncryptionEnvSchema.parse(process.env);
  return outboxEncryptionEnv;
}

/** Reads only the transactional sending credentials required by the worker. */
export function getTransactionalEnv(): TransactionalEnv {
  transactionalEnv ??= transactionalEnvSchema.parse(process.env);
  return transactionalEnv;
}

/** Reads the Resend audience identifiers only when marketing sync is needed. */
export function getMarketingEnv(): MarketingEnv {
  marketingEnv ??= marketingEnvSchema.parse(process.env);
  return marketingEnv;
}

/** Reads the sender and audience settings required to manage Broadcast drafts. */
export function getCampaignEnv(): CampaignEnv {
  campaignEnv ??= campaignEnvSchema.parse(process.env);
  return campaignEnv;
}

/** Reads the credentials required to authenticate a Resend webhook. */
export function getWebhookEnv(): WebhookEnv {
  webhookEnv ??= webhookEnvSchema.parse(process.env);
  return webhookEnv;
}

/** Returns the inbox that receives internal contact notifications. */
export function getInternalRecipient(): string {
  return internalRecipientEnvSchema.parse(process.env).EMAIL_INTERNAL_TO;
}
