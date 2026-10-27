/**
 * `pnpm migrate:deploy` step 1 — make sure the `learning` schema and its
 * migration-history table exist before `prisma migrate deploy` runs.
 *
 * Prisma 7.10's schema engine can fail to *initialise* a history table outside
 * `public` ("Invariant violation: migration persistence is not initialized").
 * Once the table exists, deploy, status and diff all behave normally, so it's
 * created here (with exactly the DDL Prisma itself uses) and the first deploy
 * is deterministic.
 *
 * Idempotent, and checks for existing objects *before* issuing CREATE: in a
 * least-privilege setup the app role owns `learning` but may not hold CREATE
 * on the database, and PostgreSQL checks that privilege even for
 * `CREATE SCHEMA IF NOT EXISTS`.
 */
import "dotenv/config";
import dns from "node:dns";
import net from "node:net";
import pg from "pg";

// Same as src/app/lib/prisma.ts: without working IPv6, Node's 250ms per-address
// attempt is shorter than Neon's handshake, so connect fails with ETIMEDOUT.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

const SCHEMA = "learning";

const connectionStringWithoutSchema = (url: string): string => {
    const parsed = new URL(url);
    parsed.searchParams.delete("schema");
    return parsed.toString();
};

const main = async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");

    const client = new pg.Client({ connectionString: connectionStringWithoutSchema(url) });
    await client.connect();

    try {
        // Catalog lookups only — they need no privileges on the objects.
        const schema = await client.query(`SELECT 1 FROM pg_namespace WHERE nspname = $1`, [SCHEMA]);
        if (schema.rowCount === 0) {
            await client.query(`CREATE SCHEMA "${SCHEMA}"`);
            console.log(`✅ Created schema "${SCHEMA}"`);
        }

        const history = await client.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [
            `"${SCHEMA}"."_prisma_migrations"`,
        ]);
        if (!history.rows[0].present) {
            await client.query(`
                CREATE TABLE "${SCHEMA}"."_prisma_migrations" (
                    "id"                  VARCHAR(36)  NOT NULL,
                    "checksum"            VARCHAR(64)  NOT NULL,
                    "finished_at"         TIMESTAMPTZ,
                    "migration_name"      VARCHAR(255) NOT NULL,
                    "logs"                TEXT,
                    "rolled_back_at"      TIMESTAMPTZ,
                    "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
                    "applied_steps_count" INTEGER      NOT NULL DEFAULT 0,
                    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
                )
            `);
            console.log(`✅ Created "${SCHEMA}"."_prisma_migrations"`);
        }
    } finally {
        await client.end();
    }
};

main().catch((error) => {
    console.error(`❌ ${error instanceof Error ? error.message : error}`);
    process.exit(1);
});
