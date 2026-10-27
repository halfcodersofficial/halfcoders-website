"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Briefcase, CalendarDays, FileText, MapPin } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EntryChip, EntryView, durationLabel, periodLabel } from "@/components/profile/EntryView";
import { InlineEditRow } from "@/components/profile/InlineEditRow";
import { RepeatableList } from "@/components/profile/RepeatableList";
import { DateInput } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form";
import { Checkbox, Input, RadioGroup, Select, Textarea } from "@/components/ui/input";
import { useZodForm, type ZodFormApi } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { COUNTRY_OPTIONS, HIRED_JOB_TYPE_OPTIONS } from "@/lib/profileOptions";
import { optionalTextField, optionalUrlField, textField } from "@/lib/validation";
import { studentHiredRecordService } from "@/services/studentProfile";
import type { StudentHiredRecord } from "@/types/profile.types";

const QUERY_KEY = ["student-hired-records"];

const hiredRecordSchema = z.object({
    companyName: textField({ label: "Company Name", max: 160 }),
    position: textField({ label: "Position", max: 160 }),
    jobType: z.string().trim(),
    howGotJob: optionalTextField({ label: "How did you get this job?", max: 255 }),
    description: optionalTextField({ label: "Description", max: 2000 }),
    companyCountry: z.string().trim(),
    companyCity: optionalTextField({ label: "City", max: 80 }),
    isCurrentlyWorking: z.boolean(),
    startDate: z.string().trim(),
    endDate: z.string().trim(),
    careerImpactNote: optionalTextField({ label: "Career impact", max: 2000 }),
    appointmentLetterUrl: optionalUrlField(),
});

type HiredRecordFormValues = z.infer<typeof hiredRecordSchema>;

const blankValues: HiredRecordFormValues = {
    companyName: "",
    position: "",
    jobType: "",
    howGotJob: "",
    description: "",
    companyCountry: "",
    companyCity: "",
    isCurrentlyWorking: false,
    startDate: "",
    endDate: "",
    careerImpactNote: "",
    appointmentLetterUrl: "",
};

const buildPayload = (values: HiredRecordFormValues) => ({
    companyName: values.companyName,
    position: values.position,
    jobType: values.jobType || undefined,
    howGotJob: values.howGotJob || undefined,
    description: values.description || undefined,
    companyCountry: values.companyCountry || undefined,
    companyCity: values.companyCity || undefined,
    isCurrentlyWorking: values.isCurrentlyWorking,
    startDate: values.startDate || undefined,
    endDate: values.isCurrentlyWorking ? null : values.endDate || undefined,
    careerImpactNote: values.careerImpactNote || undefined,
    appointmentLetterUrl: values.appointmentLetterUrl || undefined,
});

/** The add-form / edit-form fields shared by the "add new" card and every row. */
function HiredRecordFormFields({ form }: { form: ZodFormApi<HiredRecordFormValues> }) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField form={form} name="companyName" label="Company Name" required counterMax={160}>
                    <Input />
                </FormField>
                <FormField form={form} name="position" label="Position" required counterMax={160}>
                    <Input />
                </FormField>
            </div>

            <FormField form={form} name="jobType" label="Job Type" optional>
                <RadioGroup
                    inline
                    options={HIRED_JOB_TYPE_OPTIONS.map((option) => ({ value: option, label: option }))}
                />
            </FormField>

            <FormField
                form={form}
                name="howGotJob"
                label="How did you get this job?"
                optional
                counterMax={255}
            >
                <Input />
            </FormField>

            <FormField form={form} name="description" label="Description" optional counterMax={2000}>
                <Textarea />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField form={form} name="companyCountry" label="Company Country" optional>
                    <Select placeholder="Select">
                        {COUNTRY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </Select>
                </FormField>
                <FormField form={form} name="companyCity" label="City" optional counterMax={80}>
                    <Input />
                </FormField>
            </div>

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

            <FormField
                form={form}
                name="careerImpactNote"
                label="How did Half Coders help you build your career?"
                optional
                counterMax={2000}
            >
                <Textarea />
            </FormField>

            <FormField
                form={form}
                name="appointmentLetterUrl"
                label="Appointment Letter link"
                optional
                hint="Paste a link to your appointment letter (Google Drive, etc.)"
            >
                <Input />
            </FormField>
        </div>
    );
}

export default function GotHiredPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: studentHiredRecordService.list,
    });
    const records = data?.data ?? [];

    const create = useMutation({
        mutationFn: (values: HiredRecordFormValues) => studentHiredRecordService.create(buildPayload(values)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success("Job added.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't add this job.")),
    });

    const form = useZodForm({
        schema: hiredRecordSchema,
        initialValues: blankValues,
        // Unused — RepeatableList drives the save itself so it can await it.
        onSubmit: () => {},
    });

    return (
        <RepeatableList
            title="Got hired"
            icon={Award}
            addLabel="Add Job"
            isLoading={isLoading}
            isEmpty={records.length === 0}
            emptyIcon={Award}
            emptyTitle="No hires recorded yet"
            emptyDescription="Once you land a job, add it here to show it off."
            onStartAdd={() => form.reset(blankValues)}
            onCancelAdd={() => form.reset()}
            isSavingAdd={create.isPending}
            onSubmitAdd={async () => {
                form.submit();
                if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                return create.mutateAsync(hiredRecordSchema.parse(form.values));
            }}
            renderAddForm={<HiredRecordFormFields form={form} />}
        >
            {records.map((record) => (
                <HiredRecordRow key={record.id} record={record} />
            ))}
        </RepeatableList>
    );
}

function HiredRecordRow({ record }: { record: StudentHiredRecord }) {
    const queryClient = useQueryClient();

    const update = useMutation({
        mutationFn: (values: HiredRecordFormValues) =>
            studentHiredRecordService.update(record.id, buildPayload(values)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success("Job updated.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update this job.")),
    });

    const remove = useMutation({
        mutationFn: () => studentHiredRecordService.remove(record.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            toast.success("Job removed.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove this job.")),
    });

    const form = useZodForm({
        schema: hiredRecordSchema,
        initialValues: blankValues,
        onSubmit: () => {},
    });

    const seed = () =>
        form.reset({
            companyName: record.companyName,
            position: record.position,
            jobType: record.jobType ?? "",
            howGotJob: record.howGotJob ?? "",
            description: record.description ?? "",
            companyCountry: record.companyCountry ?? "",
            companyCity: record.companyCity ?? "",
            isCurrentlyWorking: record.isCurrentlyWorking,
            startDate: record.startDate ? record.startDate.slice(0, 10) : "",
            endDate: record.endDate ? record.endDate.slice(0, 10) : "",
            careerImpactNote: record.careerImpactNote ?? "",
            appointmentLetterUrl: record.appointmentLetterUrl ?? "",
        });

    const duration = durationLabel(record.startDate, record.endDate, record.isCurrentlyWorking);
    const location = [record.companyCity, record.companyCountry].filter(Boolean).join(", ");

    return (
        <InlineEditRow
            onEdit={seed}
            onCancel={() => form.reset()}
            onSave={async () => {
                form.submit();
                if (!form.isValid) throw new Error("Please fix the highlighted fields.");
                return update.mutateAsync(hiredRecordSchema.parse(form.values));
            }}
            onDelete={() => remove.mutateAsync()}
            deleteConfirm={{ title: "Remove this record?" }}
            isSaving={update.isPending}
            isDeleting={remove.isPending}
            renderView={
                <EntryView
                    company={record.companyName}
                    title={record.position}
                    active={record.isCurrentlyWorking}
                    chips={
                        <>
                            <EntryChip icon={CalendarDays}>
                                {periodLabel(record.startDate, record.endDate, record.isCurrentlyWorking)}
                                {duration && ` · ${duration}`}
                            </EntryChip>
                            {record.isCurrentlyWorking && <EntryChip tone="success">Currently working</EntryChip>}
                            {location && <EntryChip icon={MapPin}>{location}</EntryChip>}
                            {record.jobType && <EntryChip icon={Briefcase}>{record.jobType}</EntryChip>}
                        </>
                    }
                >
                    {record.howGotJob && (
                        <p>
                            <span className="font-medium text-foreground">How I got it: </span>
                            {record.howGotJob}
                        </p>
                    )}
                    {record.description && <p className="whitespace-pre-line">{record.description}</p>}
                    {record.careerImpactNote && (
                        <blockquote className="border-l-2 border-primary/40 pl-3 italic">{record.careerImpactNote}</blockquote>
                    )}
                    {record.appointmentLetterUrl && (
                        <a
                            href={record.appointmentLetterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                        >
                            <FileText className="size-3.5" /> View appointment letter
                        </a>
                    )}
                </EntryView>
            }
            renderEdit={<HiredRecordFormFields form={form} />}
        />
    );
}
