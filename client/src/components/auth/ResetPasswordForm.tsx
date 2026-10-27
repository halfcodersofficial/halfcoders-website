"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthField } from "@/components/shared/AuthField";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { Skeleton } from "@/components/ui/skeleton";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { useZodForm } from "@/hooks/useZodForm";
import { homeFor } from "@/lib/access";
import { redirectingPath } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/httpClient";
import { emailField, otpField, passwordField } from "@/lib/validation";
import { authService } from "@/services";

const schema = z.object({ code: otpField, password: passwordField });

/** The mailed reset code and a new password. Every old session ends; this one starts signed in. */
export default function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    const email = useMemo(() => {
        const parsed = emailField.safeParse(searchParams.get("email") ?? "");
        return parsed.success ? parsed.data.toLowerCase() : null;
    }, [searchParams]);

    useEffect(() => {
        if (email === null) router.replace("/forgot-password");
    }, [email, router]);

    const reset = useMutation({
        mutationFn: (values: z.output<typeof schema>) => authService.resetPassword({ email: email as string, ...values }),
        onSuccess: (user) => {
            queryClient.setQueryData(SESSION_QUERY_KEY, user);
            router.replace(redirectingPath(homeFor(user.role), "reset"));
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change your password.")),
    });

    const form = useZodForm({
        schema,
        initialValues: { code: "", password: "" },
        onSubmit: (values) => reset.mutate(values),
    });

    if (email === null) return <Skeleton className="h-80" />;

    return (
        <div className="space-y-6">
            <header className="text-center">
                <h1 className="text-2xl font-bold">Choose a new password</h1>
                <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code we emailed you, then your new password.</p>
            </header>

            <form className="space-y-5" noValidate onSubmit={form.handleSubmit}>
                <div className="space-y-1.5">
                    <Label htmlFor="reset-email-address">Email</Label>
                    <div
                        id="reset-email-address"
                        className="flex h-11 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-base text-foreground sm:h-10 sm:text-sm"
                    >
                        <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{email}</span>
                    </div>
                </div>
                <FormField form={form} name="code" label="Reset code" required hint="Six digits, from the email. It works for 15 minutes.">
                    <OtpInput />
                </FormField>
                <AuthField
                    form={form}
                    name="password"
                    label="New password"
                    icon={LockKeyhole}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Choose a new password"
                    showStrength
                />
                <Button type="submit" size="lg" variant="brand" className="w-full" isLoading={reset.isPending}>
                    Change password
                </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
                No code?{" "}
                <Link href={`/forgot-password?email=${encodeURIComponent(email)}`} className="font-semibold text-primary hover:underline">
                    Send another
                </Link>
            </p>
        </div>
    );
}
