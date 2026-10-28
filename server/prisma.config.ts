import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * The connection the Prisma CLI (migrate, studio) uses — a direct one, never
 * a pooler's. `migrate deploy` holds a session-level advisory lock for the
 * length of the run; through a transaction-mode pooler (Neon's `-pooler` host
 * is PgBouncer) the lock and its release can land on different server
 * connections, so the lock stays held by a pooled connection the app then
 * reuses, and every later deploy times out waiting for it (P1002).
 *
 * DIRECT_DATABASE_URL when set; otherwise DATABASE_URL, with a Neon pooled host
 * turned into its direct one (the same name without `-pooler`). The app keeps
 * the pooled DATABASE_URL (lib/prisma.ts) — it only takes transaction-scoped
 * locks, which a pooler handles fine.
 */
const migrationUrl = (): string => {
    if (process.env.DIRECT_DATABASE_URL) return process.env.DIRECT_DATABASE_URL;
    const url = process.env.DATABASE_URL ?? "";
    try {
        const parsed = new URL(url);
        if (parsed.hostname.endsWith(".neon.tech")) parsed.hostname = parsed.hostname.replace("-pooler.", ".");
        return parsed.toString();
    } catch {
        return url;
    }
};

/**
 * Half Coders' own database (see prisma/schema/schema.prisma for the layout).
 *
 * Every table, and the migration history, lives in the `learning` schema:
 * DATABASE_URL carries `?schema=learning`, so `_prisma_migrations` is created
 * there too.
 */
export default defineConfig({
    schema: "prisma/schema",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: migrationUrl(),
        shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    },
});
