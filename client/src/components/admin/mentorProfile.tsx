"use client";

import { FormField } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { ListInput } from "@/components/ui/list-input";
import type { FormValues, ZodFormApi } from "@/hooks/useZodForm";
import { nameField, optionalTextField } from "@/lib/validation";

/**
 * The public mentor profile, shared by the create wizard (CreateMentorModal)
 * and the edit modal (EditMentorModal) so both validate and save it the same way.
 */

/** Comma-separated in the form, an array of skills in the API. */
export const toExpertise = (value: string) =>
    value.split(",").map((item) => item.trim()).filter(Boolean);

export const profileShape = {
    name: nameField,
    designation: optionalTextField({ label: "Designation", max: 120 }),
    experience: optionalTextField({ label: "Experience", max: 255 }),
    expertise: optionalTextField({ label: "Expertise" }).superRefine((value, ctx) => {
        const skills = toExpertise(value);
        if (skills.length > 20) {
            ctx.addIssue({ code: "custom", message: "List at most 20 skills" });
        }
        if (skills.some((skill) => skill.length > 60)) {
            ctx.addIssue({ code: "custom", message: "Each skill must be at most 60 characters" });
        }
    }),
    bio: optionalTextField({ label: "Bio", max: 2000 }),
};

export interface ProfileValues extends FormValues {
    name: string;
    designation: string;
    experience: string;
    expertise: string;
    bio: string;
}

export const EMPTY_PROFILE: ProfileValues = {
    name: "", designation: "", experience: "", expertise: "", bio: "",
};

export const profilePayload = (values: ProfileValues) => ({
    name: values.name,
    designation: values.designation,
    experience: values.experience,
    expertise: toExpertise(values.expertise),
    bio: values.bio,
});

type ProfileFieldName = "designation" | "experience" | "expertise" | "bio";

interface ProfileFieldsProps<TValues extends ProfileValues> {
    form: ZodFormApi<TValues>;
    /** Renders just these, for a form that spreads the profile over several steps. */
    only?: ProfileFieldName[];
    bioRows?: number;
}

export function ProfileFields<TValues extends ProfileValues>({ form, only, bioRows = 3 }: ProfileFieldsProps<TValues>) {
    const show = (name: ProfileFieldName) => !only || only.includes(name);

    return (
        <>
            {show("designation") && (
                <FormField form={form} name="designation" label="Designation" optional counterMax={120}>
                    <Input placeholder="Senior MERN Engineer" />
                </FormField>
            )}

            {show("experience") && (
                <FormField form={form} name="experience" label="Experience" optional counterMax={255}>
                    <Input placeholder="6 years" />
                </FormField>
            )}

            {show("expertise") && (
                <FormField
                    form={form}
                    name="expertise"
                    label="Expertise"
                    optional
                    hint="Shown as tags. Enter adds the next one."
                >
                    <ListInput
                        itemLabel="Skill"
                        addLabel="Add skill"
                        max={20}
                        separator="commas"
                        placeholder="React"
                    />
                </FormField>
            )}

            {show("bio") && (
                <FormField form={form} name="bio" label="Bio" optional counterMax={2000}>
                    <Textarea rows={bioRows} />
                </FormField>
            )}
        </>
    );
}
