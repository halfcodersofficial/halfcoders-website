"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { resolveLandingPath } from "@/lib/access";
import { redirectingPath } from "@/lib/auth";
import { getApiErrorData, getApiErrorMessage } from "@/lib/httpClient";
import { authService } from "@/services";
import type { DeviceLimitError } from "@/types/domain.types";

/**
 * Signing in — or up — with Google, for the sign-in and sign-up screens: the
 * code from Google's popup goes to the API. It lands the way an email sign-in
 * does, greeting a new account as a sign-up. An account already on every
 * device it may use gets `deviceLimit` for the screen to show the
 * device-limit step. A code works only once, so that answer carries Google's
 * ID token (good for an hour), which `continueHere` sends once the person
 * agrees to sign the others out.
 */
export function useGoogleSignIn() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const next = searchParams.get("next");
    const [deviceLimit, setDeviceLimit] = useState<{ limit: DeviceLimitError; credential: string } | null>(null);

    const signIn = useMutation({
        mutationFn: (values: { code?: string; credential?: string; signOutAllDevices?: boolean }) => authService.googleSignIn(values),
        onSuccess: ({ isNewAccount, ...user }) => {
            queryClient.setQueryData(SESSION_QUERY_KEY, user);
            const landing = resolveLandingPath(next, user.role);
            if (user.needPasswordChange) {
                router.push(`/change-password?next=${encodeURIComponent(landing)}`);
                router.refresh();
                return;
            }
            router.replace(redirectingPath(landing, isNewAccount ? "signup" : "signin"));
        },
        onError: (error, values) => {
            const data = getApiErrorData<{ code?: string; credential?: string }>(error);
            const credential = data?.credential ?? values.credential;
            if (data?.code === "DEVICE_LIMIT_EXCEEDED" && credential) {
                setDeviceLimit({ limit: data as DeviceLimitError, credential });
                return;
            }
            // Back to the form, where Google's button can be pressed again.
            setDeviceLimit(null);
            // 404: an API that doesn't know Google yet (deployed behind this page).
            toast.error(
                axios.isAxiosError(error) && error.response?.status === 404
                    ? "Signing in with Google isn't available right now. Please use your email for now."
                    : getApiErrorMessage(error, "Couldn't sign you in with Google."),
            );
        },
    });

    return {
        signIn: (code: string) => signIn.mutate({ code }),
        isPending: signIn.isPending,
        deviceLimit: deviceLimit?.limit ?? null,
        continueHere: () => {
            if (deviceLimit) signIn.mutate({ credential: deviceLimit.credential, signOutAllDevices: true });
        },
        dismissDeviceLimit: () => setDeviceLimit(null),
    };
}
