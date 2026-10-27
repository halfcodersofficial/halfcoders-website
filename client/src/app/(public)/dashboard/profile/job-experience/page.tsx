"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, CalendarDays, Cpu } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EntryChip, EntryView, durationLabel, periodLabel } from "@/components/profile/EntryView";
import { InlineEditRow } from "@/components/profile/InlineEditRow";
import { RepeatableList } from "@/components/profile/RepeatableList";
import { DateInput } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form";
import { Checkbox, Input, RadioGroup, Textarea } from "@/components/ui/input";
import { useZodForm, type ZodFormApi } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { optionalTextField, textField } from "@/lib/validation";
import { studentJobExperienceService } from "@/services/studentProfile";
import type { StudentJobExperience } from "@/types/profile.types";

const QUERY_KEY = ["student-job-experiences"];

const experienceSchema = z.object({
    designation: textField({ label: "Job Designation", max: 160 }),
    companyName: textField({ label: "Company Name", max: 160 }),
    isRelatedToIt: z.enum(["true", "false", ""]),
    description: optionalTextField({ label: "Description", max: 2000 }),
    isCurrentlyWorking: z.boolean(),
    startDate: z.string().trim(),
    endDate: z.string().trim(),
});

type ExperienceFormValues = z.infer<typeof experienceSchema>;

const blankValues: ExperienceFormValues = {
    designation: "",
    companyName: "",
    isRelatedToIt: "",
    description: "",
    isCurrentlyWorking: false,
    startDate: "",
    endDate: "",
};

const buildPayload = (values: ExperienceFormValues) => ({
    designation: values.designation,
    companyName: values.companyName,
    isRelatedToIt: values.isRelatedToIt === "" ? undefined : values.isRelatedToIt === "true",
    description: values.description || undefined,
    isCurrentlyWorking: values.isCurrentlyWorking,
    startDate: values.startDate || undefined,
    endDate: values.isCurrentlyWorking ? null : values.endDate || undefined,
});

/** The add-form / edit-form fields shared by the "add new" card and every row. */
function ExperienceFormFields({ form }: { form: ZodFormApi<ExperienceFormValues> }) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField form={form} name="designation" label="Job Designation" required counterMax={160}>
                    <Input />
                </FormField>
                <FormField form={form} name="companyName" label="Company Name" required counterMax={160}>
                    <Input />
                </FormField>
            </div>

            <FormField form={form} name="isRelatedToIt" label="Related to IT?" optional>
                <RadioGroup
                    inline
                    options={[
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" },
                    ]}
                />
            </FormField>

            <FormField form={form} name="description" label="Description" optional counterMax={2000}>
                <Textarea />
            </FormField>

            <Checkbox
                checked={form.values.isCurrentlyWorking}
                onChange={(event) => form.setValue("isCurrentlyWorking", event.target.checked)}
            >
                I am currently working in this role
            </Checkbox>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField form={form} name="startDate" label="Start Date" optional>
                    <DateInput />
                </FormField>
                {!form.values.isCurrentlyWorking && (
                    <FormField form={form} name="endDate" label="End Date" optional>
                        <DateInput />
                    </FormField>
                )}
            </div>
        </div>
    );
}

export default function JobExperiencePage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: studentJobExperienceService.list,
    });
    const experiences = data?.data ?? [];

    const create = useMutation({
        mutationFn: (values: ExperienceFormValues) => studentJobExperienceService.create(buildPayload(values)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success("Experience added.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't add this experience.")),
    });

    const form = useZodForm({
        schema: experienceSchema,
        initialValues: blankValues,
        // Unused — RepeatableList drives the save itself so it can await it.
        onSubmit: () => {},
    });

    return (
        <RepeatableList
            title="Job Experience"
            icon={Briefcase}
            addLabel="Add Experience"
            isLoading={isLoading}
            isEmpty={experiences.length === 0}
            emptyIcon={Briefcase}
            emptyTitle="No job experience added yet"
            emptyDescription="Add your work history so mentors and employers can see it."
            onStartAdd={() => form.reset(blankValues)}
            onCancelAdd={() => form.reset()}
            isSavingAdd={create.isPending}
            onSubmitAdd={async () => {
                form.submit();
                if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                return create.mutateAsync(experienceSchema.parse(form.values));
            }}
            renderAddForm={<ExperienceFormFields form={form} />}
        >
            {experiences.map((experience) => (
                <JobExperienceRow key={experience.id} experience={experience} />
            ))}
        </RepeatableList>
    );
}

function JobExperienceRow({ experience }: { experience: StudentJobExperience }) {
    const queryClient = useQueryClient();

    const update = useMutation({
        mutationFn: (values: ExperienceFormValues) =>
            studentJobExperienceService.update(experience.id, buildPayload(values)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success("Experience updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update this experience.")),
    });

    const remove = useMutation({
        mutationFn: () => studentJobExperienceService.remove(experience.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success("Experience removed.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove this experience.")),
    });

    const form = useZodForm({
        schema: experienceSchema,
        initialValues: blankValues,
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            designation: experience.designation,
            companyName: experience.companyName,
            isRelatedToIt:
                experience.isRelatedToIt === null ? "" : experience.isRelatedToIt ? "true" : "false",
            description: experience.description ?? "",
            isCurrentlyWorking: experience.isCurrentlyWorking,
            startDate: experience.startDate ? experience.startDate.slice(0, 10) : "",
            endDate: experience.endDate ? experience.endDate.slice(0, 10) : "",
        });

    const relatedLabel =
        experience.isRelatedToIt === null ? undefined : experience.isRelatedToIt ? "Yes" : "No";
    const duration = durationLabel(experience.startDate, experience.endDate, experience.isCurrentlyWorking);

    return (
        <InlineEditRow
            onEdit={seed}
            onCancel={() => form.reset()}
            onSave={async () => {
                form.submit();
                if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                return update.mutateAsync(experienceSchema.parse(form.values));
            }}
            onDelete={() => remove.mutateAsync()}
            deleteConfirm={{ title: "Remove this experience?" }}
            isSaving={update.isPending}
            isDeleting={remove.isPending}
            renderView={
                <EntryView
                    company={experience.companyName}
                    title={experience.designation}
                    active={experience.isCurrentlyWorking}
                    chips={
                        <>
                            <EntryChip icon={CalendarDays}>
                                {periodLabel(experience.startDate, experience.endDate, experience.isCurrentlyWorking)}
                                {duration && ` · ${duration}`}
                            </EntryChip>
                            {experience.isCurrentlyWorking && <EntryChip tone="success">Currently working</EntryChip>}
                            {relatedLabel && <EntryChip icon={Cpu}>Related to IT: {relatedLabel}</EntryChip>}
                        </>
                    }
                >
                    {experience.description && <p className="whitespace-pre-line">{experience.description}</p>}
                </EntryView>
            }
            renderEdit={<ExperienceFormFields form={form} />}
        />
    );
}
