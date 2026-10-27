"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SectionPanel } from "@/components/profile/SectionPanel";
import { ViewField } from "@/components/profile/ViewField";
import { FormField } from "@/components/ui/form";
import { Checkbox, Input, RadioGroup, Select } from "@/components/ui/input";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { CURRENT_YEAR_OPTIONS, EDUCATION_LEVEL_OPTIONS } from "@/lib/profileOptions";
import { optionalNumericField, optionalTextField } from "@/lib/validation";
import { studentProfileService } from "@/services/studentProfile";

const schema = z.object({
    level: optionalTextField({ label: "Education level" }),
    examTitle: optionalTextField({ label: "Exam/Degree title", max: 160 }),
    institutionName: optionalTextField({ label: "Institution name", max: 160 }),
    passingYear: optionalNumericField({ label: "Approximate passing year", min: 1980, max: 2100 }),
    isCurrentlyStudying: z.boolean(),
    currentYear: optionalTextField({ label: "Current year" }),
    isCseStudent: z.enum(["true", "false", ""]),
});

const QUERY_KEY = ["student-profile", "education"];

export default function EducationPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: studentProfileService.education });

    const save = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            studentProfileService.updateEducation({
                level: values.level || undefined,
                examTitle: values.examTitle || undefined,
                institutionName: values.institutionName || undefined,
                passingYear: values.passingYear ? Number(values.passingYear) : undefined,
                isCurrentlyStudying: values.isCurrentlyStudying,
                currentYear: values.isCurrentlyStudying ? values.currentYear || undefined : undefined,
                isCseStudent: values.isCseStudent === "" ? undefined : values.isCseStudent === "true",
            }),
        onSuccess: (updated) => {
            queryClient.setQueryData(QUERY_KEY, updated);
            queryClient.invalidateQueries({ queryKey: ["student-profile", "overview"] });
            toast.success("Education updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your education.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            level: "",
            examTitle: "",
            institutionName: "",
            passingYear: "",
            isCurrentlyStudying: false,
            currentYear: "",
            isCseStudent: "",
        },
        // Unused — SectionPanel drives the save itself so it can await it.
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            level: data?.level ?? "",
            examTitle: data?.examTitle ?? "",
            institutionName: data?.institutionName ?? "",
            passingYear: data?.passingYear ? String(data.passingYear) : "",
            isCurrentlyStudying: data?.isCurrentlyStudying ?? false,
            currentYear: data?.currentYear ?? "",
            isCseStudent: data?.isCseStudent === null || data?.isCseStudent === undefined
                ? ""
                : data.isCseStudent
                    ? "true"
                    : "false",
        });

    const cseLabel = data?.isCseStudent === null || data?.isCseStudent === undefined
        ? undefined
        : data.isCseStudent
            ? "Yes"
            : "No";

    return (
        <SectionPanel
            title="Education"
            icon={GraduationCap}
            empty={data ? undefined : { title: "No education added yet", description: "Add your current or most recent education." }}
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
                    <ViewField label="Your Education level" value={data?.level} />
                    <ViewField label="Exam/Degree Title" value={data?.examTitle} />
                    <ViewField label="Institution Name" value={data?.institutionName} />
                    <ViewField label="Approximate Passing Year" value={data?.passingYear} />
                    {data?.isCurrentlyStudying && <ViewField label="Current Year" value={data?.currentYear} />}
                    <ViewField label="Are you a CSE/CS student?" value={cseLabel} />
                </dl>
            }
            renderEdit={
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField form={form} name="level" label="Select your Education level" optional>
                            <Select placeholder="Select">
                                {EDUCATION_LEVEL_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </Select>
                        </FormField>
                        <FormField form={form} name="examTitle" label="Exam/Degree Title" optional counterMax={160}>
                            <Input />
                        </FormField>
                        <FormField
                            form={form}
                            name="institutionName"
                            label="Institution Name"
                            optional
                            counterMax={160}
                        >
                            <Input />
                        </FormField>
                        <FormField form={form} name="passingYear" label="Approximate Passing Year" optional>
                            <Input inputMode="numeric" placeholder="2027" />
                        </FormField>
                    </div>

                    <Checkbox
                        checked={form.values.isCurrentlyStudying}
                        onChange={(event) => form.setValue("isCurrentlyStudying", event.target.checked)}
                    >
                        I&apos;m Currently Studying
                    </Checkbox>

                    {form.values.isCurrentlyStudying && (
                        <FormField form={form} name="currentYear" label="Current Year" optional>
                            <Select placeholder="Select">
                                {CURRENT_YEAR_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </Select>
                        </FormField>
                    )}

                    <FormField form={form} name="isCseStudent" label="Are you a CSE/CS student?" optional>
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
