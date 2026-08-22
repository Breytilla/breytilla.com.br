import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const errors = [];
const warnings = [];

function value(name) {
  const current = process.env[name]?.trim();
  return current ? current : undefined;
}

function firstValue(names) {
  for (const name of names) {
    const current = value(name);
    if (current) return { name, value: current };
  }
  return undefined;
}

function requireValue(name) {
  const current = value(name);
  if (!current) errors.push(`${name}: ausente`);
  return current;
}

function validateUrl(name, current, protocols) {
  if (!current) return;

  try {
    const parsed = new URL(current);
    if (!protocols.includes(parsed.protocol)) {
      errors.push(`${name}: protocolo deve ser ${protocols.join(" ou ")}`);
    }
    if (!parsed.hostname) errors.push(`${name}: host ausente`);
  } catch {
    errors.push(`${name}: URL inv\u00e1lida`);
  }
}

const appUrl = requireValue("APP_URL");
validateUrl("APP_URL", appUrl, ["https:", "http:"]);
if (appUrl?.startsWith("http://") && !appUrl.includes("localhost")) {
  errors.push("APP_URL: use HTTPS fora do desenvolvimento local");
}

const runtimeDatabase = firstValue(["DATABASE_URL", "POSTGRES_URL"]);
if (!runtimeDatabase) {
  errors.push("DATABASE_URL ou POSTGRES_URL: ausente");
} else {
  validateUrl(runtimeDatabase.name, runtimeDatabase.value, [
    "postgres:",
    "postgresql:",
  ]);
}

const migrationDatabase = firstValue([
  "DATABASE_MIGRATION_URL",
  "POSTGRES_URL_NON_POOLING",
]);
if (!migrationDatabase) {
  warnings.push(
    "DATABASE_MIGRATION_URL/POSTGRES_URL_NON_POOLING ausente: o site pode rodar, mas db:migrate ser\u00e1 bloqueado",
  );
} else {
  validateUrl(migrationDatabase.name, migrationDatabase.value, [
    "postgres:",
    "postgresql:",
  ]);
}

const requiredNames = [
  "RESEND_TRANSACTIONAL_API_KEY",
  "RESEND_MARKETING_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "EMAIL_TRANSACTIONAL_FROM",
  "EMAIL_MARKETING_FROM",
  "EMAIL_REPLY_TO",
  "EMAIL_INTERNAL_TO",
  "RESEND_MARKETING_TOPIC_ID",
  "RESEND_MARKETING_SEGMENT_ID",
];

for (const name of requiredNames) requireValue(name);

const cronSecret = requireValue("CRON_SECRET");
if (cronSecret && cronSecret.length < 32) {
  errors.push("CRON_SECRET: use pelo menos 32 caracteres aleat\u00f3rios");
}

const encryptionKey = requireValue("EMAIL_OUTBOX_ENCRYPTION_KEY");
if (encryptionKey && encryptionKey.length < 32) {
  errors.push(
    "EMAIL_OUTBOX_ENCRYPTION_KEY: use pelo menos 32 caracteres aleat\u00f3rios",
  );
}
if (cronSecret && encryptionKey && cronSecret === encryptionKey) {
  errors.push("CRON_SECRET e EMAIL_OUTBOX_ENCRYPTION_KEY devem ser distintos");
}

const adminRouteKey = requireValue("ADMIN_ROUTE_KEY");
if (
  adminRouteKey &&
  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(adminRouteKey)
) {
  errors.push(
    "ADMIN_ROUTE_KEY: use letras minúsculas, números e hífens, sem barras ou espaços",
  );
}
if (adminRouteKey && (adminRouteKey.length < 6 || adminRouteKey.length > 64)) {
  errors.push("ADMIN_ROUTE_KEY: use entre 6 e 64 caracteres");
}
if (["blog", "privacidade", "newsletter", "api"].includes(adminRouteKey)) {
  errors.push("ADMIN_ROUTE_KEY: escolha uma palavra que não conflite com rotas públicas");
}

requireValue("ADMIN_USERNAME");
requireValue("ADMIN_DISPLAY_NAME");

const adminPasswordHash = requireValue("ADMIN_PASSWORD_HASH");
if (
  adminPasswordHash &&
  !/^scrypt\.32768\.8\.1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{86}$/.test(
    adminPasswordHash,
  )
) {
  errors.push("ADMIN_PASSWORD_HASH: gere o valor com npm run admin:hash-password");
}

const adminSessionSecret = requireValue("ADMIN_SESSION_SECRET");
if (adminSessionSecret && adminSessionSecret.length < 32) {
  errors.push("ADMIN_SESSION_SECRET: use pelo menos 32 caracteres aleatórios");
}
if (
  adminSessionSecret &&
  [cronSecret, encryptionKey].some((secret) => secret === adminSessionSecret)
) {
  errors.push("ADMIN_SESSION_SECRET deve ser diferente dos demais segredos");
}

if (
  value("RESEND_TRANSACTIONAL_API_KEY") &&
  value("RESEND_TRANSACTIONAL_API_KEY") === value("RESEND_MARKETING_API_KEY")
) {
  errors.push("Use chaves Resend distintas para transacional e marketing");
}

for (const name of Object.keys(process.env)) {
  if (
    name.startsWith("NEXT_PUBLIC_") &&
    /(SECRET|PASSWORD|SERVICE_ROLE|DATABASE|POSTGRES|RESEND|ADMIN)/.test(name)
  ) {
    errors.push(`${name}: segredo potencialmente exposto ao navegador`);
  }
}

if (warnings.length > 0) {
  console.warn(`Avisos de ambiente:\n- ${warnings.join("\n- ")}`);
}

if (errors.length > 0) {
  console.error(`Ambiente inv\u00e1lido:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Ambiente v\u00e1lido. Nenhum valor secreto foi exibido.");
}
