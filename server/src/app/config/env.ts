import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
    NODE_ENV: string;
    PORT: string;
    DATABASE_URL: string;
    REDIS_URL?: string;
    FRONTEND_URL: string;
    /**
     * Who may call the API with the session cookie (CORS, sockets):
     * FRONTEND_URL's origin and its www/bare twin, so the site works from
     * either address — `half-coders.tech` or `www.half-coders.tech`, whichever
     * the host makes primary. FRONTEND_URL stays the one used in links.
     */
    FRONTEND_ORIGINS: string[];
    BACKEND_URL: string;
    /**
     * Shares the session cookie with sibling subdomains: `half-coders.tech`
     * lets the API on `api.half-coders.tech` set a cookie the web app's own
     * server can read too. Unset, the cookie belongs to the API's host alone.
     */
    COOKIE_DOMAIN?: string;
    /** Proxies between the internet and this process (express `trust proxy`). */
    TRUST_PROXY: number;
    /** Keys the one-time codes mailed for email verification and password resets. */
    AUTH_SECRET: string;
    /**
     * The Google OAuth client the sign-in button belongs to — the same one as
     * the web app's NEXT_PUBLIC_GOOGLE_CLIENT_ID. Unset, signing in with
     * Google is off.
     */
    GOOGLE_CLIENT_ID?: string;
    EMAIL_SENDER: {
        /**
         * Set, mail goes by Brevo's HTTPS API and the SMTP login isn't needed —
         * for hosts that block the SMTP ports (Render's and Railway's free plans).
         */
        BREVO_API_KEY?: string;
        SMTP_USER?: string;
        SMTP_PASS?: string;
        SMTP_HOST?: string;
        SMTP_PORT?: string;
        /** The From address either way, e.g. `Half Coders <no-reply@half-coders.tech>`. */
        SMTP_FROM: string;
    };
    CLOUDINARY: {
        CLOUD_NAME: string;
        API_KEY: string;
        API_SECRET: string;
        /** Top-level folder every Half Coders upload goes under. */
        FOLDER: string;
    };
}

/** Minimum entropy for shared secrets — anything shorter is a config mistake. */
const MIN_SECRET_LENGTH = 32;

/**
 * Fails fast at import time if a required variable is missing. Deliberately a
 * plain `Error` rather than AppError: this runs before the express error
 * pipeline exists, so the only sane outcome is the process refusing to boot.
 */
const loadEnvVariables = (): EnvConfig => {
    const required = [
        "NODE_ENV",
        "PORT",
        "DATABASE_URL",
        "FRONTEND_URL",
        "BACKEND_URL",
        "AUTH_SECRET",
        // The SMTP login only when Brevo isn't the one sending.
        ...(process.env.EMAIL_SENDER_BREVO_API_KEY?.trim()
            ? []
            : ["EMAIL_SENDER_SMTP_USER", "EMAIL_SENDER_SMTP_PASS", "EMAIL_SENDER_SMTP_HOST", "EMAIL_SENDER_SMTP_PORT"]),
        "EMAIL_SENDER_SMTP_FROM",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variable(s): ${missing.join(", ")}. ` +
            `Copy .env.example to .env and fill them in.`,
        );
    }

    // Every table, and Prisma's migration history, lives in the `learning`
    // schema; the schema parameter is what puts them there.
    const databaseUrl = process.env.DATABASE_URL as string;
    let schemaParam: string | null = null;
    try {
        schemaParam = new URL(databaseUrl).searchParams.get("schema");
    } catch {
        throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
    }
    if (schemaParam !== "learning") {
        throw new Error(
            "DATABASE_URL must end with `?schema=learning` " +
            "(Half Coders' tables and migration history live in the `learning` schema).",
        );
    }

    for (const key of ["AUTH_SECRET"]) {
        if ((process.env[key] as string).length < MIN_SECRET_LENGTH) {
            throw new Error(`${key} must be at least ${MIN_SECRET_LENGTH} characters long.`);
        }
    }

    const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

    const frontendUrl = stripTrailingSlash(process.env.FRONTEND_URL as string);
    const frontendOrigins = ((): string[] => {
        let url: URL;
        try {
            url = new URL(frontendUrl);
        } catch {
            throw new Error("FRONTEND_URL must be a full URL such as `https://half-coders.tech`.");
        }
        // localhost and IP addresses have no www twin.
        const { hostname } = url;
        if (!hostname.includes(".") || /^[\d.]+$/.test(hostname)) return [url.origin];
        const twin = new URL(url.origin);
        twin.hostname = hostname.startsWith("www.") ? hostname.slice(4) : `www.${hostname}`;
        return [url.origin, twin.origin];
    })();

    // A bare host: `half-coders.tech`, not a URL, and no leading dot (the
    // browser treats both alike, Express doesn't need it).
    const cookieDomain = process.env.COOKIE_DOMAIN?.trim().replace(/^\./, "") || undefined;
    if (cookieDomain && !/^[a-z0-9.-]+$/i.test(cookieDomain)) {
        throw new Error("COOKIE_DOMAIN must be a bare host such as `half-coders.tech` — no scheme, port or path.");
    }

    // An empty value is "not set", not 0 — 0 would key every rate limit to the proxy.
    const trustProxy = process.env.TRUST_PROXY?.trim() ? Number(process.env.TRUST_PROXY) : 1;
    if (!Number.isInteger(trustProxy) || trustProxy < 0) {
        throw new Error("TRUST_PROXY must be a whole number of proxy hops (0 or more).");
    }

    return {
        NODE_ENV: process.env.NODE_ENV as string,
        PORT: process.env.PORT as string,
        DATABASE_URL: databaseUrl,
        REDIS_URL: process.env.REDIS_URL,
        FRONTEND_URL: frontendUrl,
        FRONTEND_ORIGINS: frontendOrigins,
        BACKEND_URL: stripTrailingSlash(process.env.BACKEND_URL as string),
        COOKIE_DOMAIN: cookieDomain,
        TRUST_PROXY: trustProxy,
        AUTH_SECRET: process.env.AUTH_SECRET as string,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.trim() || undefined,
        EMAIL_SENDER: {
            BREVO_API_KEY: process.env.EMAIL_SENDER_BREVO_API_KEY?.trim() || undefined,
            SMTP_USER: process.env.EMAIL_SENDER_SMTP_USER,
            SMTP_PASS: process.env.EMAIL_SENDER_SMTP_PASS,
            SMTP_HOST: process.env.EMAIL_SENDER_SMTP_HOST,
            SMTP_PORT: process.env.EMAIL_SENDER_SMTP_PORT,
            SMTP_FROM: process.env.EMAIL_SENDER_SMTP_FROM as string,
        },
        CLOUDINARY: {
            CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
            API_KEY: process.env.CLOUDINARY_API_KEY as string,
            API_SECRET: process.env.CLOUDINARY_API_SECRET as string,
            FOLDER: process.env.CLOUDINARY_FOLDER || "halfcoders",
        },
    };
};

export const envVars = loadEnvVariables();

export const isDevelopment = envVars.NODE_ENV === "development";
export const isProduction = envVars.NODE_ENV === "production";
