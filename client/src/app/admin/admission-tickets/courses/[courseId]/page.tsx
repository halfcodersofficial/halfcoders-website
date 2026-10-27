"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { CourseSummaryHeader, since, type StatCell } from "@/components/admin/CourseSummary";
import { PromoActions, PromoSection } from "@/components/admin/promotions/PromotionParts";
import {
    AdmissionTicketActions,
    AdmissionTicketPicture,
    admissionTicketHost,
    useAdmissionTicketPicture,
} from "@/components/shared/AdmissionTicket";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SwitchRow } from "@/components/ui/switch";
import { useSession } from "@/hooks/useSession";
import { useZodForm } from "@/hooks/useZodForm";
import { ADMISSION_TICKET_STARTER } from "@/lib/admissionTicket";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { optionalTextField, textField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { AdmissionTicketCourseDetail } from "@/types/admin.types";
import type { AdmissionTicketWords } from "@/types/domain.types";

const MAX_FIELDS = 3;

/** The limits match the API's — what the picture has room for. */
const schema = z.object({
    headline: textField({ label: "Headline", max: 32 }),
    subheadline: optionalTextField({ label: "The line under it", max: 70 }),
    ticketTitle: optionalTextField({ label: "Ticket title", max: 32 }),
    badge: optionalTextField({ label: "Chip", max: 24 }),
    learnerLabel: optionalTextField({ label: "Label", max: 20 }),
    courseLabel: optionalTextField({ label: "Label", max: 20 }),
    courseName: optionalTextField({ label: "Course name", max: 90 }),
    fields: z
        .array(
            z.object({
                label: z.string().trim().min(1, "Give it a label").max(20, "Up to 20 characters"),
                value: z.string().trim().min(1, "Write what it says").max(60, "Up to 60 characters"),
            }),
        )
        .max(MAX_FIELDS),
    stubLabel: optionalTextField({ label: "Stub label", max: 12 }),
    stubValue: optionalTextField({ label: "Stub value", max: 8 }),
    showPhoto: z.boolean(),
    taglineLead: optionalTextField({ label: "First line", max: 40 }),
    taglineAccent: optionalTextField({ label: "Second line", max: 40 }),
    footerText: optionalTextField({ label: "Foot text", max: 32 }),
    isActive: z.boolean(),
});

type Values = z.input<typeof schema>;

const valuesFrom = (words: AdmissionTicketWords, isActive: boolean): Values => ({
    headline: words.headline,
    subheadline: words.subheadline ?? "",
    ticketTitle: words.ticketTitle ?? "",
    badge: words.badge ?? "",
    learnerLabel: words.learnerLabel ?? "",
    courseLabel: words.courseLabel ?? "",
    courseName: words.courseName ?? "",
    fields: words.fields,
    stubLabel: words.stubLabel ?? "",
    stubValue: words.stubValue ?? "",
    showPhoto: words.showPhoto,
    taglineLead: words.taglineLead ?? "",
    taglineAccent: words.taglineAccent ?? "",
    footerText: words.footerText ?? "",
    isActive,
});

const blankToNull = (value: string) => value.trim() || null;

const wordsFrom = (values: Values): AdmissionTicketWords => ({
    headline: values.headline.trim(),
    subheadline: blankToNull(values.subheadline),
    ticketTitle: blankToNull(values.ticketTitle),
    badge: blankToNull(values.badge),
    learnerLabel: blankToNull(values.learnerLabel),
    courseLabel: blankToNull(values.courseLabel),
    courseName: blankToNull(values.courseName),
    fields: values.fields.map((field) => ({ label: field.label.trim(), value: field.value.trim() })),
    stubLabel: blankToNull(values.stubLabel),
    stubValue: blankToNull(values.stubValue),
    showPhoto: values.showPhoto,
    taglineLead: blankToNull(values.taglineLead),
    taglineAccent: blankToNull(values.taglineAccent),
    footerText: blankToNull(values.footerText),
});

/** One course's admission ticket: what it says where, beside the picture as it'll look. */
export default function AdminAdmissionTicketCoursePage() {
    const { courseId } = useParams<{ courseId: string }>();
    const { data, isLoading, isError } = useQuery({
        queryKey: ["admin", "admission-ticket-course", courseId],
        queryFn: () => adminService.admissionTicketCourse(courseId),
    });

    if (isError) {
        return (
            <div className="space-y-5">
                <BackButton href="/admin/admission-tickets" label="All courses" />
                <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
                    <p className="font-medium">This course couldn&apos;t be found.</p>
                    <p className="mt-1 text-sm text-muted-foreground">It may have been removed. Go back to pick another course.</p>
                </div>
            </div>
        );
    }
    if (isLoading || !data) {
        return (
            <div className="space-y-5">
                <BackButton href="/admin/admission-tickets" label="All courses" />
                <Skeleton className="h-72 rounded-2xl" />
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <Skeleton className="h-112 rounded-2xl" />
                    <Skeleton className="aspect-[4/5] rounded-2xl" />
                </div>
            </div>
        );
    }

    const { course, ticket, students } = data;
    const cells: StatCell[] = [
        { label: "Status", value: ticket ? (ticket.isActive ? "On" : "Off") : "—", hint: ticket ? "Students see it when on" : "Not written yet" },
        { label: "Students", value: String(students), hint: ticket?.isActive ? "Can open theirs now" : "On the course now" },
        { label: "Foot fields", value: String(ticket?.fields.length ?? 0), hint: `Up to ${MAX_FIELDS}` },
        { label: "Last saved", value: ticket ? since("", ticket.updatedAt, "—").trim() : "—", hint: ticket ? "By an admin" : "Never" },
    ];

    return (
        <div className="space-y-6">
            <BackButton href="/admin/admission-tickets" label="All courses" />
            <CourseSummaryHeader
                course={course}
                details={
                    ticket ? (
                        <Badge variant={ticket.isActive ? "success" : "secondary"}>{ticket.isActive ? "Given out" : "Switched off"}</Badge>
                    ) : (
                        <Badge variant="secondary">No ticket yet</Badge>
                    )
                }
                stats={cells}
                bar={
                    <p className="text-sm text-muted-foreground">
                        Students get this picture on the paid receipt and can open it again from their dashboard, with their own name and photo
                        on it. Write it in English; it&apos;s drawn as a 1080 × 1350 post.
                    </p>
                }
            />
            {/* Keyed on the saved version, so a save or a removal starts the form from what's stored. */}
            <TicketEditor key={ticket?.updatedAt ?? "new"} detail={data} />
        </div>
    );
}

function TicketEditor({ detail }: { detail: AdmissionTicketCourseDetail }) {
    const queryClient = useQueryClient();
    const { user } = useSession();
    const { course, ticket } = detail;

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "admission-ticket-course", course.id] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "admission-ticket-courses"] });
    };

    const save = useMutation({
        mutationFn: (values: Values) => adminService.saveAdmissionTicket(course.id, { ...wordsFrom(values), isActive: values.isActive }),
        onSuccess: () => {
            toast.success(ticket ? "Ticket saved." : "Ticket set up.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save the ticket.")),
    });
    const remove = useMutation({
        mutationFn: () => adminService.deleteAdmissionTicket(course.id),
        onSuccess: () => {
            toast.success("Ticket removed.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove the ticket.")),
    });

    const form = useZodForm({
        schema,
        initialValues: valuesFrom(ticket ?? ADMISSION_TICKET_STARTER, ticket?.isActive ?? true),
        onSubmit: (values) => save.mutate(values),
    });
    const { values } = form;

    const drawing = values.headline.trim()
        ? {
              ...wordsFrom(values),
              learnerName: user?.name ?? "Student name",
              learnerImage: user?.image ?? null,
              courseTitle: course.title,
              siteHost: admissionTicketHost(),
          }
        : null;
    const { file, url } = useAdmissionTicketPicture(drawing, course.slug, 250);

    const setField = (index: number, patch: Partial<{ label: string; value: string }>) =>
        form.setValue(
            "fields",
            values.fields.map((field, at) => (at === index ? { ...field, ...patch } : field)),
        );

    return (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <aside className="space-y-3 xl:sticky xl:top-24 xl:col-start-2 xl:row-start-1">
                <AdmissionTicketPicture url={url} alt={`Preview of the admission ticket for ${course.title}`} className="mx-auto w-full max-w-sm" />
                <p className="text-center text-xs text-muted-foreground">Shown with your name and photo. Each student sees their own.</p>
                <AdmissionTicketActions file={file} shareText={course.title} className="justify-center" />
            </aside>

            <section className="@container min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:col-start-1 xl:row-start-1">
                <form noValidate onSubmit={form.handleSubmit} className="divide-y divide-border">
                    <PromoSection title="Above the ticket" description="The big word at the top, and one line under it.">
                        <FormField form={form} name="headline" label="Headline" required counterMax={32}>
                            <Input placeholder="CONGRATULATIONS" />
                        </FormField>
                        <FormField form={form} name="subheadline" label="The line under it" optional counterMax={70}>
                            <Input placeholder="YOUR SEAT IS CONFIRMED" />
                        </FormField>
                    </PromoSection>

                    <PromoSection title="Ticket header" description="The ticket's own top line, and the chip at its right.">
                        <div className="grid gap-4 @lg:grid-cols-2">
                            <FormField form={form} name="ticketTitle" label="Ticket title" optional counterMax={32}>
                                <Input placeholder="YOUR NEXT JOURNEY" />
                            </FormField>
                            <FormField form={form} name="badge" label="Chip" optional counterMax={24}>
                                <Input placeholder="Access confirmed" />
                            </FormField>
                        </div>
                    </PromoSection>

                    <PromoSection
                        title="Student and course"
                        description="The student's name and photo come from their profile. Leave a label empty to leave it off."
                    >
                        <div className="grid gap-4 @lg:grid-cols-2">
                            <FormField form={form} name="learnerLabel" label="Over the name" optional counterMax={20}>
                                <Input placeholder="Learner" />
                            </FormField>
                            <FormField form={form} name="courseLabel" label="Over the course" optional counterMax={20}>
                                <Input placeholder="Course" />
                            </FormField>
                        </div>
                        <FormField
                            form={form}
                            name="courseName"
                            label="Course name on the ticket"
                            optional
                            counterMax={90}
                            hint="Empty uses the course's title."
                        >
                            <Input placeholder={course.title} />
                        </FormField>
                        <SwitchRow
                            checked={values.showPhoto}
                            onCheckedChange={(next) => form.setValue("showPhoto", next)}
                            label="Show the student's photo"
                            description={
                                values.showPhoto
                                    ? "Their profile photo, or their initials when they have none."
                                    : "No photo: the name and course take the whole width."
                            }
                        />
                    </PromoSection>

                    <PromoSection
                        title="Along the foot"
                        description={`Up to ${MAX_FIELDS} short facts side by side, like where they start and where they're headed.`}
                    >
                        {values.fields.length > 0 && (
                            <ul className="space-y-3">
                                {values.fields.map((field, index) => {
                                    const labelError = form.errorFor(`fields.${index}.label`);
                                    const valueError = form.errorFor(`fields.${index}.value`);
                                    return (
                                        <li key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 @lg:grid-cols-[11rem_minmax(0,1fr)_auto]">
                                            <div className="min-w-0">
                                                <Input
                                                    value={field.label}
                                                    onChange={(event) => setField(index, { label: event.target.value })}
                                                    placeholder="START HERE"
                                                    maxLength={20}
                                                    aria-label={`Field ${index + 1} label`}
                                                    aria-invalid={Boolean(labelError)}
                                                />
                                                {labelError && <p className="mt-1 text-xs text-destructive">{labelError}</p>}
                                            </div>
                                            <div className="min-w-0 max-@lg:order-3 max-@lg:col-span-2">
                                                <Input
                                                    value={field.value}
                                                    onChange={(event) => setField(index, { value: event.target.value })}
                                                    placeholder="Fundamentals of software engineering"
                                                    maxLength={60}
                                                    aria-label={`Field ${index + 1} text`}
                                                    aria-invalid={Boolean(valueError)}
                                                />
                                                {valueError && <p className="mt-1 text-xs text-destructive">{valueError}</p>}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Remove field ${index + 1}`}
                                                onClick={() => form.setValue("fields", values.fields.filter((_, at) => at !== index))}
                                            >
                                                <X />
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {values.fields.length < MAX_FIELDS && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => form.setValue("fields", [...values.fields, { label: "", value: "" }])}
                            >
                                <Plus /> Add a field
                            </Button>
                        )}
                    </PromoSection>

                    <PromoSection title="Stub" description="The green tear-off: a small label over one big value, like BATCH and 03.">
                        <div className="grid gap-4 @lg:grid-cols-2">
                            <FormField form={form} name="stubLabel" label="Label" optional counterMax={12}>
                                <Input placeholder="BATCH" />
                            </FormField>
                            <FormField form={form} name="stubValue" label="Value" optional counterMax={8}>
                                <Input placeholder="03" />
                            </FormField>
                        </div>
                    </PromoSection>

                    <PromoSection title="Under the ticket" description="Two lines, the second in green, then the text in the pill beside the site's address.">
                        <div className="grid gap-4 @lg:grid-cols-2">
                            <FormField form={form} name="taglineLead" label="First line" optional counterMax={40}>
                                <Input placeholder="You earned your place." />
                            </FormField>
                            <FormField form={form} name="taglineAccent" label="Second line" optional counterMax={40}>
                                <Input placeholder="Now build what's next." />
                            </FormField>
                        </div>
                        <FormField form={form} name="footerText" label="Pill text" optional counterMax={32}>
                            <Input placeholder="Begin your next chapter" />
                        </FormField>
                    </PromoSection>

                    <PromoSection title="Status">
                        <SwitchRow
                            checked={values.isActive}
                            onCheckedChange={(next) => form.setValue("isActive", next)}
                            label="Give this ticket to students"
                            description={
                                values.isActive
                                    ? "On: every student on this course can open, download and share theirs."
                                    : "Off: nobody sees a ticket for this course, and the dashboard button is hidden."
                            }
                        />
                    </PromoSection>

                    <PromoActions>
                        {ticket ? (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                isLoading={remove.isPending}
                                onClick={async () => {
                                    if (
                                        await confirmAction({
                                            title: "Remove this ticket?",
                                            text: "Students on this course won't see a ticket any more. Pictures they already saved stay theirs.",
                                            confirmText: "Remove",
                                        })
                                    ) {
                                        remove.mutate();
                                    }
                                }}
                            >
                                <Trash2 /> Remove ticket
                            </Button>
                        ) : (
                            <span />
                        )}
                        <Button type="submit" isLoading={save.isPending}>
                            <Save /> {ticket ? "Save ticket" : "Set up ticket"}
                        </Button>
                    </PromoActions>
                </form>
            </section>
        </div>
    );
}
