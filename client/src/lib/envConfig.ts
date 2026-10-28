/**
 * Public runtime config. Every value here ships to the browser, so nothing
 * secret belongs in this file — the API is the only thing holding credentials.
 */
const envConfig = {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001/api/v1",
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5001",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
    siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Half Coders",
    /**
     * The Google OAuth client the "Continue with Google" button belongs to —
     * the same one as the API's GOOGLE_CLIENT_ID. Public by design. Unset,
     * the button isn't shown.
     */
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    isProduction: process.env.NODE_ENV === "production",
    /**
     * Blocks DevTools, the console and right-click (lib/security/devtoolsProtection).
     * The production image turns it on; local dev leaves it off so the
     * browser's tools keep working.
     */
    devtoolsProtection: process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS_PROTECTION === "true",
} as const;

export default envConfig;
