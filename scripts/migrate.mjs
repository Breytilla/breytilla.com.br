import nextEnv from "@next/env";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const databaseUrl =
  process.env.DATABASE_MIGRATION_URL ?? process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_MIGRATION_URL (or POSTGRES_URL_NON_POOLING from the Supabase Vercel integration) is required to run database migrations. Use a direct or session-pooled connection, not the transaction pooler.",
  );
}

const migrationsDirectory = path.join(projectDir, "db", "migrations");
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((fileName) => /^\d+.*\.sql$/.test(fileName))
  .sort((left, right) => left.localeCompare(right));

const sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 5,
  max_lifetime: 60,
});

try {
  await sql`SELECT pg_advisory_lock(hashtext('breytilla_email_migrations'))`;

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  for (const fileName of migrationFiles) {
    const migrationSource = await readFile(
      path.join(migrationsDirectory, fileName),
      "utf8",
    );
    const applied = await sql.begin(async (transaction) => {
      const [alreadyApplied] = await transaction`
        SELECT EXISTS (
          SELECT 1
          FROM schema_migrations
          WHERE name = ${fileName}
        ) AS applied
      `;

      if (alreadyApplied?.applied) {
        return false;
      }

      await transaction.unsafe(migrationSource);
      await transaction`
        INSERT INTO schema_migrations (name)
        VALUES (${fileName})
      `;
      return true;
    });

    if (!applied) {
      console.log(`skip ${fileName}`);
      continue;
    }

    console.log(`applied ${fileName}`);
  }
} finally {
  try {
    await sql`SELECT pg_advisory_unlock(hashtext('breytilla_email_migrations'))`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
