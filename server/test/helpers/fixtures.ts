import { createHash, randomBytes, randomUUID } from "crypto";
import pg from "pg";
import supertest from "supertest";
import { afterAll } from "vitest";
import app from "../../src/app";
import { testDatabaseUrl } from "../setup/testDatabase";

export type TestRole = "STUDENT" | "MENTOR" | "ADMIN" | "SUPER_ADMIN";
export const ALL_ROLES: TestRole[] = ["STUDENT", "MENTOR", "ADMIN", "SUPER_ADMIN"];

/**
 * The database as its owner sees it — for arranging accounts and sessions
 * directly, and for checking what a request wrote.
 */
export const owner = new pg.Pool({ connectionString: testDatabaseUrl().toString(), max: 2 });
afterAll(() => owner.end());

let ipCounter = 0;
/** A request against the real app, each from its own client address (rate limits aren't under test). */
export const api = () => {
    const agent = supertest(app);
    const ip = () => {
        ipCounter += 1;
        return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
    };
    return {
        get: (path: string) => agent.get(path).set("X-Forwarded-For", ip()),
        post: (path: string) => agent.post(path).set("X-Forwarded-For", ip()),
        patch: (path: string) => agent.patch(path).set("X-Forwarded-For", ip()),
        put: (path: string) => agent.put(path).set("X-Forwarded-For", ip()),
        delete: (path: string) => agent.delete(path).set("X-Forwarded-For", ip()),
    };
};

export interface TestAccount {
    id: string;
    email: string;
    role: TestRole;
    token: string;
    cookie: string;
}

let counter = 0;

/** A cookie header carrying a session token. */
export const sessionCookie = (token: string) => `halfcoders.session_token=${encodeURIComponent(token)}`;

/** An account with `role` and a live session, written straight into the database. */
export const createAccount = async (
    role: TestRole,
    overrides: { status?: "ACTIVE" | "BLOCKED" | "DELETED"; emailVerified?: boolean; email?: string } = {},
): Promise<TestAccount> => {
    counter += 1;
    const id = randomUUID();
    const email = overrides.email ?? `${role.toLowerCase()}-${counter}-${id.slice(0, 8)}@example.test`;
    await owner.query(
        `INSERT INTO learning."user" (id, name, email, "emailVerified", role, status, "updatedAt")
         VALUES ($1, $2, $3, $4, $5::learning."Role", $6::learning."AccountStatus", now())`,
        [id, `${role} ${counter}`, email, overrides.emailVerified ?? true, role, overrides.status ?? "ACTIVE"],
    );
    const token = randomBytes(24).toString("hex");
    await owner.query(
        `INSERT INTO learning.session (id, "tokenHash", "userId", "expiresAt", "updatedAt")
         VALUES ($1, $2, $3, now() + interval '1 day', now())`,
        [randomUUID(), createHash("sha256").update(token).digest("hex"), id],
    );
    return { id, email, role, token, cookie: sessionCookie(token) };
};

export const learningProfileOf = async (userId: string) =>
    (await owner.query(`SELECT * FROM learning.learning_profiles WHERE "userId" = $1`, [userId])).rows[0] ?? null;
