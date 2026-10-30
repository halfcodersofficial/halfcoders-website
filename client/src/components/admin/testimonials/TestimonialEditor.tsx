"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import EntityPicker from "@/components/admin/EntityPicker";
import { searchCourses, searchStudents, type PickerOption } from "@/components/admin/pickers";
import StarInput from "@/components/admin/testimonials/StarInput";
import TestimonialQuoteCard from "@/components/shared/TestimonialQuoteCard";
import TestimonialVideoCard from "@/components/shared/TestimonialVideoCard";
import { Button } from "@/components/ui/button";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { extractYoutubeId, optionalTextField, optionalYoutubeUrlField, textField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import type { AdminTestimonial, TestimonialInput } from "@/types/admin.types";

const schema = z.object({
    name: textField({ label: "Name", min: 2, max: 80 }),
    designation: optionalTextField({ label: "Designation", max: 120 }),
    quote: textField({ label: "Quote", min: 10, max: 1000 }),
    rating: z.number().int().min(1, "Choose a rating").max(5),
    videoUrl: optionalYoutubeUrlField,
    isPublished: z.boolean(),
});

const STATUS_HINT = { PUBLISHED: "Published", DRAFT: "Draft", ARCHIVED: "Archived" } as const;

export interface SavedTestimonial {
    id: string;
    created: boolean;
}

/**
 * Adds or edits one testimonial, beside a live preview of it as the homepage
 * and its course page will show it — the same cards those pages render.
 * Content unmounts on close, so every open starts from the testimonial (or
 * blank) rather than from the last edit.
 */
export default function TestimonialEditor({
    open,
    onOpenChange,
    testimonial,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** `null` adds a new one. */
    testimonial: AdminTestimonial | null;
    onSaved: (saved: SavedTestimonial) => void;
}) {
    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={testimonial ? "Edit testimonial" : "New testimonial"}
            description="What a student said — shown on the homepage, and on its course's page."
            size="xl"
            closeOnOutsideClick={false}
        >
            <EditorForm testimonial={testimonial} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
        </Modal>
    );
}

function EditorForm({
    testimonial,
    onCancel,
    onSaved,
}: {
    testimonial: AdminTestimonial | null;
    onCancel: () => void;
    onSaved: (saved: SavedTestimonial) => void;
}) {
    const [student, setStudent] = useState<PickerOption | null>(
        testimonial?.student
            ? { id: testimonial.student.id, label: testimonial.student.name, hint: testimonial.student.email, image: testimonial.student.image }
            : null,
    );
    const [course, setCourse] = useState<PickerOption | null>(
        testimonial?.course
            ? { id: testimonial.course.id, label: testimonial.course.title, hint: STATUS_HINT[testimonial.course.status] }
            : null,
    );

    const save = useMutation({
        mutationFn: async (values: z.output<typeof schema>) => {
            const payload: TestimonialInput = {
                name: values.name,
                designation: values.designation || null,
                quote: values.quote,
                rating: values.rating,
                videoUrl: values.videoUrl || null,
                courseId: course?.id ?? null,
                studentId: student?.id ?? null,
                isPublished: values.isPublished,
            };
            if (testimonial) {
                await adminService.updateTestimonial(testimonial.id, payload);
                return testimonial.id;
            }
            return (await adminService.createTestimonial(payload)).id;
        },
        onSuccess: (id) => onSaved({ id, created: !testimonial }),
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save that testimonial.")),
    });

    const form = useZodForm({
        schema,
        initialValues: {
            name: testimonial?.name ?? "",
            designation: testimonial?.designation ?? "",
            quote: testimonial?.quote ?? "",
            rating: testimonial?.rating ?? 5,
            videoUrl: testimonial?.videoUrl ?? "",
            isPublished: testimonial?.isPublished ?? true,
        },
        onSubmit: (values) => save.mutate(values),
    });
    const { values } = form;

    // Linking a student fills in their name — unless one was typed that isn't theirs.
    const pickStudent = (option: PickerOption | null) => {
        if (option && (!values.name.trim() || values.name === student?.label)) form.setValue("name", option.label);
        setStudent(option);
    };

    const videoId = extractYoutubeId(values.videoUrl);
    const shownName = values.name.trim() || "Student name";
    const shownQuote = values.quote.trim() || "Their words show here as you type them.";
    const designation = values.designation.trim() || null;

    return (
        <form
            className={modalFormClass}
            noValidate
            onSubmit={form.handleSubmit}
            // Enter in a picker's search box looks something up; it shouldn't save the form.
            onKeyDown={(event) => {
                if (event.key === "Enter" && (event.target as HTMLElement).matches('input[type="search"]')) {
                    event.preventDefault();
                }
            }}
        >
            <ModalBody>
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 @3xl:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="space-y-5">
                        <RequiredLegend />

                        <EntityPicker
                            label="Student account"
                            placeholder="Search students by name or email…"
                            value={student}
                            onChange={pickStudent}
                            search={searchStudents}
                            queryKey="students"
                            avatar
                            emptyText="No student matches."
                            hint="Optional. Uses their photo, and lists this on their student page in the console."
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField form={form} name="name" label="Name" required counterMax={80}>
                                <Input autoComplete="off" />
                            </FormField>
                            <FormField form={form} name="designation" label="Designation" optional counterMax={120}>
                                <Input placeholder="Junior Developer at …" />
                            </FormField>
                        </div>

                        <FormField form={form} name="quote" label="Quote" required counterMax={1000}>
                            <Textarea rows={4} placeholder="In their own words — a few sentences on what changed for them." />
                        </FormField>

                        <FormField form={form} name="rating" label="Rating" required>
                            <StarInput />
                        </FormField>

                        <EntityPicker
                            label="Course"
                            placeholder="Search courses…"
                            value={course}
                            onChange={setCourse}
                            search={searchCourses}
                            queryKey="all-courses"
                            emptyText="No course matches."
                            hint="Optional. Also shows it on that course's page — up to six there, in this list's order."
                        />

                        <div className="space-y-2">
                            <FormField
                                form={form}
                                name="videoUrl"
                                label="Video"
                                optional
                                hint="A YouTube link. On the course page the video plays in place of the quote."
                            >
                                <Input type="url" inputMode="url" spellCheck={false} placeholder="https://youtu.be/…" />
                            </FormField>
                            {videoId && !course && (
                                <p className="flex items-start gap-2 rounded-md bg-accent/10 p-2.5 text-xs text-foreground">
                                    <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                                    Only a course page plays the video — pick a course above, or the homepage shows the quote alone.
                                </p>
                            )}
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-card border border-border p-4">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Live on the site</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {values.isPublished
                                        ? `On the homepage${course ? ` and ${course.label}'s page` : ""}, in the list's order.`
                                        : "A draft — saved, but shown nowhere until it's live."}
                                </p>
                            </div>
                            <Switch
                                checked={values.isPublished}
                                onCheckedChange={(next) => form.setValue("isPublished", next)}
                                aria-label="Live on the site"
                            />
                        </div>
                    </div>

                    <aside className="space-y-5 @3xl:sticky @3xl:top-0 @3xl:self-start" aria-label="Preview">
                        <PreviewBlock label="On the homepage" muted={!values.isPublished}>
                            <TestimonialQuoteCard
                                variant="home"
                                name={shownName}
                                designation={designation}
                                avatar={student?.image ?? null}
                                quote={shownQuote}
                                rating={values.rating || 5}
                                courseTitle={course?.label}
                            />
                        </PreviewBlock>

                        {course && (
                            <PreviewBlock label={`On ${course.label}`} muted={!values.isPublished}>
                                {videoId ? (
                                    <TestimonialVideoCard videoUrl={values.videoUrl} name={shownName} designation={designation} />
                                ) : (
                                    <TestimonialQuoteCard
                                        variant="course"
                                        name={shownName}
                                        designation={designation}
                                        avatar={student?.image ?? null}
                                        quote={shownQuote}
                                        rating={values.rating || 5}
                                    />
                                )}
                            </PreviewBlock>
                        )}

                        {!values.isPublished && (
                            <p className="text-xs text-muted-foreground">A draft isn&apos;t shown anywhere — this is how it will look once live.</p>
                        )}
                    </aside>
                </div>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    {testimonial ? "Save changes" : "Add testimonial"}
                </Button>
            </ModalFooter>
        </form>
    );
}

function PreviewBlock({ label, muted, children }: { label: string; muted: boolean; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="truncate text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className={cn("transition-opacity", muted && "opacity-60")}>{children}</div>
        </div>
    );
}
