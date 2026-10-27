/**
 * `pnpm migrate <name>` — create a new Half Coders migration.
 *
 * Diffs the committed migration history (replayed into the throwaway shadow
 * database) against prisma/schema, and writes the SQL as a new migration
 * directory — without touching the real database, unlike `prisma migrate
 * dev`. Review it, then apply with `pnpm migrate:deploy`.
 *
 * Requires SHADOW_DATABASE_URL: an empty database Prisma may freely create
 * and drop objects in, with `?schema=learning`.
 */
import "dotenv/config";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const name = process.argv[2];
if (!name || !/^[a-z0-9_]+$/.test(name)) {
    console.error("Usage: pnpm migrate <snake_case_name>");
    process.exit(1);
}
if (!process.env.SHADOW_DATABASE_URL) {
    console.error("SHADOW_DATABASE_URL must be set to an empty scratch database (with ?schema=learning).");
    process.exit(1);
}

const pad = (n: number) => String(n).padStart(2, "0");
const now = new Date();
const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;

// Always run from the server package root (`pnpm migrate …` does).
const root = process.cwd();
const migrationsDir = path.join(root, "prisma", "migrations");
const target = path.join(migrationsDir, `${stamp}_${name}`);

const sql = execFileSync(
    "npx",
    [
        "prisma",
        "migrate",
        "diff",
        "--from-migrations",
        "prisma/migrations",
        "--to-schema",
        "prisma/schema",
        "--script",
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

if (!sql.trim() || /This is an empty migration/.test(sql)) {
    console.log("No schema changes — nothing to migrate.");
    process.exit(0);
}

fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(path.join(target, "migration.sql"), sql);
console.log(`✅ Wrote ${path.relative(process.cwd(), path.join(target, "migration.sql"))} — review it, then run pnpm migrate:deploy`);
