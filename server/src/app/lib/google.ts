import { OAuth2Client } from "google-auth-library";
import status from "http-status";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { logger } from "../utils/logger";

/**
 * Signing in with Google. The web app shows Google's own button; picking an
 * account there hands the browser an ID token — a JWT Google signed, naming
 * the account and the client it was issued to. Here it's checked against
 * Google's published keys and this site's client id, so a token minted for
 * another site, expired or forged is refused.
 */

const client = new OAuth2Client();

export interface GoogleIdentity {
    /** Google's lasting id for the account — stored as `User.googleId`. */
    sub: string;
    /** Lowercase, and verified by Google. */
    email: string;
    name: string;
    picture: string | null;
}

/** The Google account behind an ID token from the sign-in button. Throws 401 for a bad token, 503 when Google can't be reached. */
export const verifyGoogleCredential = async (credential: string): Promise<GoogleIdentity> => {
    const audience = envVars.GOOGLE_CLIENT_ID;
    if (!audience) {
        throw new AppError(status.SERVICE_UNAVAILABLE, "Signing in with Google isn't available right now.").setData({ code: "GOOGLE_DISABLED" });
    }

    // Google's keys first, on their own (cached until Google says they
    // expire): failing to fetch them is Google being unreachable, not a bad token.
    try {
        await client.getFederatedSignonCertsAsync();
    } catch (error) {
        logger.error("Couldn't fetch Google's sign-in keys", error);
        throw new AppError(status.SERVICE_UNAVAILABLE, "We couldn't reach Google just now. Please try again in a minute.").setData({
            code: "GOOGLE_UNREACHABLE",
        });
    }

    let payload;
    try {
        payload = (await client.verifyIdToken({ idToken: credential, audience })).getPayload();
    } catch (error) {
        logger.warn("Google credential refused", { reason: (error as Error).message });
    }
    if (!payload?.sub || !payload.email) {
        throw new AppError(status.UNAUTHORIZED, "Signing in with Google didn't go through. Please try again.").setData({ code: "GOOGLE_INVALID" });
    }
    if (payload.email_verified !== true) {
        throw new AppError(status.BAD_REQUEST, "Google hasn't verified this account's email yet, so it can't be used here.").setData({
            code: "GOOGLE_EMAIL_UNVERIFIED",
        });
    }

    const email = payload.email.toLowerCase();
    return {
        sub: payload.sub,
        email,
        name: (payload.name?.trim() || payload.given_name?.trim() || email.split("@")[0]).slice(0, 80),
        picture: payload.picture ?? null,
    };
};
