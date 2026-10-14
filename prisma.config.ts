import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * `prisma migrate dev` creates a shadow database and replays every migration.
 * Neon's pooled host (`-pooler`) closes that session, so the CLI uses the
 * direct host. The app keeps using DATABASE_URL in lib/db.ts.
 */
function migrationDatabaseUrl(): string {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const pooled = new URL(env("DATABASE_URL"));
  pooled.hostname = pooled.hostname.replace("-pooler", "");
  return pooled.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationDatabaseUrl(),
  },
});
