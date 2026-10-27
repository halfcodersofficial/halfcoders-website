import axios, { AxiosError } from "axios";
import type { ApiErrorResponse } from "@/types/api.types";
import envConfig from "./envConfig";
import { redirectToSignIn } from "./auth";

/**
 * Single axios instance for the whole app.
 *
 * `withCredentials` is essential: the API authenticates with its session
 * cookie, so every
 * request has to carry it. The cookie is httpOnly, which means the browser
 * sends it and JS never reads it — there is no token to store, and nothing
 * for an XSS payload to steal.
 */
export const httpClient = axios.create({
    baseURL: envConfig.apiBaseUrl,
    timeout: 30_000,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

declare module "axios" {
    interface AxiosRequestConfig {
        /**
         * Background polls (notification badge, queue position) set this so a
         * stale session doesn't bounce the user to /login mid-page.
         */
        _silent?: boolean;
    }
}

/**
 * Pulls the human-readable message out of an API error.
 *
 * The backend already writes messages meant for end users — "The deadline for
 * this assignment has passed", "You're not eligible for this certificate yet" —
 * so surfacing `message` verbatim is better than inventing our own copy.
 */
export const getApiErrorMessage = (error: unknown, fallback = "Something went wrong."): string => {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as ApiErrorResponse | undefined;
        if (data?.message) return data.message;

        if (error.code === "ECONNABORTED") return "The request timed out. Please try again.";
        if (!error.response) return "Can't reach the server. Check your connection and try again.";
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

/** Structured payload some errors attach — e.g. certificate eligibility. */
export const getApiErrorData = <T>(error: unknown): T | null => {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as ApiErrorResponse | undefined;
        return (data?.data as T) ?? null;
    }
    return null;
};

/**
 * Machine-readable reasons the API attaches to 401/403 answers (see the
 * server's checkAuth). The 403 ones mean "signed in, but can't use Half Coders" —
 * sending those people to sign in would just bounce them straight back.
 */
export type SessionFailureCode =
    | "NO_CREDENTIAL"
    | "INVALID_SESSION"
    | "ACCOUNT_INACTIVE"
    | "ACCOUNT_UNVERIFIED"
    | "LEARNING_BLOCKED"
    | "LEARNING_REMOVED";

export const ACCESS_DENIED_CODES: readonly SessionFailureCode[] = [
    "ACCOUNT_INACTIVE",
    "ACCOUNT_UNVERIFIED",
    "LEARNING_BLOCKED",
    "LEARNING_REMOVED",
];

export const getSessionFailureCode = (error: unknown): SessionFailureCode | null => {
    const code = getApiErrorData<{ code?: string }>(error)?.code;
    return typeof code === "string" ? (code as SessionFailureCode) : null;
};

/**
 * There is no token refresh: the session cookie slides on the server each time
 * it's used. A 401 means there is no usable session, so the browser goes to
 * sign in and comes back afterwards.
 */
httpClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const status = error.response?.status;
        const isSilent = error.config?._silent === true;

        // Silent requests opt out — a background poll must never yank the
        // page away.
        if (status === 401 && typeof window !== "undefined" && !isSilent) {
            redirectToSignIn(window.location.href);
        }

        return Promise.reject(error);
    },
);

export default httpClient;
