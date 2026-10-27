import { defineConfig } from "vitest/config";

/**
 * Integration tests: the real Express app against a real PostgreSQL database
 * (TEST_DATABASE_URL), built by test/setup/globalSetup.ts the way production
 * is — the identity provider's identity objects first, then Half Coders' migrations — and
 * connected as a least-privilege role like production's app role.
 */
export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
        globalSetup: ["test/setup/globalSetup.ts"],
        setupFiles: ["test/setup/env.ts"],
        pool: "forks",
        poolOptions: { forks: { singleFork: true } },
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 180_000,
    },
});
