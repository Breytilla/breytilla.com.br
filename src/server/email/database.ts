import postgres from "postgres";

import { getDatabaseEnv } from "./env";

type Database = ReturnType<typeof postgres>;

const globalDatabase = globalThis as typeof globalThis & {
  __breytillaEmailDatabase?: Database;
};

/** Returns a lazily-created Postgres.js pool shared by the current server process. */
export function getDatabase(): Database {
  if (!globalDatabase.__breytillaEmailDatabase) {
    globalDatabase.__breytillaEmailDatabase = postgres(
      getDatabaseEnv().DATABASE_URL,
      {
        max: 5,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
      },
    );
  }

  return globalDatabase.__breytillaEmailDatabase;
}

