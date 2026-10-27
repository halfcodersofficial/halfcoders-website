/**
 * The integration tests' database. Only an explicitly configured, *local*
 * database is ever used: the tests create and drop it, so pointing them at a
 * shared or hosted database must be impossible, not merely discouraged.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

/** The least-privilege role the app connects as (like production's app role). */
export const APP_ROLE = "halfcoders_test_app";
export const APP_ROLE_PASSWORD = "halfcoders-test-app-password";

/** TEST_DATABASE_URL: a superuser URL for the throwaway test database. */
export const testDatabaseUrl = (): URL => {
    const raw = process.env.TEST_DATABASE_URL;
    if (!raw) {
        throw new Error(
            "TEST_DATABASE_URL is not set. Point it at a throwaway local PostgreSQL database " +
            "(e.g. postgresql://postgres:postgres@127.0.0.1:5432/halfcoders_test) — it is dropped and recreated.",
        );
    }
    const url = new URL(raw);
    if (!LOCAL_HOSTS.has(url.hostname)) {
        throw new Error(`Refusing to run tests against non-local database host "${url.hostname}".`);
    }
    if (!/test/i.test(url.pathname)) {
        throw new Error(`Refusing to run tests against "${url.pathname.slice(1)}": the database name must contain "test".`);
    }
    url.searchParams.delete("schema");
    return url;
};

/** The same database, as the app role, with Half Coders' `?schema=learning`. */
export const appDatabaseUrl = (): string => {
    const url = testDatabaseUrl();
    url.username = APP_ROLE;
    url.password = APP_ROLE_PASSWORD;
    url.searchParams.set("schema", "learning");
    return url.toString();
};
