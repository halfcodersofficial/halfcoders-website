"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SectionPanel } from "@/components/profile/SectionPanel";
import { ViewField } from "@/components/profile/ViewField";
import { FormField } from "@/components/ui/form";
import { RadioGroup, Select } from "@/components/ui/input";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { JOB_PREFERENCE_OPTIONS, JOB_TYPE_OPTIONS } from "@/lib/profileOptions";
import { optionalTextField } from "@/lib/validation";
import { studentProfileService } from "@/services/studentProfile";

const YES_NO = ["true", "false", ""] as const;

const schema = z.object({
    wantsJob: z.enum(YES_NO),
    jobType: optionalTextField({ label: "Job type" }),
    jobPreference: optionalTextField({ label: "Job preference" }),
    wantsJobOutsideBangladesh: z.enum(YES_NO),
    hasJobExperience: z.enum(YES_NO),
});

const QUERY_KEY = ["student-profile", "job-profile"];

const yesNoLabel = (value: boolean | null | undefined) =>
    value === null || value === undefined ? undefined : value ? "Yes" : "No";

const yesNoToForm = (value: boolean | null | undefined) =>
    value === null || value === undefined ? "" : value ? "true" : "false";

const formToYesNo = (value: string) => (value === "" ? undefined : value === "true");

export default function JobProfilePage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: studentProfileService.jobProfile });

    const save = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            studentProfileService.updateJobProfile({
                wantsJob: formToYesNo(values.wantsJob),
                jobType: values.jobType || undefined,
                jobPreference: values.jobPreference || undefined,
                wantsJobOutsideBangladesh: formToYesNo(values.wantsJobOutsideBangladesh),
                hasJobExperience: formToYesNo(values.hasJobExperience),
            }),
        onSuccess: (updated) => {
            queryClient.setQueryData(QUERY_KEY, updated);
            queryClient.invalidateQueries({ queryKey: ["student-profile", "overview"] });
            toast.success("Job profile updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your job profile.")),
    });

    const form = useZodForm({
        schema,
        initialValues: { wantsJob: "", jobType: "", jobPreference: "", wantsJobOutsideBangladesh: "", hasJobExperience: "" },
        // Unused — SectionPanel drives the save itself so it can await it.
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            wantsJob: yesNoToForm(data?.wantsJob),
            jobType: data?.jobType ?? "",
            jobPreference: data?.jobPreference ?? "",
            wantsJobOutsideBangladesh: yesNoToForm(data?.wantsJobOutsideBangladesh),
            hasJobExperience: yesNoToForm(data?.hasJobExperience),
        });

    return (
        <SectionPanel
            title="Job Profile"
            icon={Briefcase}
            empty={data ? undefined : { title: "Your job profile is empty", description: "Tell us whether you're looking for a job, and what kind." }}
            isLoading={isLoading}
            isSaving={save.isPending}
            onEdit={seed}
            onCancel={() => form.reset()}
            onSave={async () => {
                form.submit();
                if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                return save.mutateAsync(schema.parse(form.values));
            }}
            renderView={
                <dl className="grid gap-4 sm:grid-cols-2">
                    <ViewField label="Do you want job?" value={yesNoLabel(data?.wantsJob)} />
                    <ViewField label="What type of job are you looking for?" value={data?.jobType} />
                    <ViewField label="Your job preference" value={data?.jobPreference} />
                    <ViewField
                        label="Want to do a job outside Bangladesh?"
                        value={yesNoLabel(data?.wantsJobOutsideBangladesh)}
                    />
                    <ViewField label="Do you have any job experience?" value={yesNoLabel(data?.hasJobExperience)} />
                </dl>
            }
            renderEdit={
                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField form={form} name="wantsJob" label="Do you want job?" optional>
                        <RadioGroup
                            inline
                            options={[
                                { value: "true", label: "Yes" },
                                { value: "false", label: "No" },
                            ]}
                        />
                    </FormField>
                    <FormField form={form} name="jobType" label="What type of job are you looking for?" optional>
                        <Select placeholder="Select">
                            {JOB_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField form={form} name="jobPreference" label="Your job preference" optional>
                        <Select placeholder="Select">
                            {JOB_PREFERENCE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField
                        form={form}
                        name="wantsJobOutsideBangladesh"
                        label="Want to do a job outside Bangladesh?"
                        optional
                    >
                        <RadioGroup
                            inline
                            options={[
                                { value: "true", label: "Yes" },
                                { value: "false", label: "No" },
                            ]}
                        />
                    </FormField>
                    <FormField form={form} name="hasJobExperience" label="Do you have any job experience?" optional>
                        <RadioGroup
                            inline
                            options={[
                                { value: "true", label: "Yes" },
                                { value: "false", label: "No" },
                            ]}
                        />
                    </FormField>
                </div>
            }
        />
    );
}
