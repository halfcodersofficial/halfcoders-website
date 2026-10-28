"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
 * Signing in — or up — with Google, for the sign-in and sign-up screens. It
 * lands the way an email sign-in does, greeting a new account as a sign-up.
 * An account already on every device it may use gets `deviceLimit` for the
 * screen to show the device-limit step; `continueHere` sends Google's token
 * again (it's good for an hour) once the person agrees to sign the others out.
 */
export function useGoogleSignIn() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const next = searchParams.get("next");
    const [deviceLimit, setDeviceLimit] = useState<{ limit: DeviceLimitError; credential: string } | null>(null);

    const signIn = useMutation({
        mutationFn: (values: { credential: string; signOutAllDevices?: boolean }) => authService.googleSignIn(values),
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
            const data = getApiErrorData<{ code?: string }>(error);
            if (data?.code === "DEVICE_LIMIT_EXCEEDED") {
                setDeviceLimit({ limit: data as DeviceLimitError, credential: values.credential });
                return;
            }
            // Back to the form, where Google's button can be pressed again.
            setDeviceLimit(null);
            toast.error(getApiErrorMessage(error, "Couldn't sign you in with Google."));
        },
    });

    return {
        signIn: (credential: string) => signIn.mutate({ credential }),
        isPending: signIn.isPending,
        deviceLimit: deviceLimit?.limit ?? null,
        continueHere: () => {
            if (deviceLimit) signIn.mutate({ credential: deviceLimit.credential, signOutAllDevices: true });
        },
        dismissDeviceLimit: () => setDeviceLimit(null),
    };
}
