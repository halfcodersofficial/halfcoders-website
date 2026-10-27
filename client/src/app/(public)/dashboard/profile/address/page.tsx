"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SectionPanel } from "@/components/profile/SectionPanel";
import { ViewField } from "@/components/profile/ViewField";
import { FormField } from "@/components/ui/form";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { BD_DISTRICTS, COUNTRY_OPTIONS } from "@/lib/profileOptions";
import { optionalTextField } from "@/lib/validation";
import { studentProfileService } from "@/services/studentProfile";

const schema = z.object({
    presentCountry: optionalTextField({ label: "Country" }),
    presentDistrict: optionalTextField({ label: "District" }),
    presentStreetAddress: optionalTextField({ label: "Street address", max: 255 }),
    permanentCountry: optionalTextField({ label: "Country" }),
    permanentDistrict: optionalTextField({ label: "District" }),
    permanentStreetAddress: optionalTextField({ label: "Street address", max: 255 }),
    sameAsPresent: z.boolean(),
});

const QUERY_KEY = ["student-profile", "address"];

export default function AddressPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: studentProfileService.address });

    const save = useMutation({
        mutationFn: (values: z.output<typeof schema>) => studentProfileService.updateAddress(values),
        onSuccess: (updated) => {
            queryClient.setQueryData(QUERY_KEY, updated);
            queryClient.invalidateQueries({ queryKey: ["student-profile", "overview"] });
            toast.success("Address updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save your address.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            presentCountry: "",
            presentDistrict: "",
            presentStreetAddress: "",
            permanentCountry: "",
            permanentDistrict: "",
            permanentStreetAddress: "",
            sameAsPresent: false,
        },
        // Unused — SectionPanel drives the save itself so it can await it.
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            presentCountry: data?.presentCountry ?? "",
            presentDistrict: data?.presentDistrict ?? "",
            presentStreetAddress: data?.presentStreetAddress ?? "",
            permanentCountry: data?.permanentCountry ?? "",
            permanentDistrict: data?.permanentDistrict ?? "",
            permanentStreetAddress: data?.permanentStreetAddress ?? "",
            sameAsPresent: data?.sameAsPresent ?? false,
        });

    const sameAsPresent = Boolean(form.values.sameAsPresent);

    return (
        <SectionPanel
            title="Address"
            icon={MapPin}
            empty={data ? undefined : { title: "No address added yet", description: "Add your present and permanent address." }}
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
                <div className="space-y-6">
                    <div>
                        <p className="mb-3 text-sm font-semibold text-primary">Present Address</p>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <ViewField label="Your Country" value={data?.presentCountry} />
                            <ViewField label="District" value={data?.presentDistrict} />
                            <div className="sm:col-span-2">
                                <ViewField label="Street Address" value={data?.presentStreetAddress} />
                            </div>
                        </dl>
                    </div>
                    <div>
                        <p className="mb-3 text-sm font-semibold text-primary">Permanent Address</p>
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <ViewField label="Your Country" value={data?.permanentCountry} />
                            <ViewField label="District" value={data?.permanentDistrict} />
                            <div className="sm:col-span-2">
                                <ViewField label="Street Address" value={data?.permanentStreetAddress} />
                            </div>
                        </dl>
                    </div>
                </div>
            }
            renderEdit={
                <div className="space-y-6">
                    <div>
                        <p className="mb-3 text-sm font-semibold text-primary">Present Address</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField form={form} name="presentCountry" label="Select your Country" optional>
                                <Select placeholder="Select">
                                    {COUNTRY_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <FormField form={form} name="presentDistrict" label="Select District" optional>
                                <Select placeholder="Select">
                                    {BD_DISTRICTS.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <FormField
                                form={form}
                                name="presentStreetAddress"
                                label="Street Address"
                                optional
                                counterMax={255}
                                className="sm:col-span-2"
                            >
                                <Input placeholder="House, road, area, city" />
                            </FormField>
                        </div>
                    </div>

                    <Checkbox
                        checked={form.values.sameAsPresent}
                        onChange={(event) => form.setValue("sameAsPresent", event.target.checked)}
                    >
                        Current address and permanent address are the same
                    </Checkbox>

                    {!sameAsPresent && (
                        <div>
                            <p className="mb-3 text-sm font-semibold text-primary">Permanent Address</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField form={form} name="permanentCountry" label="Select your Country" optional>
                                    <Select placeholder="Select">
                                        {COUNTRY_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </Select>
                                </FormField>
                                <FormField form={form} name="permanentDistrict" label="Select District" optional>
                                    <Select placeholder="Select">
                                        {BD_DISTRICTS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </Select>
                                </FormField>
                                <FormField
                                    form={form}
                                    name="permanentStreetAddress"
                                    label="Street Address"
                                    optional
                                    counterMax={255}
                                    className="sm:col-span-2"
                                >
                                    <Input placeholder="House, road, area, city" />
                                </FormField>
                            </div>
                        </div>
                    )}
                </div>
            }
        />
    );
}
