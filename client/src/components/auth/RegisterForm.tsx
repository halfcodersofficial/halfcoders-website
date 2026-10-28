"use client";

import { useMutation } from "@tanstack/react-query";
import { LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import ContinueWithGoogle from "@/components/auth/ContinueWithGoogle";
import DeviceLimitStep from "@/components/auth/DeviceLimitStep";
import { AuthField } from "@/components/shared/AuthField";
import { Button } from "@/components/ui/button";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { useZodForm } from "@/hooks/useZodForm";
import { realEmailField } from "@/lib/disposableEmail";
import { getApiErrorMessage } from "@/lib/httpClient";
import { nameField, passwordField, phoneField } from "@/lib/validation";
import { authService } from "@/services";

const schema = z.object({
    name: nameField,
    email: realEmailField,
    phone: phoneField,
    password: passwordField,
});

/**
 * Sign-up: with Google in one step, or name, a real email (it's where every
 * code and receipt goes), a mobile number, and a password — then a code is
 * mailed straight away and the verify step follows. Google on someone who
 * already has an account just signs them in.
 */
export default function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get("next");
    const google = useGoogleSignIn();

    const register = useMutation({
        mutationFn: (values: z.output<typeof schema>) => authService.register(values),
        onSuccess: ({ email }) => {
            toast.success("Account created — check your email for the code.");
            const query = new URLSearchParams({ email, ...(next ? { next } : {}) });
            router.push(`/verify-email?${query}`);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't create your account.")),
    });

    const form = useZodForm({
        schema,
        initialValues: { name: "", email: "", phone: "", password: "" },
        onSubmit: (values) => register.mutate(values),
    });

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
                <h1 className="text-3xl font-bold tracking-tight">Start your coding journey</h1>
                <p className="mt-2 text-sm text-muted-foreground">One free account for every Half Coders course.</p>
            </header>

            <ContinueWithGoogle
                label="Sign up with Google"
                onCode={google.signIn}
                busy={google.isPending}
                dividerLabel="or sign up with email"
            />

            <form className="space-y-4" noValidate onSubmit={form.handleSubmit}>
                <AuthField form={form} name="name" label="Full name" icon={UserRound} autoComplete="name" placeholder="Your name" autoFocus />
                <AuthField
                    form={form}
                    name="email"
                    label="Email address"
                    icon={Mail}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    hint="A real inbox you check — temporary emails can't be used. University and work emails are welcome."
                />
                <AuthField
                    form={form}
                    name="phone"
                    label="Mobile number"
                    icon={Phone}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="01712345678"
                    hint="So we can reach you about your courses."
                />
                <AuthField
                    form={form}
                    name="password"
                    label="Password"
                    icon={LockKeyhole}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Choose a password"
                    showStrength
                />

                <Button type="submit" size="lg" variant="brand" className="h-13 w-full text-base" isLoading={register.isPending}>
                    Create account
                </Button>
            </form>

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
                By creating an account you agree to our{" "}
                <Link href="/terms" className="font-medium text-primary hover:underline">
                    terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy-policy" className="font-medium text-primary hover:underline">
                    privacy policy
                </Link>
                .
            </p>
            <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
