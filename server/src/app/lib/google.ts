import { OAuth2Client } from "google-auth-library";
import status from "http-status";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { logger } from "../utils/logger";

/**
 * Signing in with Google. The web app's button opens Google's sign-in popup,
 * which hands the browser a one-time code; here the code is traded, with the
 * client secret, for the account's ID token — a JWT Google signed, naming the
 * account and the client it was issued to. The token is checked against
 * Google's published keys and this site's client id, so one minted for
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

const disabled = () =>
    new AppError(status.SERVICE_UNAVAILABLE, "Signing in with Google isn't available right now.").setData({ code: "GOOGLE_DISABLED" });

const invalid = () =>
    new AppError(status.UNAUTHORIZED, "Signing in with Google didn't go through. Please try again.").setData({ code: "GOOGLE_INVALID" });

const unreachable = () =>
    new AppError(status.SERVICE_UNAVAILABLE, "We couldn't reach Google just now. Please try again in a minute.").setData({
        code: "GOOGLE_UNREACHABLE",
    });

/**
 * Trades the code from Google's sign-in popup for the account. Returns the ID
 * token too: a code works once, so the device-limit step signs in again with
 * the token instead. Throws 401 for a used, expired or forged code.
 */
export const exchangeGoogleCode = async (code: string): Promise<{ identity: GoogleIdentity; idToken: string }> => {
    const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = envVars;
    if (!clientId || !clientSecret) {
        if (clientId) logger.error("GOOGLE_CLIENT_SECRET isn't set — signing in with Google can't work without it");
        throw disabled();
    }

    let idToken: string | null | undefined;
    try {
        // "postmessage": the code came from a popup, not a redirect.
        const { tokens } = await new OAuth2Client(clientId, clientSecret, "postmessage").getToken(code);
        idToken = tokens.id_token;
    } catch (error) {
        const reason = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
        if (reason === "invalid_grant") throw invalid();
        logger.error(
            reason === "invalid_client"
                ? "Google refused the client secret — check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
                : "Couldn't trade a Google sign-in code",
            error,
        );
        throw unreachable();
    }
    if (!idToken) throw invalid();
    return { identity: await verifyGoogleCredential(idToken), idToken };
};

/** The Google account behind an ID token. Throws 401 for a bad token, 503 when Google can't be reached. */
export const verifyGoogleCredential = async (credential: string): Promise<GoogleIdentity> => {
    const audience = envVars.GOOGLE_CLIENT_ID;
    if (!audience) throw disabled();

    // Google's keys first, on their own (cached until Google says they
    // expire): failing to fetch them is Google being unreachable, not a bad token.
    try {
        await client.getFederatedSignonCertsAsync();
    } catch (error) {
        logger.error("Couldn't fetch Google's sign-in keys", error);
        throw unreachable();
    }

    let payload;
    try {
        payload = (await client.verifyIdToken({ idToken: credential, audience })).getPayload();
    } catch (error) {
        logger.warn("Google credential refused", { reason: (error as Error).message });
    }
    if (!payload?.sub || !payload.email) throw invalid();
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
