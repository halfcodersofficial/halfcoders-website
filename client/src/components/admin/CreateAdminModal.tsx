"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalDescription, ModalFooter, modalFormClass, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { emailField, nameField, optionalPhoneField, passwordField } from "@/lib/validation";
import { adminService } from "@/services/admin";

const schema = z.object({
    name: nameField,
    email: emailField,
    password: passwordField,
    phone: optionalPhoneField,
});

const EMPTY = { name: "", email: "", password: "", phone: "" };

/**
 * A super admin adding an administrator: a new account on a temporary
 * password, which they're made to change at their first sign-in.
 */
export default function CreateAdminModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient();

    const create = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            adminService.createAdmin({ ...values, phone: values.phone.trim() || undefined }),
        onSuccess: (admin) => {
            toast.success(`${admin.name} is now an admin. Share the temporary password with them — they'll choose their own at first sign-in.`);
            void queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
            form.reset(EMPTY);
            onOpenChange(false);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't add that admin.")),
    });

    const form = useZodForm({ schema, initialValues: EMPTY, onSubmit: (values) => create.mutate(values) });

    return (
        <Modal open={open} onOpenChange={onOpenChange}>
            <ModalHeader>
                <ModalTitle>Add an admin</ModalTitle>
                <ModalDescription>A new account with full access to the admin console.</ModalDescription>
            </ModalHeader>
            <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
                <ModalBody className="space-y-4">
                    <RequiredLegend />
                    <FormField form={form} name="name" label="Full name" required>
                        <Input autoComplete="off" />
                    </FormField>
                    <FormField form={form} name="email" label="Email" required>
                        <Input type="email" autoComplete="off" placeholder="name@example.com" />
                    </FormField>
                    <FormField
                        form={form}
                        name="password"
                        label="Temporary password"
                        required
                        hint="Reveal it to copy and share; they'll change it at their first sign-in."
                    >
                        <PasswordInput autoComplete="new-password" showStrength />
                    </FormField>
                    <FormField form={form} name="phone" label="Phone" optional hint="Bangladeshi mobile number.">
                        <Input type="tel" inputMode="tel" placeholder="01712345678" />
                    </FormField>
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={create.isPending}>
                        <UserPlus /> Add admin
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
