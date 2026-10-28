"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import ContinueWithGoogle from "@/components/auth/ContinueWithGoogle";
import DeviceLimitStep from "@/components/auth/DeviceLimitStep";
import { AuthField } from "@/components/shared/AuthField";
import { Button } from "@/components/ui/button";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { useZodForm } from "@/hooks/useZodForm";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { resolveLandingPath } from "@/lib/access";
import { redirectingPath } from "@/lib/auth";
import { getApiErrorData, getApiErrorMessage } from "@/lib/httpClient";
import { currentPasswordField, emailField } from "@/lib/validation";
import { authService } from "@/services";
import type { DeviceLimitError } from "@/types/domain.types";

// Sign-in checks the shape of the address only. The password rules belong on
// the screen where a password is *chosen*.
const schema = z.object({ email: emailField, password: currentPasswordField });

type Credentials = z.output<typeof schema>;

/**
 * Google, or email + password. An unverified email is sent on to the verify
 * step with a fresh code; an account already on every device it may use gets
 * the device-limit step, which signs in again the same way once the person
 * agrees to sign the others out.
 */
export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const next = searchParams.get("next");
    const [deviceLimit, setDeviceLimit] = useState<{ limit: DeviceLimitError; credentials: Credentials } | null>(null);
    const google = useGoogleSignIn();

    const login = useMutation({
        mutationFn: (values: Credentials & { signOutAllDevices?: boolean }) => authService.login(values),
        onSuccess: (user) => {
            // Seed the cache so the very next render already knows who's here.
            queryClient.setQueryData(SESSION_QUERY_KEY, user);
            const landing = resolveLandingPath(next, user.role);
            if (user.needPasswordChange) {
                router.push(`/change-password?next=${encodeURIComponent(landing)}`);
                router.refresh();
                return;
            }
            // The hand-off screen greets them, then opens `landing`.
            router.replace(redirectingPath(landing));
        },
        onError: (error, values) => {
            const data = getApiErrorData<{ code?: string; email?: string }>(error);
            if (data?.code === "EMAIL_NOT_VERIFIED") {
                toast.info("Verify your email first — we've sent you a code.");
                const query = new URLSearchParams({ email: data.email ?? values.email, ...(next ? { next } : {}) });
                router.push(`/verify-email?${query}`);
                return;
            }
            if (data?.code === "DEVICE_LIMIT_EXCEEDED") {
                setDeviceLimit({ limit: data as DeviceLimitError, credentials: { email: values.email, password: values.password } });
                return;
            }
            toast.error(getApiErrorMessage(error, "Couldn't sign you in."));
        },
    });

    const form = useZodForm({
        schema,
        initialValues: { email: "", password: "" },
        onSubmit: (values) => login.mutate(values),
    });

    if (deviceLimit) {
        return (
            <DeviceLimitStep
                limit={deviceLimit.limit}
                isContinuing={login.isPending}
                onContinue={() => login.mutate({ ...deviceLimit.credentials, signOutAllDevices: true })}
                onBack={() => setDeviceLimit(null)}
            />
        );
    }
    if (google.deviceLimit) {
        return (
            <DeviceLimitStep
                limit={google.deviceLimit}
                isContinuing={google.isPending}
                onContinue={google.continueHere}
                onBack={google.dismissDeviceLimit}
            />
        );
    }

    return (
        <div className="space-y-6">
            <header className="text-center">
                <h1 className="text-3xl font-bold tracking-tight">Good to see you again</h1>
                <p className="mt-2 text-sm text-muted-foreground">Sign in and pick up right where you stopped.</p>
            </header>

            <ContinueWithGoogle
                label="Sign in with Google"
                onCode={google.signIn}
                busy={google.isPending}
                dividerLabel="or sign in with email"
            />

            <form className="space-y-4" noValidate onSubmit={form.handleSubmit}>
                <AuthField
                    form={form}
                    name="email"
                    label="Email address"
                    icon={Mail}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    autoFocus
                />

                <AuthField
                    form={form}
                    name="password"
                    label="Password"
                    icon={LockKeyhole}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    labelAction={
                        // Carry the typed address across, so recovering a
                        // password doesn't start with typing it again.
                        <Link
                            href={
                                form.values.email.trim()
                                    ? `/forgot-password?email=${encodeURIComponent(form.values.email.trim())}`
                                    : "/forgot-password"
                            }
                            tabIndex={-1}
                            className="text-[11px] font-medium leading-tight text-primary hover:underline"
                        >
                            Forgot password?
                        </Link>
                    }
                />

                <Button type="submit" size="lg" variant="brand" className="h-13 w-full text-base" isLoading={login.isPending}>
                    Sign in
                </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
                New to Half Coders?{" "}
                <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-primary hover:underline">
                    Create an account
                </Link>
            </p>
        </div>
    );
}
