"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ACCESS_DENIED_CODES, getSessionFailureCode, type SessionFailureCode } from "@/lib/httpClient";
import { authService } from "@/services";
import type { CurrentUser } from "@/types/domain.types";

export const SESSION_QUERY_KEY = ["session"] as const;

/**
 * Signed in, but not allowed in right now (blocked from learning, account
 * suspended, email not verified). Kept apart from "not signed
 * in": sending these people to sign in would just bring them straight back.
 */
export class SessionAccessDenied extends Error {
    constructor(public readonly code: SessionFailureCode, message: string) {
        super(message);
    }
}

/**
 * Shared with the query client so a screen that has just *changed* the session
 * can refetch it before navigating, instead of leaving a guard to read the
 * stale "nobody is here" answer.
 */
export const sessionQueryOptions = queryOptions<CurrentUser | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
        try {
            return await authService.me();
        } catch (error) {
            const code = getSessionFailureCode(error);
            if (code && ACCESS_DENIED_CODES.includes(code)) {
                const message =
                    (axios.isAxiosError(error) && (error.response?.data as { message?: string })?.message) ||
                    "You can't use Half Coders with this account right now.";
                throw new SessionAccessDenied(code, message);
            }
            return null;
        }
    },
    // An access decision won't change by retrying.
    retry: false,
    staleTime: 5 * 60_000,
});

/**
 * Who is signed in, if anyone.
 *
 * Identity comes from the session cookie the API sets at sign-in. `/auth/me` answers 401 for an anonymous visitor, which is a normal
 * state on every public page rather than an error — the service marks the
 * request silent so the axios interceptor doesn't redirect, and the 401 is
 * folded into `user === null` here.
 */
export const useSession = () => {
    const query = useQuery(sessionQueryOptions);

    const user = query.data ?? null;
    const accessDenied = query.error instanceof SessionAccessDenied ? query.error : null;

    return {
        user,
        isLoading: query.isLoading,
        isAuthenticated: Boolean(user),
        /** Set when the person is signed in but may not use Half Coders. */
        accessDenied,
        isStudent: user?.role === "STUDENT",
        isMentor: user?.role === "MENTOR",
        isAdmin: user?.role === "ADMIN" || user?.role === "SUPER_ADMIN",
        refetch: query.refetch,
    };
};

/**
 * Signs out of this browser: the API ends the session and clears its cookie,
 * then the home page loads fresh.
 */
export const useLogout = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await authService.logout().catch(() => undefined);
            // Cached dashboards and enrolments belong to the account that is
            // signing out.
            queryClient.clear();
            window.location.assign("/");
        },
    });
};
