"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SectionPanel } from "@/components/profile/SectionPanel";
import { ViewField } from "@/components/profile/ViewField";
import { FormField } from "@/components/ui/form";
import { Input, RadioGroup, Select } from "@/components/ui/input";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import {
    AGE_RANGE_OPTIONS,
    AREA_TYPE_OPTIONS,
    DEVICE_TYPE_OPTIONS,
    INTERNET_TYPE_OPTIONS,
    YEARS_OF_EXPERIENCE_OPTIONS,
} from "@/lib/profileOptions";
import { optionalTextField } from "@/lib/validation";
import { studentProfileService } from "@/services/studentProfile";

const schema = z.object({
    gender: z.enum(["MALE", "FEMALE", ""]),
    ageRange: optionalTextField({ label: "Age range" }),
    primaryDeviceType: optionalTextField({ label: "Primary device type" }),
    internetType: optionalTextField({ label: "Internet type" }),
    yearsOfExperience: optionalTextField({ label: "Years of experience" }),
    employmentRole: optionalTextField({ label: "Employment role", max: 120 }),
    areaType: optionalTextField({ label: "Area type" }),
});

const QUERY_KEY = ["student-profile", "additional-info"];

export default function AdditionalInfoPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: studentProfileService.additionalInfo,
    });

    const save = useMutation({
        mutationFn: (values: z.output<typeof schema>) =>
            studentProfileService.updateAdditionalInfo({
                gender: values.gender || undefined,
                ageRange: values.ageRange || undefined,
                primaryDeviceType: values.primaryDeviceType || undefined,
                internetType: values.internetType || undefined,
                yearsOfExperience: values.yearsOfExperience || undefined,
                employmentRole: values.employmentRole || undefined,
                areaType: values.areaType || undefined,
            }),
        onSuccess: (updated) => {
            queryClient.setQueryData(QUERY_KEY, updated);
            queryClient.invalidateQueries({ queryKey: ["student-profile", "overview"] });
            toast.success("Additional info updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your info.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            gender: "",
            ageRange: "",
            primaryDeviceType: "",
            internetType: "",
            yearsOfExperience: "",
            employmentRole: "",
            areaType: "",
        },
        // Unused — SectionPanel drives the save itself so it can await it.
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            gender: data?.gender ?? "",
            ageRange: data?.ageRange ?? "",
            primaryDeviceType: data?.primaryDeviceType ?? "",
            internetType: data?.internetType ?? "",
            yearsOfExperience: data?.yearsOfExperience ?? "",
            employmentRole: data?.employmentRole ?? "",
            areaType: data?.areaType ?? "",
        });

    const genderLabel = data?.gender === "MALE" ? "Male" : data?.gender === "FEMALE" ? "Female" : undefined;

    return (
        <SectionPanel
            title="Additional Info"
            icon={Info}
            empty={data ? undefined : { title: "No additional info yet", description: "Add your age range, device, internet type and experience." }}
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
                    <ViewField label="Your Gender" value={genderLabel} />
                    <ViewField label="Age Range" value={data?.ageRange} />
                    <ViewField label="Primary Device Type" value={data?.primaryDeviceType} />
                    <ViewField label="Internet Type" value={data?.internetType} />
                    <ViewField label="Years Of Experience" value={data?.yearsOfExperience} />
                    <ViewField label="Employment Role" value={data?.employmentRole} />
                    <ViewField label="Area Type" value={data?.areaType} />
                </dl>
            }
            renderEdit={
                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField form={form} name="gender" label="Your Gender" optional>
                        <RadioGroup
                            inline
                            options={[
                                { value: "MALE", label: "Male" },
                                { value: "FEMALE", label: "Female" },
                            ]}
                        />
                    </FormField>
                    <FormField form={form} name="ageRange" label="Age Range" optional>
                        <Select placeholder="Select">
                            {AGE_RANGE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField form={form} name="primaryDeviceType" label="Primary Device Type" optional>
                        <Select placeholder="Select">
                            {DEVICE_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField form={form} name="internetType" label="Internet Type" optional>
                        <Select placeholder="Select">
                            {INTERNET_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField form={form} name="yearsOfExperience" label="Years Of Experience" optional>
                        <Select placeholder="Select">
                            {YEARS_OF_EXPERIENCE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField form={form} name="employmentRole" label="Employment Role" optional>
                        <Input placeholder="e.g. None, Junior Developer" />
                    </FormField>
                    <FormField form={form} name="areaType" label="Area Type" optional>
                        <Select placeholder="Select">
                            {AREA_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                </div>
            }
        />
    );
}
