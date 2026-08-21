import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { render } from "react-email";
import { Resend, type ErrorResponse } from "resend";
import { z } from "zod";

import { NewsletterEmail } from "../src/emails/marketing/newsletter";
import {
  RESEND_UNSUBSCRIBE_PLACEHOLDER,
  type AbsoluteUrl,
  type NewsletterEmailProps,
} from "../src/emails/types";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectDirectory, "out", "email-campaigns");
const MAX_SCHEDULE_LEAD_MS = 30 * 60 * 1_000;

const slugSchema = z
  .string()
  .trim()
  .min(1, "é obrigatório")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "deve ser um slug em minúsculas, com números e hífens",
  );

const requiredTextSchema = z.string().trim().min(1, "não pode estar vazio");

const absoluteHttpUrlSchema = requiredTextSchema.refine((value) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}, "deve ser uma URL HTTP(S) absoluta");

const campaignManifestSchema = z
  .object({
    campaignKey: slugSchema,
    name: requiredTextSchema,
    templateVersion: requiredTextSchema,
    subject: requiredTextSchema,
    preheader: requiredTextSchema,
    title: requiredTextSchema,
    intro: requiredTextSchema,
    sections: z
      .array(
        z
          .object({
            heading: requiredTextSchema,
            paragraphs: z.array(requiredTextSchema).min(1),
          })
          .strict(),
      )
      .min(1),
    cta: z
      .object({
        label: requiredTextSchema,
        url: absoluteHttpUrlSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

const runtimeEnvironmentSchema = z.object({
  DATABASE_URL: requiredTextSchema,
  RESEND_MARKETING_API_KEY: requiredTextSchema,
  EMAIL_MARKETING_FROM: requiredTextSchema,
  EMAIL_REPLY_TO: z.string().trim().email(),
  RESEND_MARKETING_SEGMENT_ID: requiredTextSchema,
  RESEND_MARKETING_TOPIC_ID: requiredTextSchema,
});

const isoDateTimeSchema = z
  .iso.datetime({ offset: true })
  .refine(
    (value) => new Date(value).getTime() > Date.now(),
    "deve representar um instante futuro",
  );

type CampaignManifest = z.infer<typeof campaignManifestSchema>;
type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

type CampaignRow = {
  campaign_key: string;
  resend_broadcast_id: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";
};

type CompiledCampaign = {
  manifest: CampaignManifest;
  html: string;
  text: string;
};

class CampaignCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignCliError";
  }
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join(".") : "manifesto";
      return `- ${field}: ${issue.message}`;
    })
    .join("\n");
}

async function readManifest(manifestPath: string): Promise<CampaignManifest> {
  const absolutePath = resolve(process.cwd(), manifestPath);
  let source: string;

  try {
    source = await readFile(absolutePath, "utf8");
  } catch {
    throw new CampaignCliError(`Não foi possível ler o manifesto: ${absolutePath}`);
  }

  let json: unknown;

  try {
    json = JSON.parse(source);
  } catch {
    throw new CampaignCliError(`O manifesto não contém JSON válido: ${absolutePath}`);
  }

  const result = campaignManifestSchema.safeParse(json);

  if (!result.success) {
    throw new CampaignCliError(
      `Manifesto de campanha inválido:\n${formatZodError(result.error)}`,
    );
  }

  return result.data;
}

function toNewsletterProps(manifest: CampaignManifest): NewsletterEmailProps {
  return {
    preheader: manifest.preheader,
    title: manifest.title,
    intro: manifest.intro,
    sections: manifest.sections,
    cta: manifest.cta
      ? {
          label: manifest.cta.label,
          url: manifest.cta.url as AbsoluteUrl,
        }
      : undefined,
    unsubscribeUrl: RESEND_UNSUBSCRIBE_PLACEHOLDER,
  };
}

async function compileCampaign(
  manifestPath: string,
): Promise<CompiledCampaign> {
  const manifest = await readManifest(manifestPath);
  const email = <NewsletterEmail {...toNewsletterProps(manifest)} />;
  const [html, text] = await Promise.all([
    render(email, { pretty: true }),
    render(email, { plainText: true }),
  ]);

  return { manifest, html, text };
}

function assertUnsubscribePlaceholder({ html, text }: CompiledCampaign): void {
  if (
    !html.includes(RESEND_UNSUBSCRIBE_PLACEHOLDER) ||
    !text.includes(RESEND_UNSUBSCRIBE_PLACEHOLDER)
  ) {
    throw new CampaignCliError(
      `A campanha deve conter o placeholder literal ${RESEND_UNSUBSCRIBE_PLACEHOLDER} nas versões HTML e texto.`,
    );
  }
}

async function previewCampaign(manifestPath: string): Promise<void> {
  const campaign = await compileCampaign(manifestPath);
  assertUnsubscribePlaceholder(campaign);
  await mkdir(outputDirectory, { recursive: true });

  const htmlPath = resolve(
    outputDirectory,
    `${campaign.manifest.campaignKey}.html`,
  );
  const textPath = resolve(
    outputDirectory,
    `${campaign.manifest.campaignKey}.txt`,
  );

  await Promise.all([
    writeFile(htmlPath, campaign.html, "utf8"),
    writeFile(textPath, `${campaign.text.trim()}\n`, "utf8"),
  ]);

  console.log(`Preview HTML: ${htmlPath}`);
  console.log(`Preview texto: ${textPath}`);
}

function loadRuntimeEnvironment(): RuntimeEnvironment {
  loadEnvConfig(projectDirectory);
  const result = runtimeEnvironmentSchema.safeParse({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? process.env.POSTGRES_URL,
  });

  if (!result.success) {
    throw new CampaignCliError(
      `Configuração de campanha incompleta:\n${formatZodError(result.error)}`,
    );
  }

  return result.data;
}

function createDatabase(databaseUrl: string) {
  return postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
    max_lifetime: 60,
    prepare: false,
  });
}

function unwrapResendResponse<T>(response: {
  data: T | null;
  error: ErrorResponse | null;
}): T {
  if (response.error) {
    const httpStatus = response.error.statusCode
      ? `, HTTP ${response.error.statusCode}`
      : "";
    throw new CampaignCliError(
      `O Resend recusou a operação (${response.error.name}${httpStatus}): ${response.error.message}`,
    );
  }

  if (!response.data) {
    throw new CampaignCliError("O Resend respondeu sem dados e sem erro.");
  }

  return response.data;
}

/**
 * Compares the actual Resend Segment with the locally-confirmed, recently
 * reconciled audience. Any provider error or drift aborts the send.
 */
async function assertCampaignAudienceSafe(
  sql: ReturnType<typeof postgres>,
  resend: Resend,
  segmentId: string,
): Promise<void> {
  const eligibleContacts = await sql<{ resend_contact_id: string }[]>`
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
  let after: string | undefined;

  for (let pageNumber = 0; pageNumber < 10_000; pageNumber += 1) {
    const page = unwrapResendResponse(
      await resend.contacts.list({
        segmentId,
        limit: 100,
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
    if (!nextCursor || nextCursor === after || pageNumber === 9_999) {
      throw new CampaignCliError(
        "Não foi possível concluir a paginação do Segment do Resend.",
      );
    }
    after = nextCursor;
  }

  let unexpectedAtProvider = 0;
  let missingAtProvider = 0;

  for (const providerId of providerIds) {
    if (!localIds.has(providerId)) {
      unexpectedAtProvider += 1;
    }
  }
  for (const localId of localIds) {
    if (!providerIds.has(localId)) {
      missingAtProvider += 1;
    }
  }

  if (unexpectedAtProvider > 0 || missingAtProvider > 0) {
    throw new CampaignCliError(
      "Preflight bloqueou o envio: o Segment diverge da audiência local " +
        `(${unexpectedAtProvider} contato(s) inesperado(s), ` +
        `${missingAtProvider} ausente(s)). Rode a reconciliação e tente novamente.`,
    );
  }

  console.log(`Preflight de audiência aprovado: ${localIds.size} contato(s).`);
}

async function claimCampaignAction(
  sql: ReturnType<typeof postgres>,
  campaignKey: string,
): Promise<void> {
  const claimed = await sql<{ campaign_key: string }[]>`
    UPDATE campaigns
    SET status = 'sending'
    WHERE campaign_key = ${campaignKey}
      AND status = 'draft'
    RETURNING campaign_key
  `;

  if (claimed.length === 0) {
    throw new CampaignCliError(
      "A campanha deixou de estar em draft durante o preflight. Nenhum envio foi iniciado.",
    );
  }
}

async function findCampaign(
  sql: ReturnType<typeof postgres>,
  campaignKey: string,
): Promise<CampaignRow | undefined> {
  const rows = await sql<CampaignRow[]>`
    SELECT campaign_key, resend_broadcast_id, status
    FROM campaigns
    WHERE campaign_key = ${campaignKey}
    LIMIT 1
  `;

  return rows[0];
}

async function upsertDraft(
  sql: ReturnType<typeof postgres>,
  campaign: CompiledCampaign,
  environment: RuntimeEnvironment,
  broadcastId: string,
): Promise<void> {
  const { manifest } = campaign;

  await sql`
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
      scheduled_at,
      sent_at
    ) VALUES (
      ${randomUUID()},
      ${manifest.campaignKey},
      ${manifest.name},
      ${"newsletter"},
      ${manifest.templateVersion},
      ${manifest.subject},
      ${manifest.preheader},
      ${environment.RESEND_MARKETING_TOPIC_ID},
      ${environment.RESEND_MARKETING_SEGMENT_ID},
      ${broadcastId},
      ${"draft"},
      NULL,
      NULL
    )
    ON CONFLICT (campaign_key) DO UPDATE SET
      name = EXCLUDED.name,
      template_name = EXCLUDED.template_name,
      template_version = EXCLUDED.template_version,
      subject = EXCLUDED.subject,
      preheader = EXCLUDED.preheader,
      resend_topic_id = EXCLUDED.resend_topic_id,
      resend_segment_id = EXCLUDED.resend_segment_id,
      resend_broadcast_id = EXCLUDED.resend_broadcast_id,
      status = EXCLUDED.status,
      scheduled_at = NULL,
      sent_at = NULL
  `;
}

async function draftCampaign(manifestPath: string): Promise<void> {
  const campaign = await compileCampaign(manifestPath);
  assertUnsubscribePlaceholder(campaign);

  const environment = loadRuntimeEnvironment();
  const resend = new Resend(environment.RESEND_MARKETING_API_KEY);
  const sql = createDatabase(environment.DATABASE_URL);

  try {
    const existing = await findCampaign(sql, campaign.manifest.campaignKey);

    if (existing && existing.status !== "draft") {
      throw new CampaignCliError(
        `A campanha ${existing.campaign_key} está com status ${existing.status} e não pode ser substituída por um draft.`,
      );
    }

    let broadcastId: string;

    if (existing?.resend_broadcast_id && existing.status === "draft") {
      const response = await resend.broadcasts.update(
        existing.resend_broadcast_id,
        {
          name: campaign.manifest.name,
          segmentId: environment.RESEND_MARKETING_SEGMENT_ID,
          from: environment.EMAIL_MARKETING_FROM,
          replyTo: [environment.EMAIL_REPLY_TO],
          subject: campaign.manifest.subject,
          previewText: campaign.manifest.preheader,
          html: campaign.html,
          text: campaign.text,
          topicId: environment.RESEND_MARKETING_TOPIC_ID,
        },
      );
      unwrapResendResponse(response);
      broadcastId = existing.resend_broadcast_id;
    } else {
      const response = await resend.broadcasts.create({
        name: campaign.manifest.name,
        segmentId: environment.RESEND_MARKETING_SEGMENT_ID,
        from: environment.EMAIL_MARKETING_FROM,
        replyTo: environment.EMAIL_REPLY_TO,
        subject: campaign.manifest.subject,
        previewText: campaign.manifest.preheader,
        html: campaign.html,
        text: campaign.text,
        topicId: environment.RESEND_MARKETING_TOPIC_ID,
        send: false,
      });
      broadcastId = unwrapResendResponse(response).id;
    }

    await upsertDraft(sql, campaign, environment, broadcastId);
    console.log(
      `Draft ${campaign.manifest.campaignKey} pronto no Resend (${broadcastId}).`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function parseCampaignKey(value: string | undefined): string {
  const result = slugSchema.safeParse(value);

  if (!result.success) {
    throw new CampaignCliError("Informe um campaignKey válido.");
  }

  return result.data;
}

function requireConfirmation(
  args: readonly string[],
  campaignKey: string,
): void {
  if (
    args.length !== 2 ||
    args[0] !== "--confirm" ||
    args[1] !== campaignKey
  ) {
    throw new CampaignCliError(
      `Confirmação ausente. Repita o campaignKey: --confirm ${campaignKey}`,
    );
  }
}

async function loadActionCampaign(
  sql: ReturnType<typeof postgres>,
  campaignKey: string,
): Promise<CampaignRow> {
  const campaign = await findCampaign(sql, campaignKey);

  if (!campaign) {
    throw new CampaignCliError(
      `Campanha ${campaignKey} não encontrada no banco de dados.`,
    );
  }

  if (!campaign.resend_broadcast_id) {
    throw new CampaignCliError(
      `Campanha ${campaignKey} não possui um Broadcast associado.`,
    );
  }

  return campaign;
}

async function scheduleCampaign(
  campaignKeyInput: string | undefined,
  scheduledAtInput: string | undefined,
  confirmationArgs: readonly string[],
): Promise<void> {
  const campaignKey = parseCampaignKey(campaignKeyInput);
  const scheduledAtResult = isoDateTimeSchema.safeParse(scheduledAtInput);

  if (!scheduledAtResult.success) {
    throw new CampaignCliError(
      "Informe uma data ISO 8601 válida, com fuso e no futuro.",
    );
  }

  requireConfirmation(confirmationArgs, campaignKey);
  const scheduledAt = new Date(scheduledAtResult.data).toISOString();
  if (new Date(scheduledAt).getTime() - Date.now() > MAX_SCHEDULE_LEAD_MS) {
    throw new CampaignCliError(
      "Por segurança, agende no máximo 30 minutos antes do envio para que o preflight de consentimento permaneça atual.",
    );
  }
  const environment = loadRuntimeEnvironment();
  const resend = new Resend(environment.RESEND_MARKETING_API_KEY);
  const sql = createDatabase(environment.DATABASE_URL);

  try {
    const campaign = await loadActionCampaign(sql, campaignKey);

    if (campaign.status !== "draft") {
      throw new CampaignCliError(
        `Somente um draft pode ser agendado; status atual: ${campaign.status}.`,
      );
    }

    await assertCampaignAudienceSafe(
      sql,
      resend,
      environment.RESEND_MARKETING_SEGMENT_ID,
    );
    await claimCampaignAction(sql, campaignKey);

    unwrapResendResponse(
      await resend.broadcasts.send(campaign.resend_broadcast_id!, {
        scheduledAt,
      }),
    );

    await sql`
      UPDATE campaigns
      SET status = ${"scheduled"}, scheduled_at = ${scheduledAt}, sent_at = NULL
      WHERE campaign_key = ${campaignKey}
    `;

    console.log(`Campanha ${campaignKey} agendada para ${scheduledAt}.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function sendCampaign(
  campaignKeyInput: string | undefined,
  confirmationArgs: readonly string[],
): Promise<void> {
  const campaignKey = parseCampaignKey(campaignKeyInput);
  requireConfirmation(confirmationArgs, campaignKey);
  const environment = loadRuntimeEnvironment();
  const resend = new Resend(environment.RESEND_MARKETING_API_KEY);
  const sql = createDatabase(environment.DATABASE_URL);

  try {
    const campaign = await loadActionCampaign(sql, campaignKey);

    if (campaign.status !== "draft") {
      throw new CampaignCliError(
        `Somente um draft pode ser enviado; status atual: ${campaign.status}.`,
      );
    }

    await assertCampaignAudienceSafe(
      sql,
      resend,
      environment.RESEND_MARKETING_SEGMENT_ID,
    );
    await claimCampaignAction(sql, campaignKey);

    unwrapResendResponse(
      await resend.broadcasts.send(campaign.resend_broadcast_id!),
    );

    await sql`
      UPDATE campaigns
      SET status = ${"sent"}, scheduled_at = NULL, sent_at = now()
      WHERE campaign_key = ${campaignKey}
    `;

    console.log(`Envio da campanha ${campaignKey} aceito pelo Resend.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function cancelCampaign(
  campaignKeyInput: string | undefined,
): Promise<void> {
  const campaignKey = parseCampaignKey(campaignKeyInput);
  const environment = loadRuntimeEnvironment();
  const resend = new Resend(environment.RESEND_MARKETING_API_KEY);
  const sql = createDatabase(environment.DATABASE_URL);

  try {
    const campaign = await loadActionCampaign(sql, campaignKey);

    if (campaign.status !== "scheduled") {
      throw new CampaignCliError(
        `Somente uma campanha agendada pode ser cancelada; status atual: ${campaign.status}.`,
      );
    }

    unwrapResendResponse(
      await resend.broadcasts.cancel(campaign.resend_broadcast_id!),
    );

    await sql`
      UPDATE campaigns
      SET status = ${"cancelled"}
      WHERE campaign_key = ${campaignKey}
    `;

    console.log(`Campanha ${campaignKey} cancelada.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function printUsage(): void {
  console.log(`Uso:
  npm run email:campaign -- preview <manifest.json>
  npm run email:campaign -- draft <manifest.json>
  npm run email:campaign -- schedule <campaignKey> <ISO> --confirm <campaignKey>
  npm run email:campaign -- send <campaignKey> --confirm <campaignKey>
  npm run email:campaign -- cancel <campaignKey>`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "preview":
      if (args.length !== 1) {
        throw new CampaignCliError("O comando preview requer um manifesto.");
      }
      await previewCampaign(args[0]);
      return;
    case "draft":
      if (args.length !== 1) {
        throw new CampaignCliError("O comando draft requer um manifesto.");
      }
      await draftCampaign(args[0]);
      return;
    case "schedule":
      if (args.length !== 4) {
        throw new CampaignCliError(
          "O comando schedule requer campaignKey, data ISO e confirmação.",
        );
      }
      await scheduleCampaign(args[0], args[1], args.slice(2));
      return;
    case "send":
      if (args.length !== 3) {
        throw new CampaignCliError(
          "O comando send requer campaignKey e confirmação.",
        );
      }
      await sendCampaign(args[0], args.slice(1));
      return;
    case "cancel":
      if (args.length !== 1) {
        throw new CampaignCliError("O comando cancel requer um campaignKey.");
      }
      await cancelCampaign(args[0]);
      return;
    case "--help":
    case "-h":
    case "help":
      printUsage();
      return;
    default:
      printUsage();
      throw new CampaignCliError("Comando de campanha inválido.");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  console.error(`Erro: ${message}`);
  process.exitCode = 1;
});
