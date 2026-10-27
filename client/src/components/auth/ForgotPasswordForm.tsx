"use client";

import { useMutation } from "@tanstack/react-query";
import { KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { AuthField } from "@/components/shared/AuthField";
import { Button } from "@/components/ui/button";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { emailField } from "@/lib/validation";
import { authService } from "@/services";

const schema = z.object({ email: emailField });

/** Asks for a reset code by email, then moves on to entering it. */
export default function ForgotPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const request = useMutation({
        mutationFn: (values: z.output<typeof schema>) => authService.forgotPassword(values.email),
        onSuccess: (_result, values) => {
            // The API answers the same way whether or not the email is on
            // file, so this screen does too.
            toast.success("If an account uses that email, a reset code is on its way.");
            router.push(`/reset-password?email=${encodeURIComponent(values.email.trim().toLowerCase())}`);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't send a reset code.")),
    });

    const form = useZodForm({
        schema,
        initialValues: { email: searchParams.get("email") ?? "" },
        onSubmit: (values) => request.mutate(values),
    });

    return (
        <div className="space-y-6">
            <header className="text-center">
                <span className="mx-auto mb-4 grid size-12 place-items-center rounded-md border border-primary/30 bg-primary/5 text-primary">
                    <KeyRound className="size-6" />
                </span>
                <h1 className="text-2xl font-bold">Forgot your password?</h1>
                <p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a code to choose a new one.</p>
            </header>

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
                <Button type="submit" size="lg" variant="brand" className="h-13 w-full text-base" isLoading={request.isPending}>
                    Send reset code
                </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
                Remembered it?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
