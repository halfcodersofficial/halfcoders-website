"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AccountCard } from "@/components/profile/AccountCard";
import { ProfilePhotoField } from "@/components/profile/ProfilePhotoField";
import { SectionPanel } from "@/components/profile/SectionPanel";
import { ViewField } from "@/components/profile/ViewField";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { nameField, optionalPhoneField } from "@/lib/validation";
import { authService } from "@/services";
import { studentProfileService } from "@/services/studentProfile";

const myProfileSchema = z.object({
    name: nameField,
    whatsapp: optionalPhoneField,
});

const OVERVIEW_KEY = ["student-profile", "overview"];

/**
 * The sidebar hub — identity fields (name/WhatsApp, read-only student id),
 * the photo (changeable whether or not the panel is being edited), and the
 * sign-in details with the password (see AccountCard).
 */
export default function MyProfilePage() {
    const queryClient = useQueryClient();

    const { data: overview, isLoading } = useQuery({
        queryKey: OVERVIEW_KEY,
        queryFn: studentProfileService.overview,
    });

    const save = useMutation({
        mutationFn: (values: z.output<typeof myProfileSchema>) =>
            authService.updateProfile({
                name: values.name,
                whatsapp: values.whatsapp || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
            queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
            toast.success("Profile updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your profile.")),
    });

    const form = useZodForm({
        schema: myProfileSchema,
        initialValues: { name: "", whatsapp: "" },
        // Unused — SectionPanel drives the save itself so it can await it.
        onSubmit: () => {},
    });

    const profile = overview?.profile;

    return (
        <div className="space-y-6">
            <SectionPanel
                title="My Profile"
                icon={UserRound}
                isLoading={isLoading}
                isSaving={save.isPending}
                onEdit={() =>
                    form.reset({
                        name: profile?.name ?? "",
                        whatsapp: profile?.whatsapp ?? "",
                    })
                }
                onCancel={() => form.reset()}
                onSave={async () => {
                    form.submit();
                    if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                    return save.mutateAsync(myProfileSchema.parse(form.values));
                }}
                renderView={
                    // The photo saves on its own, so it's offered here too — not only after "Edit".
                    <div className="space-y-5">
                        <ProfilePhotoField src={profile?.image ?? null} name={profile?.name ?? "?"} />
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <ViewField label="Full Name" value={profile?.name} />
                            <ViewField label="Student ID" value={profile?.studentId} />
                            <ViewField label="WhatsApp Number" value={profile?.whatsapp} />
                        </dl>
                    </div>
                }
                renderEdit={
                    <div className="grid gap-4 sm:grid-cols-2">
                        <ProfilePhotoField src={profile?.image ?? null} name={profile?.name ?? "?"} />
                        <FormField
                            form={form}
                            name="name"
                            label="Full Name"
                            required
                            hint="As it appears on your certificates."
                        >
                            <Input autoComplete="name" />
                        </FormField>
                        <FormField form={form} name="whatsapp" label="WhatsApp Number" optional>
                            <Input type="tel" inputMode="tel" placeholder="01712345678" />
                        </FormField>
                    </div>
                }
            />

            <AccountCard email={profile?.email ?? null} phone={profile?.phone ?? null} />
        </div>
    );
}
