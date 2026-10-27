"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, MailCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { Skeleton } from "@/components/ui/skeleton";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { useZodForm } from "@/hooks/useZodForm";
import { resolveLandingPath } from "@/lib/access";
import { redirectingPath } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/httpClient";
import { emailField, otpField } from "@/lib/validation";
import { authService } from "@/services";

const RESEND_COOLDOWN_SECONDS = 60;

const schema = z.object({ code: otpField });

/**
 * The 6-digit code mailed at sign-up (or when an unverified account tried to
 * sign in). The address comes from the screen that sent them here — a code is
 * only ever issued to one address, so it isn't editable here. Verifying signs
 * them in.
 */
export default function VerifyEmailForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

    const email = useMemo(() => {
        const parsed = emailField.safeParse(searchParams.get("email") ?? "");
        return parsed.success ? parsed.data.toLowerCase() : null;
    }, [searchParams]);

    useEffect(() => {
        if (email !== null) return;
        toast.error("We couldn't tell which address to verify — please start again.");
        router.replace("/register");
    }, [email, router]);

    // A new code can be asked for once a minute (the API holds the same line).
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const verify = useMutation({
        mutationFn: (values: z.output<typeof schema>) => authService.verifyEmail({ email: email as string, code: values.code }),
        onSuccess: (user) => {
            queryClient.setQueryData(SESSION_QUERY_KEY, user);
            router.replace(redirectingPath(resolveLandingPath(searchParams.get("next"), user.role), "signup"));
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't verify that code.")),
    });

    const form = useZodForm({
        schema,
        initialValues: { code: "" },
        onSubmit: (values) => verify.mutate(values),
    });

    const resend = useMutation({
        mutationFn: () => authService.resendVerification(email as string),
        onSuccess: () => {
            toast.success("A new code is on its way.");
            setCooldown(RESEND_COOLDOWN_SECONDS);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't send a new code.")),
    });

    if (email === null) return <Skeleton className="h-80" />;

    return (
        <>
            <header className="mb-6 text-center">
                <span className="mx-auto mb-4 grid size-12 place-items-center rounded-md border border-primary/30 bg-primary/5 text-primary">
                    <MailCheck className="size-6" />
                </span>
                <h1 className="text-2xl font-bold">Verify your email</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    We emailed you a 6-digit code. It works for 15 minutes — check your spam folder if you can&apos;t see it.
                </p>
            </header>

            <form className="space-y-5" noValidate onSubmit={form.handleSubmit}>
                <div className="space-y-1.5">
                    <Label htmlFor="verify-email-address">Email</Label>
                    <div
                        id="verify-email-address"
                        className="flex h-11 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-base text-foreground sm:h-10 sm:text-sm"
                    >
                        <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{email}</span>
                    </div>
                </div>

                <FormField form={form} name="code" label="Verification code" required hint="Six digits, from the email we just sent.">
                    <OtpInput />
                </FormField>

                <Button type="submit" variant="brand" className="w-full" size="lg" isLoading={verify.isPending}>
                    Verify email
                </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
                <p>
                    Didn&apos;t get it?{" "}
                    <button
                        type="button"
                        className="font-medium text-primary hover:underline disabled:opacity-50 disabled:hover:no-underline"
                        disabled={cooldown > 0 || resend.isPending}
                        onClick={() => resend.mutate()}
                    >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
                    </button>
                </p>
                <p>
                    Wrong address?{" "}
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => router.push("/register")}>
                        Sign up again
                    </button>
                </p>
            </div>
        </>
    );
}
