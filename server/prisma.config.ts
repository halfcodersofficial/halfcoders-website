import "dotenv/config";
import { defineConfig } from "prisma/config";

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
        url: process.env.DATABASE_URL ?? "",
        shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    },
});
