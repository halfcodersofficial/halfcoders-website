import { execFileSync } from "child_process";
import path from "path";
import pg from "pg";
import { APP_ROLE, APP_ROLE_PASSWORD, appDatabaseUrl, testDatabaseUrl } from "./testDatabase";

const root = path.resolve(__dirname, "../..");

/**
 * Builds the test database the way production is built: a least-privilege
 * app role that owns the `learning` schema (and may not create anything
 * elsewhere), then Half Coders' migrations run *as that role*
 * (`pnpm migrate:deploy`).
 */
export default async function globalSetup() {
    const target = testDatabaseUrl();
    const dbName = decodeURIComponent(target.pathname.slice(1));

    const admin = new URL(target.toString());
    admin.pathname = "/postgres";
    const server = new pg.Client({ connectionString: admin.toString() });
    await server.connect();
    await server.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await server.query(`CREATE DATABASE "${dbName}"`);
    await server.query(`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
                CREATE ROLE ${APP_ROLE} LOGIN;
            END IF;
        END $$`);
    await server.query(`ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${APP_ROLE_PASSWORD}'`);
    await server.end();

    const owner = new pg.Client({ connectionString: target.toString() });
    await owner.connect();
    await owner.query(`
        GRANT CONNECT ON DATABASE "${dbName}" TO ${APP_ROLE};
        CREATE SCHEMA learning AUTHORIZATION ${APP_ROLE};
        REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    `);
    await owner.end();

    const env = { ...process.env, DATABASE_URL: appDatabaseUrl() };
    execFileSync("npx", ["tsx", "scripts/prepare-learning-schema.ts"], { cwd: root, env, stdio: "pipe" });
    execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: root, env, stdio: "pipe" });
}
