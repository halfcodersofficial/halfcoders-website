import { afterAll, vi } from "vitest";
import { TEST_AUTH_SECRET } from "./constants";
import { appDatabaseUrl } from "./testDatabase";

/**
 * Test environment. Runs before any application module is imported.
 *
 * `dotenv` is stubbed out so a developer's `.env` — which points at real
 * databases and real mail / storage / payment credentials — can never leak
 * into a test run. Every variable the app needs is set here instead.
 */
vi.mock("dotenv", () => ({ default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));
vi.mock("dotenv/config", () => ({}));


// Each test file loads the app afresh, and with it a new database pool: close
// it when the file is done, or a full run outgrows the server's connections.
afterAll(async () => {
    const { prisma } = await import("../../src/app/lib/prisma");
    await prisma.$disconnect();
});

const env: Record<string, string> = {
    NODE_ENV: "test",
    PORT: "0",
    DATABASE_URL: appDatabaseUrl(),
    REDIS_URL: "",
    FRONTEND_URL: "http://localhost:3098",
    BACKEND_URL: "http://localhost:5098",
    AUTH_SECRET: TEST_AUTH_SECRET,
    EMAIL_SENDER_SMTP_USER: "test",
    EMAIL_SENDER_SMTP_PASS: "test",
    EMAIL_SENDER_SMTP_HOST: "127.0.0.1",
    EMAIL_SENDER_SMTP_PORT: "2",
    EMAIL_SENDER_SMTP_FROM: "test@example.test",
    CLOUDINARY_CLOUD_NAME: "test",
    CLOUDINARY_API_KEY: "test",
    CLOUDINARY_API_SECRET: "test",
    CLOUDINARY_FOLDER: "halfcoders",
    LOG_LEVEL: "warn",
};

for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
}
