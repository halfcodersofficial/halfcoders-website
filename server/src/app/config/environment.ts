/**
 * Environment configuration helper — one place for the dev/prod switches.
 */
import { envVars, isDevelopment, isProduction } from "./env";

export { isDevelopment, isProduction };

export const isTest = envVars.NODE_ENV === "test";

export const environmentConfig = {
    isDevelopment,
    isProduction,
    isTest,

    logging: {
        verbose: isDevelopment,
        errorDetails: isDevelopment,
    },

    security: {
        hideErrorDetails: isProduction,
        enforceHttps: isProduction,
    },

    performance: {
        enableCompression: true,
    },
};

/** Printed once on boot so a misconfigured deploy is obvious in the logs. */
export const logEnvironmentConfig = () => {
    if (isDevelopment) {
        console.log("🔧 Half Coders environment:");
        console.log(`   NODE_ENV:     ${envVars.NODE_ENV}`);
        // Host only — never print the full URL, it carries the password.
        console.log(`   DATABASE:     ${new URL(envVars.DATABASE_URL).host}`);
        console.log(`   FRONTEND_URL: ${envVars.FRONTEND_URL}`);
        console.log(`   REDIS:        ${envVars.REDIS_URL ? "configured" : "in-memory fallback"}`);
    } else {
        console.log("✅ Half Coders running in production mode (error details hidden).");
    }
};
