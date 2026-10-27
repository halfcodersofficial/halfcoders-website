"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthField } from "@/components/shared/AuthField";
import { Button } from "@/components/ui/button";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { currentPasswordField, passwordField } from "@/lib/validation";
import { authService } from "@/services";

const schema = z
    .object({ currentPassword: currentPasswordField, newPassword: passwordField })
    .refine((values) => values.newPassword !== values.currentPassword, {
        path: ["newPassword"],
        message: "Choose a password different from the current one",
    });

/**
 * Changes the password from inside the account — the settings page, and the
 * screen an account on a temporary password lands on. Other devices are signed
 * out; this one stays in.
 */
export default function ChangePasswordForm({ onDone, submitLabel = "Change password" }: { onDone?: () => void; submitLabel?: string }) {
    const queryClient = useQueryClient();

    const change = useMutation({
        mutationFn: (values: z.output<typeof schema>) => authService.changePassword(values),
        onSuccess: async () => {
            toast.success("Password changed. Your other devices have been signed out.");
            form.reset({ currentPassword: "", newPassword: "" });
            await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
            onDone?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't change your password.")),
    });

    const form = useZodForm({
        schema,
        initialValues: { currentPassword: "", newPassword: "" },
        onSubmit: (values) => change.mutate(values),
    });

    return (
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit}>
            <AuthField
                form={form}
                name="currentPassword"
                label="Current password"
                icon={KeyRound}
                type="password"
                autoComplete="current-password"
                placeholder="Your current password"
            />
            <AuthField
                form={form}
                name="newPassword"
                label="New password"
                icon={LockKeyhole}
                type="password"
                autoComplete="new-password"
                placeholder="Choose a new password"
                showStrength
            />
            <Button type="submit" size="lg" variant="brand" className="w-full" isLoading={change.isPending}>
                {submitLabel}
            </Button>
        </form>
    );
}
