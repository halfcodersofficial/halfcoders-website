"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { choosesNewPhoto, MentorPhotoPicker, photoImage, usePhotoUpload } from "@/components/admin/mentorPhoto";
import { profilePayload, ProfileFields, profileShape } from "@/components/admin/mentorProfile";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { refreshCoursePages } from "@/lib/refreshCoursePages";
import { adminService } from "@/services/admin";
import type { AdminMentorDetail } from "@/types/admin.types";

// The photo isn't required here: a mentor from before photos were required
// can still be edited without one.
const editSchema = z.object({ ...profileShape, photo: z.string() });

interface EditMentorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The mentor to edit. Keep it set while the modal closes, so it doesn't blank mid-animation. */
    mentorId: string | null;
}

/**
 * Edit a mentor's profile. Email, phone and password belong to the account
 * holder, so only the profile is editable here. New mentors
 * are created in CreateMentorModal.
 */
export default function EditMentorModal({ open, onOpenChange, mentorId }: EditMentorModalProps) {
    const close = () => onOpenChange(false);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            closeOnOutsideClick={false}
            title="Edit mentor"
            description="Changes show on their public profile and every course page they teach."
        >
            {mentorId && <EditMentorForm mentorId={mentorId} onClose={close} />}
        </Modal>
    );
}

function EditMentorForm({ mentorId, onClose }: { mentorId: string; onClose: () => void }) {
    const { data: mentor, isLoading, isError, error } = useQuery({
        queryKey: ["admin", "mentor", mentorId],
        queryFn: () => adminService.mentor(mentorId),
    });

    if (isLoading) {
        return (
            <ModalBody className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-16" />
                ))}
            </ModalBody>
        );
    }

    if (isError || !mentor) {
        return (
            <ModalBody>
                <p className="text-sm text-muted-foreground">
                    {getApiErrorMessage(error, "Couldn't load this mentor.")}
                </p>
            </ModalBody>
        );
    }

    return <EditMentorFields mentor={mentor} onClose={onClose} />;
}

function EditMentorFields({ mentor, onClose }: { mentor: AdminMentorDetail; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [upload, setUpload] = usePhotoUpload();

    const save = useMutation({
        mutationFn: async (values: z.output<typeof editSchema>) => {
            await adminService.updateMentor(mentor.id, profilePayload(values));
            if (choosesNewPhoto(values.photo, upload)) {
                await adminService.updateMentorPhoto(mentor.id, await photoImage(values.photo, upload));
            }
        },
        onSuccess: () => {
            toast.success("Mentor saved.");
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
            // The name, photo and bio are on every course page they teach.
            void refreshCoursePages();
            onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save that mentor.")),
    });

    const form = useZodForm({
        schema: editSchema,
        initialValues: {
            name: mentor.name,
            designation: mentor.mentorProfile?.designation ?? "",
            experience: mentor.mentorProfile?.experience ?? "",
            expertise: (mentor.mentorProfile?.expertise ?? []).join(", "),
            bio: mentor.bio ?? "",
            // "upload" is the photo in the first tile — until a new one is
            // uploaded, the saved one.
            photo: mentor.image ? "upload" : "",
        },
        onSubmit: (values) => save.mutate(values),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-6">
                <div className="rounded-md bg-secondary/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Signs in as</span>{" "}
                    {mentor.email ?? mentor.phone}
                    {mentor.email && mentor.phone ? ` · ${mentor.phone}` : ""}
                </div>

                <Section title="Account">
                    <FormField
                        form={form}
                        name="name"
                        label="Full name"
                        required
                        hint="As students see it on course pages."
                    >
                        <Input autoComplete="off" />
                    </FormField>
                </Section>

                <Section title="Public profile" hint="Shown on the Mentors page and on each course they teach.">
                    <FormField
                        form={form}
                        name="photo"
                        label="Photo"
                        hint="Upload a photo (cropped to a square), or use a default avatar."
                    >
                        <MentorPhotoPicker
                            upload={upload}
                            onUpload={setUpload}
                            current={mentor.image}
                            disabled={save.isPending}
                        />
                    </FormField>

                    <ProfileFields form={form} />
                </Section>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    isLoading={save.isPending}
                    // A replaced photo keeps the "upload" choice, so it doesn't dirty the form.
                    disabled={!form.isDirty && !choosesNewPhoto(form.values.photo, upload)}
                >
                    <Save /> Save changes
                </Button>
            </ModalFooter>
        </form>
    );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <fieldset className="space-y-4">
            <legend className="float-left mb-3 w-full">
                <span className="block text-sm font-semibold">{title}</span>
                {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
            </legend>
            <div className="clear-both space-y-4">{children}</div>
        </fieldset>
    );
}
