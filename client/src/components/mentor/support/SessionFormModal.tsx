"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarPlus, Check, Save } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { clock, dayMonthOf, dhakaDayKey, weekdayOf } from "@/components/mentor/dashboard/time";
import { Button } from "@/components/ui/button";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { SafeImage } from "@/components/ui/safe-image";
import { useSupportSlotDefault } from "@/hooks/useSupportSlotDefault";
import { useZodForm } from "@/hooks/useZodForm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { dateTimeField, numericField, optionalTextField, optionalUrlField } from "@/lib/validation";
import { supportService } from "@/services";
import type { MentorCourse, MentorSupportSession } from "@/types/mentor.types";

/** Five minutes of slack, so a session being scheduled right now still saves. */
const PAST_GRACE_MS = 5 * 60_000;
const DURATIONS = [30, 45, 60, 90, 120];
const MEET_HINT = "Paste the full meeting link, e.g. https://meet.google.com/abc-defg-hij";

const baseShape = {
    title: optionalTextField({ label: "Title", max: 160 }),
    meetingLink: optionalUrlField(MEET_HINT),
    startTime: dateTimeField,
    endTime: dateTimeField,
    slotMinutes: numericField({ label: "Minutes per student", min: 1, max: 60 }),
    notes: optionalTextField({ label: "Notes", max: 2000 }),
};
const endsAfterStart = { path: ["endTime"], message: "The session must end after it starts" };

/** Scheduling: a course to pick, and a start that hasn't passed — students are told as soon as it's saved. */
const createSchema = z
    .object({ courseId: z.string().min(1, "Choose which course this session is for"), ...baseShape })
    .refine((data) => new Date(data.startTime).getTime() > Date.now() - PAST_GRACE_MS, {
        path: ["startTime"],
        message: "Pick a start time in the future — students are told as soon as you schedule it",
    })
    .refine((data) => new Date(data.endTime) > new Date(data.startTime), endsAfterStart);

/** No past-time guard when editing — a mentor may be stretching a session already underway. */
const editSchema = z
    .object({ courseId: z.string(), ...baseShape })
    .refine((data) => new Date(data.endTime) > new Date(data.startTime), endsAfterStart);

/** Tonight at 21:00–22:00, the slot most mentors actually use. */
const defaultWindow = () => {
    const start = new Date();
    start.setHours(21, 0, 0, 0);
    if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
    return { start: toLocalDateTimeValue(start), end: toLocalDateTimeValue(new Date(start.getTime() + 60 * 60_000)) };
};

const minutesBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);

/**
 * Scheduling a support session, or editing one: the course (as rows, when the
 * mentor teaches more than one), when it runs — with one-tap lengths — the
 * Meet link, minutes per student and private notes, summed up in a line as
 * students will read it. Saving a new one, or moving one, tells the course's
 * students.
 */
export default function SessionFormModal({
    open,
    onOpenChange,
    courses,
    session,
    initialCourseId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courses: MentorCourse[];
    /** Editing this one; scheduling a new one without it. */
    session: MentorSupportSession | null;
    initialCourseId?: string;
}) {
    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            closeOnOutsideClick={false}
            title={session ? "Edit session" : "Schedule a session"}
            description={session ? "Changes apply straight away — students watching this session see them live." : "Students on the course are told as soon as it's saved."}
        >
            {open && (
                <SessionForm
                    key={session?.id ?? initialCourseId ?? "new"}
                    courses={courses}
                    session={session}
                    initialCourseId={initialCourseId}
                    onDone={() => onOpenChange(false)}
                />
            )}
        </Modal>
    );
}

function SessionForm({
    courses,
    session,
    initialCourseId,
    onDone,
}: {
    courses: MentorCourse[];
    session: MentorSupportSession | null;
    initialCourseId?: string;
    onDone: () => void;
}) {
    const queryClient = useQueryClient();
    const editing = session !== null;
    const tonight = defaultWindow();
    const initialCourse = initialCourseId && courses.some((course) => course.id === initialCourseId) ? initialCourseId : courses.length === 1 ? courses[0].id : "";

    // The pickers hold whole minutes, so an untouched time is compared as the picker shows it —
    // re-sending it would read as a move: students told again, the "live now" notice reset.
    const changed = (value: string, original: string) => value !== toLocalDateTimeValue(new Date(original));

    const save = useMutation({
        mutationFn: (values: z.output<typeof createSchema>) => {
            const fields = {
                title: values.title || undefined,
                meetingLink: values.meetingLink || undefined,
                // The inputs give local wall-clock time; the API wants an instant.
                startTime: localDateTimeToISO(values.startTime),
                endTime: localDateTimeToISO(values.endTime),
                slotMinutes: Number(values.slotMinutes),
                notes: values.notes || undefined,
            };
            if (!editing) return supportService.createSession({ courseId: values.courseId, ...fields });
            return supportService.updateSession(session.id, {
                ...fields,
                // Emptied, these clear what was there rather than keeping it.
                title: values.title,
                meetingLink: values.meetingLink || null,
                notes: values.notes,
                startTime: changed(values.startTime, session.startTime) ? fields.startTime : undefined,
                endTime: changed(values.endTime, session.endTime) ? fields.endTime : undefined,
            });
        },
        onSuccess: () => {
            const moved = editing && changed(form.values.startTime, session.startTime);
            toast.success(
                editing
                    ? moved
                        ? "Session moved — students are told the new time."
                        : "Session updated."
                    : "Session scheduled — your students have been told.",
            );
            void queryClient.invalidateQueries({ queryKey: ["dashboard", "mentor"] });
            void queryClient.invalidateQueries({ queryKey: ["support"] });
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, editing ? "Couldn't update that session." : "Couldn't schedule that session.")),
    });

    const form = useZodForm({
        schema: (editing ? editSchema : createSchema) as typeof createSchema,
        initialValues: {
            courseId: session?.course.id ?? initialCourse,
            title: session ? (session.title ?? "") : "Support Session",
            meetingLink: session?.meetingLink ?? "",
            startTime: session ? toLocalDateTimeValue(new Date(session.startTime)) : tonight.start,
            endTime: session ? toLocalDateTimeValue(new Date(session.endTime)) : tonight.end,
            slotMinutes: String(session?.slotMinutes ?? 5),
            notes: session?.notes ?? "",
        },
        onSubmit: (values) => save.mutate(values),
    });
    const { setValue } = form;
    // A new session starts from the platform's default minutes per student.
    useSupportSlotDefault(editing ? "" : form.values.slotMinutes, (value) => {
        if (!editing) setValue("slotMinutes", value);
    });

    const { startTime, endTime, slotMinutes, courseId } = form.values;
    const length = minutesBetween(startTime, endTime);
    const setLength = (minutes: number) => setValue("endTime", toLocalDateTimeValue(new Date(new Date(startTime).getTime() + minutes * 60_000)));

    // Moving the start carries the end along, keeping the length — as a calendar does.
    const previousStart = useRef(startTime);
    useEffect(() => {
        const before = previousStart.current;
        previousStart.current = startTime;
        if (!before || !startTime || before === startTime) return;
        const kept = minutesBetween(before, endTime);
        if (kept > 0) setValue("endTime", toLocalDateTimeValue(new Date(new Date(startTime).getTime() + kept * 60_000)));
        // Only when the start itself changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startTime]);

    const valid = Number.isFinite(length) && length > 0 && Number(slotMinutes) > 0;
    const start = new Date(startTime);

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-5">
                <RequiredLegend />

                {!editing && courses.length > 1 && (
                    <fieldset>
                        <legend className="text-sm font-medium">
                            Course <span className="text-destructive">*</span>
                        </legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {courses.map((course) => {
                                const selected = course.id === courseId;
                                return (
                                    <label
                                        key={course.id}
                                        className={cn(
                                            "flex cursor-pointer items-center gap-3 rounded-card border p-2.5 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                                            selected ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40",
                                        )}
                                    >
                                        <input type="radio" name="course" checked={selected} onChange={() => setValue("courseId", course.id)} className="sr-only" />
                                        <span className="relative grid aspect-video w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary">
                                            <SafeImage src={course.thumbnail} alt="" fill sizes="56px" className="object-cover" fallback={<BookOpen className="size-4 text-muted-foreground" />} />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{course.title}</span>
                                        {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                                    </label>
                                );
                            })}
                        </div>
                        {form.errorFor("courseId") && <p className="mt-1.5 text-xs text-destructive">{form.errorFor("courseId")}</p>}
                    </fieldset>
                )}
                {editing && (
                    <p className="rounded-md bg-secondary/50 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Course:</span> <span className="font-medium">{session.course.title}</span>
                    </p>
                )}

                <FormField form={form} name="title" label="Session title" optional counterMax={160}>
                    <Input placeholder="Support Session" />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField form={form} name="startTime" label="Starts" required>
                        <DateTimeInput min={editing ? undefined : toLocalDateTimeValue(new Date())} />
                    </FormField>
                    <FormField form={form} name="endTime" label="Ends" required>
                        <DateTimeInput min={startTime} />
                    </FormField>
                </div>
                <div className="-mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted-foreground">Length</span>
                    {DURATIONS.map((minutes) => (
                        <button
                            key={minutes}
                            type="button"
                            onClick={() => setLength(minutes)}
                            className={cn(
                                "rounded-sm border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                                length === minutes ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )}
                        >
                            {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                        </button>
                    ))}
                </div>

                <FormField
                    form={form}
                    name="meetingLink"
                    label="Google Meet link"
                    optional
                    // Worth being explicit — mentors reasonably worry about their room being open early.
                    hint="Students only see this once the session goes live — they can't join without one."
                >
                    <Input type="url" inputMode="url" spellCheck={false} placeholder="https://meet.google.com/abc-defg-hij" />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                    <FormField form={form} name="slotMinutes" label="Minutes per student" required hint="For the wait students see.">
                        <Input type="number" inputMode="numeric" min={1} max={60} />
                    </FormField>
                    <FormField form={form} name="notes" label="Notes" optional counterMax={2000} hint="For you and co-mentors — students never see this.">
                        <Textarea rows={2} />
                    </FormField>
                </div>

                {/* The whole thing in a line, the way students will read it. */}
                {valid && !Number.isNaN(start.getTime()) && (
                    <p className="rounded-card border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                        <span className="font-semibold">
                            {weekdayOf(dhakaDayKey(start), true)} {dayMonthOf(dhakaDayKey(start))}, {clock(start)} – {clock(endTime)}
                        </span>
                        <span className="text-muted-foreground">
                            {" "}
                            · {length < 60 ? `${length} min` : `${Math.floor(length / 60)} h${length % 60 ? ` ${length % 60} min` : ""}`} · room for about{" "}
                            <span className="font-medium text-foreground">{Math.max(1, Math.floor(length / Number(slotMinutes)))}</span> students at {slotMinutes} min each
                        </span>
                    </p>
                )}
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    {!save.isPending && (editing ? <Save /> : <CalendarPlus />)} {editing ? "Save changes" : "Schedule session"}
                </Button>
            </ModalFooter>
        </form>
    );
}
