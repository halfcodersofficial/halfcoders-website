"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
    EMPTY_PROFILE,
    profilePayload,
    ProfileFields,
    profileShape,
    toExpertise,
    type ProfileValues,
} from "@/components/admin/mentorProfile";
import {
    MentorPhotoPicker,
    photoField,
    photoImage,
    photoLabel,
    photoPreview,
    usePhotoUpload,
    type PhotoUpload,
} from "@/components/admin/mentorPhoto";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Modal,
    ModalBody,
    ModalDescription,
    ModalFooter,
    modalFormClass,
    ModalHeader,
    ModalSteps,
    ModalTitle,
} from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { NotProvided, ReviewRow, ReviewSection } from "@/components/ui/review";
import { useStepFlow } from "@/hooks/useStepFlow";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { emailField, optionalPhoneField, passwordField } from "@/lib/validation";
import { adminService } from "@/services/admin";

// Phone is asked for only when a brand-new account is created: afterwards it
// belongs to the account holder, who changes it in their own settings.
const createSchema = z.object({
    ...profileShape,
    phone: optionalPhoneField,
    email: emailField,
    password: passwordField,
    photo: photoField,
});

interface CreateValues extends ProfileValues {
    phone: string;
    email: string;
    password: string;
    photo: string;
}

const STEPS = [
    {
        label: "Account",
        description:
            "Their sign-in email. If the email already has an account, that account is linked instead of creating a new one.",
        fields: ["name", "email", "password", "phone"],
    },
    {
        label: "Profile",
        description:
            "Shown on the Mentors page and on each course they teach. The photo is required; everything else from here on is optional.",
        fields: ["photo", "designation", "experience", "expertise"],
    },
    {
        label: "About",
        description: "A short introduction for students. Can be filled in now or later.",
        fields: ["bio"],
    },
] as const;

const STEP_LABELS = STEPS.map((step) => step.label);

interface CreateMentorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Create a mentor: three steps, then a review of everything entered, where
 * any section can be reopened before the account is created. Creating makes
 * an existing student with that email a mentor, or creates an account with
 * the temporary password.
 */
export default function CreateMentorModal({ open, onOpenChange }: CreateMentorModalProps) {
    return (
        <Modal open={open} onOpenChange={onOpenChange} closeOnOutsideClick={false}>
            <CreateMentorWizard onClose={() => onOpenChange(false)} />
        </Modal>
    );
}

function CreateMentorWizard({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();

    // Three steps, then a read-only summary holding the real Create button.
    const flow = useStepFlow(STEPS.length);
    const { step } = flow;
    const stepRef = useRef<HTMLDivElement>(null);
    const [upload, setUpload] = usePhotoUpload();

    const create = useMutation({
        mutationFn: async (values: z.output<typeof createSchema>) => {
            const mentor = await adminService.createMentor({
                ...profilePayload(values),
                phone: values.phone || undefined,
                email: values.email,
                password: values.password,
                designation: values.designation || undefined,
                experience: values.experience || undefined,
                bio: values.bio || undefined,
            });

            // A linked account keeps the photo its owner already has.
            const keptOwnPhoto = Boolean(mentor.linkedExistingAccount && mentor.image);
            if (keptOwnPhoto) return { mentor, keptOwnPhoto, photoFailed: false };

            // The photo needs the account to exist, and the mentor does either
            // way past this point — a failed upload is a warning on top of
            // success, not a reason to treat the whole create as failed.
            try {
                await adminService.updateMentorPhoto(mentor.id, await photoImage(values.photo, upload));
                return { mentor, keptOwnPhoto, photoFailed: false };
            } catch {
                return { mentor, keptOwnPhoto, photoFailed: true };
            }
        },
        onSuccess: ({ mentor, keptOwnPhoto, photoFailed }) => {
            toast.success(
                mentor.linkedExistingAccount
                    ? `${mentor.name} is now a mentor. They already had an account (with no other activity) and sign in with their own password.${keptOwnPhoto ? " Their existing profile photo was kept." : ""}`
                    : `${mentor.name} created. Share the temporary password — they'll change it on first sign-in.`,
            );
            if (photoFailed) {
                toast.error(`${mentor.name} was created, but the photo didn't upload — add it from Edit.`);
            }
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
            onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't create that mentor.")),
    });

    const form = useZodForm({
        schema: createSchema,
        initialValues: { ...EMPTY_PROFILE, phone: "", email: "", password: "", photo: "" },
        onSubmit: (values) => create.mutate(values),
    });

    const { idFor } = form;

    // Focus follows the step: its first field, or the summary on review.
    useEffect(() => {
        if (step === STEPS.length) stepRef.current?.focus();
        else document.getElementById(idFor(STEPS[step].fields[0]))?.focus();
    }, [step, idFor]);

    /** Reveals the step's errors and focuses the first; true when it has none. */
    const checkStep = (index: number) => {
        const { fields } = STEPS[index];
        fields.forEach((name) => form.touch(name));
        const invalid = fields.find((name) => name in form.errors);
        if (invalid) document.getElementById(idFor(invalid))?.focus();
        return !invalid;
    };

    // Next, Create and Confirm are all this form's submit button, so Enter in
    // a field moves forward exactly like clicking it.
    const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (flow.justChanged()) return;

        if (flow.isReview) {
            // Each step was checked on the way here, but one reopened from the
            // review and then left with Back wasn't checked again.
            const invalid = STEPS.findIndex(({ fields }) => fields.some((name) => name in form.errors));
            if (invalid !== -1) {
                STEPS[invalid].fields.forEach((name) => form.touch(name));
                flow.editFromReview(invalid);
                return;
            }
            form.submit();
            return;
        }

        if (!checkStep(step)) return;
        flow.advance();
    };

    const primary =
        flow.isReview ? (
            <>
                <UserPlus /> Confirm &amp; create
            </>
        ) : flow.returnToReview ? (
            <>
                <Check /> Back to review
            </>
        ) : flow.isLastStep ? (
            <>
                <UserPlus /> Create
            </>
        ) : (
            <>
                Next <ArrowRight />
            </>
        );

    return (
        <>
            <ModalHeader>
                <ModalTitle>{flow.isReview ? "Review and create" : "New mentor"}</ModalTitle>
                <ModalDescription>
                    {flow.isReview
                        ? "Check what you entered. Edit any section to change it, then confirm to create the account."
                        : STEPS[step].description}
                </ModalDescription>
                <ModalSteps
                    steps={STEP_LABELS}
                    current={step}
                    canSelect={(index) => index < step && !create.isPending}
                    onSelect={flow.select}
                />
            </ModalHeader>

            <form className={modalFormClass} noValidate onSubmit={onSubmit}>
                <ModalBody className="sm:min-h-[min(24rem,55dvh)]">
                    <div
                        key={step}
                        ref={stepRef}
                        tabIndex={-1}
                        className={cn("space-y-4 outline-none", flow.enterClass)}
                    >
                        {step === 0 && (
                            <>
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
                                    hint="Used for a new account. An existing student's email makes them a mentor and keeps their own password; an admin's email can't be used. Reveal it to copy and share; they'll change it on first sign-in."
                                >
                                    <PasswordInput autoComplete="new-password" showStrength />
                                </FormField>

                                <FormField form={form} name="phone" label="Phone" optional hint="Bangladeshi mobile number.">
                                    <Input type="tel" inputMode="tel" placeholder="01712345678" />
                                </FormField>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <RequiredLegend />

                                <FormField
                                    form={form}
                                    name="photo"
                                    label="Photo"
                                    required
                                    hint="Upload their photo (cropped to a square), or use a default avatar for now."
                                >
                                    <MentorPhotoPicker upload={upload} onUpload={setUpload} />
                                </FormField>

                                <ProfileFields form={form} only={["designation", "experience", "expertise"]} />
                            </>
                        )}

                        {step === 2 && <ProfileFields form={form} only={["bio"]} bioRows={9} />}

                        {flow.isReview && (
                            <MentorReview
                                values={form.values}
                                upload={upload}
                                onEdit={flow.editFromReview}
                                disabled={create.isPending}
                            />
                        )}
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button type="button" variant="ghost" className="sm:mr-auto" onClick={onClose}>
                        Cancel
                    </Button>
                    {step > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => flow.goTo(step - 1)}
                            disabled={create.isPending}
                        >
                            <ArrowLeft /> Back
                        </Button>
                    )}
                    <Button type="submit" isLoading={flow.isReview && create.isPending}>
                        {primary}
                    </Button>
                </ModalFooter>
            </form>
        </>
    );
}

interface MentorReviewProps {
    values: CreateValues;
    upload: PhotoUpload | null;
    onEdit: (step: number) => void;
    disabled: boolean;
}

/** Everything entered, as it will be saved, with a way back into each step. */
function MentorReview({ values, upload, onEdit, disabled }: MentorReviewProps) {
    const [showPassword, setShowPassword] = useState(false);

    const name = values.name.trim();
    const photo = photoPreview(values.photo, upload);
    const headline = [values.designation, values.experience]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" · ");
    const skills = toExpertise(values.expertise);
    const bio = values.bio.trim();

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-secondary/40 p-3">
                {photo ? (
                    // A blob: preview or a local SVG, so a plain <img> rather than the optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                    <Avatar name={name} size={48} />
                )}
                <div className="min-w-0">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="truncate text-sm text-muted-foreground">{headline || "No designation yet"}</p>
                </div>
            </div>

            <ReviewSection title="Account" onEdit={() => onEdit(0)} disabled={disabled}>
                <dl className="space-y-2.5">
                    <ReviewRow label="Full name">{name}</ReviewRow>
                    <ReviewRow label="Email">{values.email.trim()}</ReviewRow>
                    <ReviewRow label="Temporary password">
                        <span className="flex items-center gap-1">
                            <span className="break-all font-mono tracking-wide">
                                {showPassword ? values.password : "*".repeat(values.password.length)}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowPassword((current) => !current)}
                                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </span>
                    </ReviewRow>
                    <ReviewRow label="Phone">{values.phone.trim() || <NotProvided />}</ReviewRow>
                </dl>
            </ReviewSection>

            <ReviewSection title="Profile" onEdit={() => onEdit(1)} disabled={disabled}>
                <dl className="space-y-2.5">
                    <ReviewRow label="Photo">{photoLabel(values.photo)}</ReviewRow>
                    <ReviewRow label="Designation">{values.designation.trim() || <NotProvided />}</ReviewRow>
                    <ReviewRow label="Experience">{values.experience.trim() || <NotProvided />}</ReviewRow>
                    <ReviewRow label="Expertise">
                        {skills.length > 0 ? (
                            <span className="flex flex-wrap gap-1">
                                {skills.map((skill, index) => (
                                    <Badge key={index} variant="secondary">{skill}</Badge>
                                ))}
                            </span>
                        ) : (
                            <NotProvided />
                        )}
                    </ReviewRow>
                </dl>
            </ReviewSection>

            <ReviewSection title="About" onEdit={() => onEdit(2)} disabled={disabled}>
                {bio ? <p className="whitespace-pre-line wrap-break-word text-sm">{bio}</p> : <NotProvided />}
            </ReviewSection>
        </div>
    );
}
