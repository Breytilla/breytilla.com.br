import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { createElement } from "react";
import { render } from "react-email";
import { z } from "zod";

import { NewsletterEmail } from "@/emails/marketing/newsletter";
import {
  RESEND_UNSUBSCRIBE_PLACEHOLDER,
  type AbsoluteUrl,
  type NewsletterEmailProps,
} from "@/emails/types";
import { getDatabase } from "@/server/email/database";
import { getCampaignEnv } from "@/server/email/env";
import { getMarketingResend } from "@/server/email/resend";

const CAMPAIGN_TEMPLATE_NAME = "newsletter";
const CAMPAIGN_CONTENT_VERSION = "v1" as const;
const PROVIDER_PAGE_LIMIT = 100;
const MAX_PROVIDER_PAGES = 10_000;

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const absoluteHttpUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        Boolean(url.hostname)
      );
    } catch {
      return false;
    }
  }, "Informe uma URL HTTP(S) absoluta.");

const optionalIdSchema = z
  .union([z.literal(""), z.uuid()])
  .optional()
  .transform((value) => value || undefined);

const optionalCtaLabelSchema = z
  .union([z.literal(""), z.string().trim().min(1).max(100)])
  .optional()
  .transform((value) => value?.trim() || undefined);

const optionalCtaUrlSchema = z
  .union([z.literal(""), absoluteHttpUrlSchema])
  .optional()
  .transform((value) => value?.trim() || undefined);

export const campaignInputSchema = z
  .strictObject({
    id: optionalIdSchema,
    campaignKey: slugSchema,
    name: z.string().trim().min(1).max(160),
    subject: z.string().trim().min(1).max(200),
    preheader: z.string().trim().min(1).max(240),
    title: z.string().trim().min(1).max(240),
    intro: z.string().trim().min(1).max(2_000),
    sectionHeading: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(50_000),
    ctaLabel: optionalCtaLabelSchema,
    ctaUrl: optionalCtaUrlSchema,
  })
  .superRefine((input, context) => {
    if (Boolean(input.ctaLabel) === Boolean(input.ctaUrl)) {
      return;
    }

    context.addIssue({
      code: "custom",
      path: [input.ctaLabel ? "ctaUrl" : "ctaLabel"],
      message: "Preencha o texto e a URL do CTA juntos.",
    });
  });

export type CampaignInput = z.input<typeof campaignInputSchema>;
type ValidatedCampaignInput = z.output<typeof campaignInputSchema>;

const campaignContentSchema = z.strictObject({
  version: z.literal(CAMPAIGN_CONTENT_VERSION),
  title: z.string().min(1).max(240),
  intro: z.string().min(1).max(2_000),
  sectionHeading: z.string().min(1).max(200),
  body: z.string().min(1).max(50_000),
  cta: z
    .strictObject({
      label: z.string().min(1).max(100),
      url: absoluteHttpUrlSchema,
    })
    .optional(),
});

export type CampaignContent = z.infer<typeof campaignContentSchema>;

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed";

type CampaignRow = {
  id: string;
  campaign_key: string;
  name: string;
  subject: string;
  preheader: string;
  resend_topic_id: string;
  resend_segment_id: string;
  resend_broadcast_id: string | null;
  status: CampaignStatus;
  scheduled_at: Date | null;
  sent_at: Date | null;
  content: unknown;
  created_at: Date;
  updated_at: Date;
};

type SendCandidateRow = {
  id: string;
  campaign_key: string;
  name: string;
  subject: string;
  preheader: string;
  resend_topic_id: string;
  resend_segment_id: string;
  resend_broadcast_id: string | null;
  status: CampaignStatus;
  content: unknown;
  updated_at: Date;
};

export type Campaign = {
  id: string;
  campaignKey: string;
  name: string;
  subject: string;
  preheader: string;
  topicId: string;
  segmentId: string;
  broadcastId: string | null;
  status: CampaignStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  content: CampaignContent | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CampaignSummary = Omit<Campaign, "content">;

export type CampaignPreview = {
  html: string;
  text: string;
  content: CampaignContent;
};

export type CampaignSendResult = {
  id: string;
  status: "sent";
  sentAt: Date;
  audienceSize: number;
};

export type AdminCampaignErrorCode =
  | "CAMPAIGN_NOT_FOUND"
  | "CAMPAIGN_NOT_DRAFT"
  | "CAMPAIGN_KEY_EXISTS"
  | "CAMPAIGN_KEY_IMMUTABLE"
  | "CAMPAIGN_BROADCAST_MISSING"
  | "CAMPAIGN_CONTENT_INVALID"
  | "CAMPAIGN_VERSION_CHANGED"
  | "CAMPAIGN_CONFIGURATION_CHANGED"
  | "CAMPAIGN_PROVIDER_REJECTED"
  | "CAMPAIGN_PROVIDER_EMPTY_RESPONSE"
  | "CAMPAIGN_AUDIENCE_PAGINATION_FAILED"
  | "CAMPAIGN_AUDIENCE_DRIFT"
  | "CAMPAIGN_CLAIM_FAILED"
  | "CAMPAIGN_SEND_CONFIRMATION_REQUIRED"
  | "CAMPAIGN_SEND_RESULT_UNCERTAIN"
  | "CAMPAIGN_SEND_PERSIST_FAILED"
  | "CAMPAIGN_SAVE_FAILED";

export class AdminCampaignError extends Error {
  constructor(readonly code: AdminCampaignErrorCode) {
    super(code);
    this.name = "AdminCampaignError";
  }
}

type CompiledCampaign = CampaignPreview & {
  input: ValidatedCampaignInput;
};

type ProviderResponse<T> = {
  data: T | null;
  error: { name?: string; statusCode?: number | null } | null;
};

function toCampaignContent(input: ValidatedCampaignInput): CampaignContent {
  return {
    version: CAMPAIGN_CONTENT_VERSION,
    title: input.title,
    intro: input.intro,
    sectionHeading: input.sectionHeading,
    body: input.body,
    ...(input.ctaLabel && input.ctaUrl
      ? {
          cta: {
            label: input.ctaLabel,
            url: input.ctaUrl,
          },
        }
      : {}),
  };
}

function bodyParagraphs(body: string): string[] {
  const paragraphs = body
    .split(/\r?\n(?:[ \t]*\r?\n)+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [body];
}

function toNewsletterProps(
  input: ValidatedCampaignInput,
  content: CampaignContent,
): NewsletterEmailProps {
  return {
    preheader: input.preheader,
    title: content.title,
    intro: content.intro,
    sections: [
      {
        heading: content.sectionHeading,
        paragraphs: bodyParagraphs(content.body),
      },
    ],
    ...(content.cta
      ? {
          cta: {
            label: content.cta.label,
            url: content.cta.url as AbsoluteUrl,
          },
        }
      : {}),
    unsubscribeUrl: RESEND_UNSUBSCRIBE_PLACEHOLDER,
  };
}

async function compileCampaign(
  input: ValidatedCampaignInput,
): Promise<CompiledCampaign> {
  const content = toCampaignContent(input);
  const email = createElement(
    NewsletterEmail,
    toNewsletterProps(input, content),
  );
  const [html, text] = await Promise.all([
    render(email, { pretty: true }),
    render(email, { plainText: true }),
  ]);

  if (
    !html.includes(RESEND_UNSUBSCRIBE_PLACEHOLDER) ||
    !text.includes(RESEND_UNSUBSCRIBE_PLACEHOLDER)
  ) {
    throw new AdminCampaignError("CAMPAIGN_SAVE_FAILED");
  }

  return { input, content, html, text };
}

function parseCampaignContent(value: unknown): CampaignContent | null {
  const result = campaignContentSchema.safeParse(value);
  return result.success ? result.data : null;
}

async function compileStoredCampaign(
  candidate: SendCandidateRow,
): Promise<CompiledCampaign> {
  const content = parseCampaignContent(candidate.content);
  if (!content) {
    throw new AdminCampaignError("CAMPAIGN_CONTENT_INVALID");
  }

  const storedInput = campaignInputSchema.safeParse({
    id: candidate.id,
    campaignKey: candidate.campaign_key,
    name: candidate.name,
    subject: candidate.subject,
    preheader: candidate.preheader,
    title: content.title,
    intro: content.intro,
    sectionHeading: content.sectionHeading,
    body: content.body,
    ctaLabel: content.cta?.label ?? "",
    ctaUrl: content.cta?.url ?? "",
  });
  if (!storedInput.success) {
    throw new AdminCampaignError("CAMPAIGN_CONTENT_INVALID");
  }

  return compileCampaign(storedInput.data);
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    campaignKey: row.campaign_key,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    topicId: row.resend_topic_id,
    segmentId: row.resend_segment_id,
    broadcastId: row.resend_broadcast_id,
    status: row.status,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    content: parseCampaignContent(row.content),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function unwrapProviderResponse<T>(response: ProviderResponse<T>): T {
  if (response.error) {
    throw new AdminCampaignError("CAMPAIGN_PROVIDER_REJECTED");
  }
  if (!response.data) {
    throw new AdminCampaignError("CAMPAIGN_PROVIDER_EMPTY_RESPONSE");
  }
  return response.data;
}

async function insertCampaignAuditEvent(
  transaction: postgres.TransactionSql,
  input: {
    action: string;
    campaignId: string;
    metadata: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await transaction`
    INSERT INTO admin_audit_events (
      id,
      action,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      ${randomUUID()},
      ${input.action},
      ${"campaign"},
      ${input.campaignId},
      ${transaction.json(input.metadata)}
    )
  `;
}

/** Renders the exact HTML/text that will be stored in the Resend draft. */
export async function renderCampaignPreview(
  rawInput: CampaignInput,
): Promise<CampaignPreview> {
  const compiled = await compileCampaign(campaignInputSchema.parse(rawInput));
  return {
    html: compiled.html,
    text: compiled.text,
    content: compiled.content,
  };
}

/** Lists campaigns without loading their editorial JSON payload. */
export async function listCampaigns(): Promise<CampaignSummary[]> {
  const rows = await getDatabase()<CampaignRow[]>`
    SELECT
      id,
      campaign_key,
      name,
      subject,
      preheader,
      resend_topic_id,
      resend_segment_id,
      resend_broadcast_id,
      status,
      scheduled_at,
      sent_at,
      NULL::jsonb AS content,
      created_at,
      updated_at
    FROM campaigns
    ORDER BY updated_at DESC, id DESC
  `;

  return rows.map((row) => {
    const { content, ...summary } = mapCampaign(row);
    void content;
    return summary;
  });
}

/** Loads one campaign, including the validated editorial JSON payload. */
export async function getCampaignById(id: string): Promise<Campaign | null> {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }

  const [row] = await getDatabase()<CampaignRow[]>`
    SELECT
      id,
      campaign_key,
      name,
      subject,
      preheader,
      resend_topic_id,
      resend_segment_id,
      resend_broadcast_id,
      status,
      scheduled_at,
      sent_at,
      content,
      created_at,
      updated_at
    FROM campaigns
    WHERE id = ${id}
    LIMIT 1
  `;

  return row ? mapCampaign(row) : null;
}

/**
 * Creates or updates a local draft and its Resend Broadcast. Row/advisory locks
 * prevent a concurrent send from crossing an in-progress provider update.
 */
export async function saveCampaignDraft(
  rawInput: CampaignInput,
): Promise<Campaign> {
  const compiled = await compileCampaign(campaignInputSchema.parse(rawInput));
  const environment = getCampaignEnv();
  const resend = getMarketingResend();
  const campaignId = compiled.input.id ?? randomUUID();

  return getDatabase().begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtext(${`breytilla_campaign:${compiled.input.campaignKey}`})
      )
    `;

    let existing: CampaignRow | undefined;
    if (compiled.input.id) {
      [existing] = await transaction<CampaignRow[]>`
        SELECT
          id,
          campaign_key,
          name,
          subject,
          preheader,
          resend_topic_id,
          resend_segment_id,
          resend_broadcast_id,
          status,
          scheduled_at,
          sent_at,
          content,
          created_at,
          updated_at
        FROM campaigns
        WHERE id = ${compiled.input.id}
        FOR UPDATE
      `;

      if (!existing) {
        throw new AdminCampaignError("CAMPAIGN_NOT_FOUND");
      }
      if (existing.campaign_key !== compiled.input.campaignKey) {
        throw new AdminCampaignError("CAMPAIGN_KEY_IMMUTABLE");
      }
      if (existing.status !== "draft") {
        throw new AdminCampaignError("CAMPAIGN_NOT_DRAFT");
      }
    } else {
      const [duplicate] = await transaction<{ id: string }[]>`
        SELECT id
        FROM campaigns
        WHERE campaign_key = ${compiled.input.campaignKey}
        FOR UPDATE
      `;
      if (duplicate) {
        throw new AdminCampaignError("CAMPAIGN_KEY_EXISTS");
      }
    }

    let broadcastId = existing?.resend_broadcast_id ?? null;
    if (broadcastId) {
      unwrapProviderResponse(
        await resend.broadcasts.update(broadcastId, {
          name: compiled.input.name,
          segmentId: environment.RESEND_MARKETING_SEGMENT_ID,
          from: environment.EMAIL_MARKETING_FROM,
          replyTo: [environment.EMAIL_REPLY_TO],
          subject: compiled.input.subject,
          previewText: compiled.input.preheader,
          html: compiled.html,
          text: compiled.text,
          topicId: environment.RESEND_MARKETING_TOPIC_ID,
        }),
      );
    } else {
      const created = unwrapProviderResponse(
        await resend.broadcasts.create({
          name: compiled.input.name,
          segmentId: environment.RESEND_MARKETING_SEGMENT_ID,
          from: environment.EMAIL_MARKETING_FROM,
          replyTo: environment.EMAIL_REPLY_TO,
          subject: compiled.input.subject,
          previewText: compiled.input.preheader,
          html: compiled.html,
          text: compiled.text,
          topicId: environment.RESEND_MARKETING_TOPIC_ID,
          send: false,
        }),
      );
      broadcastId = created.id;
    }

    const [saved] = existing
      ? await transaction<CampaignRow[]>`
          UPDATE campaigns
          SET
            name = ${compiled.input.name},
            template_name = ${CAMPAIGN_TEMPLATE_NAME},
            template_version = ${CAMPAIGN_CONTENT_VERSION},
            subject = ${compiled.input.subject},
            preheader = ${compiled.input.preheader},
            resend_topic_id = ${environment.RESEND_MARKETING_TOPIC_ID},
            resend_segment_id = ${environment.RESEND_MARKETING_SEGMENT_ID},
            resend_broadcast_id = ${broadcastId},
            content = ${transaction.json(compiled.content)},
            scheduled_at = NULL,
            sent_at = NULL
          WHERE id = ${campaignId}
            AND status = 'draft'
          RETURNING
            id,
            campaign_key,
            name,
            subject,
            preheader,
            resend_topic_id,
            resend_segment_id,
            resend_broadcast_id,
            status,
            scheduled_at,
            sent_at,
            content,
            created_at,
            updated_at
        `
      : await transaction<CampaignRow[]>`
          INSERT INTO campaigns (
            id,
            campaign_key,
            name,
            template_name,
            template_version,
            subject,
            preheader,
            resend_topic_id,
            resend_segment_id,
            resend_broadcast_id,
            status,
            content
          ) VALUES (
            ${campaignId},
            ${compiled.input.campaignKey},
            ${compiled.input.name},
            ${CAMPAIGN_TEMPLATE_NAME},
            ${CAMPAIGN_CONTENT_VERSION},
            ${compiled.input.subject},
            ${compiled.input.preheader},
            ${environment.RESEND_MARKETING_TOPIC_ID},
            ${environment.RESEND_MARKETING_SEGMENT_ID},
            ${broadcastId},
            ${"draft"},
            ${transaction.json(compiled.content)}
          )
          RETURNING
            id,
            campaign_key,
            name,
            subject,
            preheader,
            resend_topic_id,
            resend_segment_id,
            resend_broadcast_id,
            status,
            scheduled_at,
            sent_at,
            content,
            created_at,
            updated_at
        `;

    if (!saved) {
      throw new AdminCampaignError("CAMPAIGN_SAVE_FAILED");
    }

    await insertCampaignAuditEvent(transaction, {
      action: existing ? "campaign.updated" : "campaign.created",
      campaignId: saved.id,
      metadata: { status: "draft" },
    });

    return mapCampaign(saved);
  });
}

async function assertCampaignAudienceSafe(segmentId: string): Promise<number> {
  const eligibleContacts = await getDatabase()<
    { resend_contact_id: string }[]
  >`
    SELECT resend_contact_id
    FROM contacts
    WHERE resend_contact_id IS NOT NULL
      AND marketing_status = 'subscribed'
      AND marketing_confirmed_at IS NOT NULL
      AND marketing_sync_status = 'synced'
      AND marketing_blocked_reason IS NULL
      AND marketing_last_reconciled_at >= now() - interval '36 hours'
  `;
  const localIds = new Set(
    eligibleContacts.map((contact) => contact.resend_contact_id),
  );
  const providerIds = new Set<string>();
  const resend = getMarketingResend();
  let after: string | undefined;

  for (let pageNumber = 0; pageNumber < MAX_PROVIDER_PAGES; pageNumber += 1) {
    const page = unwrapProviderResponse(
      await resend.contacts.list({
        segmentId,
        limit: PROVIDER_PAGE_LIMIT,
        ...(after ? { after } : {}),
      }),
    );

    for (const contact of page.data) {
      providerIds.add(contact.id);
    }

    if (!page.has_more) {
      break;
    }

    const nextCursor = page.data.at(-1)?.id;
    if (
      !nextCursor ||
      nextCursor === after ||
      pageNumber === MAX_PROVIDER_PAGES - 1
    ) {
      throw new AdminCampaignError("CAMPAIGN_AUDIENCE_PAGINATION_FAILED");
    }
    after = nextCursor;
  }

  for (const providerId of providerIds) {
    if (!localIds.has(providerId)) {
      throw new AdminCampaignError("CAMPAIGN_AUDIENCE_DRIFT");
    }
  }
  for (const localId of localIds) {
    if (!providerIds.has(localId)) {
      throw new AdminCampaignError("CAMPAIGN_AUDIENCE_DRIFT");
    }
  }

  return localIds.size;
}

/**
 * Sends a draft once. The draft-to-sending claim commits before the provider
 * call, so retries cannot duplicate a send. Any non-accepted/unknown provider
 * result intentionally leaves the campaign in `sending` for reconciliation.
 */
export async function sendCampaignNow(
  id: string,
  confirmation: string,
  expectedUpdatedAt: string,
): Promise<CampaignSendResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    throw new AdminCampaignError("CAMPAIGN_NOT_FOUND");
  }
  if (!z.literal("ENVIAR").safeParse(confirmation).success) {
    throw new AdminCampaignError("CAMPAIGN_SEND_CONFIRMATION_REQUIRED");
  }
  const expectedVersion = z.iso.datetime({ offset: true }).safeParse(expectedUpdatedAt);
  if (!expectedVersion.success) {
    throw new AdminCampaignError("CAMPAIGN_VERSION_CHANGED");
  }

  const environment = getCampaignEnv();
  const [candidate] = await getDatabase()<SendCandidateRow[]>`
    SELECT
      id,
      campaign_key,
      name,
      subject,
      preheader,
      resend_topic_id,
      resend_segment_id,
      resend_broadcast_id,
      status,
      content,
      updated_at
    FROM campaigns
    WHERE id = ${parsedId.data}
    LIMIT 1
  `;

  if (!candidate) {
    throw new AdminCampaignError("CAMPAIGN_NOT_FOUND");
  }
  if (candidate.status !== "draft") {
    throw new AdminCampaignError("CAMPAIGN_NOT_DRAFT");
  }
  if (!candidate.resend_broadcast_id) {
    throw new AdminCampaignError("CAMPAIGN_BROADCAST_MISSING");
  }
  const compiled = await compileStoredCampaign(candidate);
  if (
    new Date(candidate.updated_at).toISOString() !==
    new Date(expectedVersion.data).toISOString()
  ) {
    throw new AdminCampaignError("CAMPAIGN_VERSION_CHANGED");
  }
  if (
    candidate.resend_segment_id !== environment.RESEND_MARKETING_SEGMENT_ID ||
    candidate.resend_topic_id !== environment.RESEND_MARKETING_TOPIC_ID
  ) {
    throw new AdminCampaignError("CAMPAIGN_CONFIGURATION_CHANGED");
  }

  const audienceSize = await assertCampaignAudienceSafe(
    environment.RESEND_MARKETING_SEGMENT_ID,
  );

  // Rebuild and synchronize from the exact persisted version shown on the
  // review screen. The optimistic claim below prevents sending if the row
  // changes while this provider update is in flight.
  unwrapProviderResponse(
    await getMarketingResend().broadcasts.update(
      candidate.resend_broadcast_id,
      {
        name: candidate.name,
        segmentId: environment.RESEND_MARKETING_SEGMENT_ID,
        from: environment.EMAIL_MARKETING_FROM,
        replyTo: [environment.EMAIL_REPLY_TO],
        subject: candidate.subject,
        previewText: candidate.preheader,
        html: compiled.html,
        text: compiled.text,
        topicId: environment.RESEND_MARKETING_TOPIC_ID,
      },
    ),
  );

  const claimed = await getDatabase().begin(async (transaction) => {
    const [row] = await transaction<SendCandidateRow[]>`
      UPDATE campaigns
      SET status = 'sending'
      WHERE id = ${candidate.id}
        AND status = 'draft'
        AND resend_broadcast_id = ${candidate.resend_broadcast_id}
        AND resend_segment_id = ${environment.RESEND_MARKETING_SEGMENT_ID}
        AND resend_topic_id = ${environment.RESEND_MARKETING_TOPIC_ID}
        AND updated_at = ${new Date(expectedVersion.data)}
      RETURNING
        id,
        campaign_key,
        name,
        subject,
        preheader,
        resend_topic_id,
        resend_segment_id,
        resend_broadcast_id,
        status,
        content,
        updated_at
    `;

    if (!row?.resend_broadcast_id) {
      throw new AdminCampaignError("CAMPAIGN_CLAIM_FAILED");
    }

    await insertCampaignAuditEvent(transaction, {
      action: "campaign.send_claimed",
      campaignId: row.id,
      metadata: { status: "sending", audienceSize },
    });
    return row;
  });

  let acceptedBroadcastId: string;
  try {
    const response = await getMarketingResend().broadcasts.send(
      claimed.resend_broadcast_id!,
    );
    if (response.error || !response.data) {
      throw new AdminCampaignError("CAMPAIGN_SEND_RESULT_UNCERTAIN");
    }
    acceptedBroadcastId = response.data.id;
  } catch {
    throw new AdminCampaignError("CAMPAIGN_SEND_RESULT_UNCERTAIN");
  }

  if (acceptedBroadcastId !== claimed.resend_broadcast_id) {
    throw new AdminCampaignError("CAMPAIGN_SEND_RESULT_UNCERTAIN");
  }

  return getDatabase().begin(async (transaction) => {
    const [sent] = await transaction<{ id: string; sent_at: Date }[]>`
      UPDATE campaigns
      SET
        status = 'sent',
        scheduled_at = NULL,
        sent_at = now()
      WHERE id = ${claimed.id}
        AND status = 'sending'
        AND resend_broadcast_id = ${acceptedBroadcastId}
      RETURNING id, sent_at
    `;

    if (!sent) {
      throw new AdminCampaignError("CAMPAIGN_SEND_PERSIST_FAILED");
    }

    await insertCampaignAuditEvent(transaction, {
      action: "campaign.sent",
      campaignId: sent.id,
      metadata: { status: "sent", audienceSize },
    });

    return {
      id: sent.id,
      status: "sent" as const,
      sentAt: new Date(sent.sent_at),
      audienceSize,
    };
  });
}
