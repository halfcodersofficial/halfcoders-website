"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarClock, CalendarPlus, Copy, Link2Off, Pencil, Radio, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import RowActions from "@/components/admin/RowActions";
import { clock, dayMonthOf, dhakaDayKey, weekdayOf } from "@/components/mentor/dashboard/time";
import { Button } from "@/components/ui/button";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField } from "@/components/ui/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { useZodForm } from "@/hooks/useZodForm";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { dateTimeField, optionalTextField, optionalUrlField, textField } from "@/lib/validation";
import { liveClassService, type LiveClassInput } from "@/services/conceptual";
import type { StaffLiveClass } from "@/types/conceptual.types";

const LENGTHS = [45, 60, 90, 120];
const PAST_GRACE_MS = 5 * 60_000;
const LINK_HINT = "Paste the full meeting link, e.g. https://zoom.us/j/… or https://meet.google.com/…";

const schema = z.object({
    title: textField({ label: "Title", min: 3, max: 160 }),
    startsAt: dateTimeField,
    durationMinutes: z.number().int().min(15).max(360),
    joinUrl: optionalUrlField(LINK_HINT),
    topicId: z.string(),
    description: optionalTextField({ label: "Note", max: 2000 }),
});
type Values = z.infer<typeof schema>;

const endOf = (liveClass: StaffLiveClass) => new Date(liveClass.startsAt).getTime() + liveClass.durationMinutes * 60_000;
const when = (iso: string) => `${weekdayOf(dhakaDayKey(iso))} ${dayMonthOf(dhakaDayKey(iso))}, ${clock(iso)}`;

/** Tonight at 21:00 (or tomorrow's, once that's passed) — when most classes run. */
const tonight = () => {
    const start = new Date();
    start.setHours(21, 0, 0, 0);
    if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
    return toLocalDateTimeValue(start);
};

type Dialog = { mode: "create" } | { mode: "edit"; liveClass: StaffLiveClass };

/**
 * The course's live classes, above its recordings: schedule one (students
 * are told, and emailed), move it (told again), cancel it (told), or fix
 * its link quietly. Students get the link shortly before the start and a
 * nudge fifteen minutes ahead; afterwards its recording goes in a topic below.
 */
export default function LiveClassesPanel({ courseId, topics }: { courseId: string; topics: { id: string; title: string }[] }) {
    const queryClient = useQueryClient();
    const now = useNow(30_000);
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const key = ["staff", "live-classes", courseId];
    const list = useQuery({ queryKey: key, queryFn: () => liveClassService.forCourse(courseId) });
    const refresh = () => void queryClient.invalidateQueries({ queryKey: key });

    const cancel = useMutation({
        mutationFn: (id: string) => liveClassService.cancel(id),
        onSuccess: () => {
            toast.success("Cancelled — the course has been told.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't cancel it.")),
    });
    const remove = useMutation({
        mutationFn: (id: string) => liveClassService.remove(id),
        onSuccess: () => refresh(),
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove it.")),
    });

    const askCancel = async (liveClass: StaffLiveClass) => {
        const ok = await confirmAction({
            title: `Cancel “${liveClass.title}”?`,
            text: "Everyone on the course is told it's off (and emailed, if they take emails). It stays on the list, marked cancelled.",
            confirmText: "Cancel the class",
        });
        if (ok) cancel.mutate(liveClass.id);
    };

    const classes = list.data ?? [];
    const upcoming = classes.filter((entry) => endOf(entry) >= now);
    const past = classes.filter((entry) => endOf(entry) < now).reverse();

    return (
        <section aria-labelledby="live-title" className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6 bg-surface">
                <div className="min-w-0">
                    <h2 id="live-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                        <CalendarClock className="size-5 text-primary" aria-hidden /> Live classes
                    </h2>
                    <p className="text-xs text-muted-foreground">Students see each one on the course, with its link from 30 minutes before · Dhaka time</p>
                </div>
                <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
                    <CalendarPlus /> Schedule a class
                </Button>
            </header>

            {list.isLoading ? (
                <div className="space-y-2 p-4">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                </div>
            ) : list.isError ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">{getApiErrorMessage(list.error, "Couldn't load the live classes.")}</p>
            ) : upcoming.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Nothing scheduled.{" "}
                    <button type="button" onClick={() => setDialog({ mode: "create" })} className="font-medium text-primary hover:underline">
                        Schedule the next class
                    </button>
                </p>
            ) : (
                <ul className="divide-y divide-border">
                    {upcoming.map((liveClass) => {
                        const cancelled = liveClass.status === "CANCELLED";
                        const live = !cancelled && new Date(liveClass.startsAt).getTime() <= now;
                        return (
                            <li
                                key={liveClass.id}
                                className={cn(
                                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6",
                                    live && "bg-success/5",
                                    cancelled && "opacity-60",
                                )}
                            >
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2">
                                        <span className={cn("truncate font-medium", cancelled && "line-through")}>{liveClass.title}</span>
                                        {live && (
                                            <span className="inline-flex items-center gap-1.5 rounded-sm bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                                                <Radio className="size-3" aria-hidden /> On now
                                            </span>
                                        )}
                                        {cancelled && <span className="rounded-sm bg-secondary px-2 py-0.5 text-xs font-medium">Cancelled</span>}
                                    </p>
                                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                        <span className="tabular-nums">{when(liveClass.startsAt)}</span>
                                        <span aria-hidden>·</span>
                                        <span>{liveClass.durationMinutes} min</span>
                                        {liveClass.topic && (
                                            <>
                                                <span aria-hidden>·</span>
                                                <span className="truncate">{liveClass.topic.title}</span>
                                            </>
                                        )}
                                        {!cancelled && (
                                            <>
                                                <span aria-hidden>·</span>
                                                {liveClass.joinUrl ? (
                                                    <span className="inline-flex items-center gap-1 text-foreground/80">
                                                        <Video className="size-3.5" aria-hidden /> Link set
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDialog({ mode: "edit", liveClass })}
                                                        className="inline-flex items-center gap-1 font-medium text-amber-700 hover:underline dark:text-amber-400"
                                                    >
                                                        <Link2Off className="size-3.5" aria-hidden /> No link yet — add one
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </p>
                                </div>
                                <RowActions
                                    label={`More for ${liveClass.title}`}
                                    items={[
                                        { label: "Edit or move", icon: Pencil, hidden: cancelled, onSelect: () => setDialog({ mode: "edit", liveClass }) },
                                        {
                                            label: "Copy the link",
                                            icon: Copy,
                                            hidden: !liveClass.joinUrl || cancelled,
                                            onSelect: () =>
                                                void navigator.clipboard?.writeText(liveClass.joinUrl ?? "").then(
                                                    () => toast.success("Link copied."),
                                                    () => toast.error("Couldn't copy it."),
                                                ),
                                        },
                                        { label: "Cancel the class", icon: Ban, destructive: true, separatorBefore: true, hidden: cancelled, onSelect: () => void askCancel(liveClass) },
                                        { label: "Remove from the list", icon: Trash2, destructive: true, hidden: !cancelled, onSelect: () => remove.mutate(liveClass.id) },
                                    ]}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            {past.length > 0 && (
                <details className="group border-t border-border">
                    <summary className="cursor-pointer list-none px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:px-6">
                        <span className="group-open:hidden">Show the last two weeks ({past.length})</span>
                        <span className="hidden group-open:inline">Hide the last two weeks</span>
                    </summary>
                    <ul className="divide-y divide-border border-t border-border">
                        {past.map((liveClass) => (
                            <li key={liveClass.id} className="flex items-center gap-3 px-5 py-2.5 text-sm text-muted-foreground sm:px-6">
                                <span className="min-w-0 flex-1 truncate">
                                    <span className={cn("text-foreground/80", liveClass.status === "CANCELLED" && "line-through")}>{liveClass.title}</span> ·{" "}
                                    {when(liveClass.startsAt)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => remove.mutate(liveClass.id)}
                                    aria-label={`Remove ${liveClass.title} from the list`}
                                    className="grid size-7 place-items-center rounded-md transition-colors hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            <Modal
                open={dialog !== null}
                onOpenChange={(open) => !open && setDialog(null)}
                size="lg"
                closeOnOutsideClick={false}
                title={dialog?.mode === "edit" ? "Edit the live class" : "Schedule a live class"}
                description={
                    dialog?.mode === "edit"
                        ? "Moving it tells the course again; a new link or title goes quietly."
                        : "Everyone on the course is told as soon as you save — and emailed, if they take emails."
                }
            >
                {dialog && (
                    <ClassForm
                        courseId={courseId}
                        topics={topics}
                        liveClass={dialog.mode === "edit" ? dialog.liveClass : null}
                        onDone={() => {
                            setDialog(null);
                            refresh();
                        }}
                        onCancel={() => setDialog(null)}
                    />
                )}
            </Modal>
        </section>
    );
}

function ClassForm({
    courseId,
    topics,
    liveClass,
    onDone,
    onCancel,
}: {
    courseId: string;
    topics: { id: string; title: string }[];
    liveClass: StaffLiveClass | null;
    onDone: () => void;
    onCancel: () => void;
}) {
    const editing = liveClass !== null;
    const save = useMutation({
        mutationFn: (values: Values) => {
            const payload: LiveClassInput = {
                title: values.title,
                startsAt: localDateTimeToISO(values.startsAt),
                durationMinutes: values.durationMinutes,
                joinUrl: values.joinUrl || (editing ? null : undefined),
                topicId: values.topicId || (editing ? null : undefined),
                description: values.description || (editing ? null : undefined),
            };
            if (!liveClass) return liveClassService.create(courseId, payload);
            // Only send the time when it changed — an unchanged time isn't a move.
            const moved = new Date(payload.startsAt).getTime() !== new Date(liveClass.startsAt).getTime();
            return liveClassService.update(liveClass.id, { ...payload, startsAt: moved ? payload.startsAt : undefined });
        },
        onSuccess: (saved) => {
            toast.success(
                editing
                    ? "Saved."
                    : saved.recipients
                      ? `Scheduled — ${saved.recipients} ${saved.recipients === 1 ? "student has" : "students have"} been told.`
                      : "Scheduled.",
            );
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save the class.")),
    });

    const form = useZodForm({
        schema: editing
            ? schema
            : schema.refine((data) => new Date(data.startsAt).getTime() > Date.now() - PAST_GRACE_MS, {
                path: ["startsAt"],
                message: "Pick a time in the future",
            }),
        initialValues: {
            title: liveClass?.title ?? "",
            startsAt: liveClass ? toLocalDateTimeValue(new Date(liveClass.startsAt)) : tonight(),
            durationMinutes: liveClass?.durationMinutes ?? 90,
            joinUrl: liveClass?.joinUrl ?? "",
            topicId: liveClass?.topic?.id ?? "",
            description: liveClass?.description ?? "",
        },
        onSubmit: (values) => save.mutate(values),
    });
    const length = form.values.durationMinutes;

    return (
        <form noValidate onSubmit={form.handleSubmit} className={modalFormClass}>
            <ModalBody className="space-y-4">
                <FormField form={form} name="title" label="What's the class" required counterMax={160}>
                    <Input placeholder="e.g. Recursion, live" />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <FormField form={form} name="startsAt" label="Starts" required>
                        <DateTimeInput min={editing ? undefined : toLocalDateTimeValue(new Date())} />
                    </FormField>
                    <fieldset>
                        <legend className="mb-2 text-sm font-medium">Length</legend>
                        <div className="flex flex-wrap gap-1.5">
                            {LENGTHS.map((minutes) => (
                                <button
                                    key={minutes}
                                    type="button"
                                    aria-pressed={length === minutes}
                                    onClick={() => form.setValue("durationMinutes", minutes)}
                                    className={cn(
                                        "rounded-sm border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors",
                                        length === minutes ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                                    )}
                                >
                                    {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                </div>
                <FormField form={form} name="joinUrl" label="Meeting link" optional hint="Handed to students from 30 minutes before the start.">
                    <Input type="url" placeholder="https://zoom.us/j/…" />
                </FormField>
                {topics.length > 0 && (
                    <FormField form={form} name="topicId" label="Topic" optional hint="Where its recording will go.">
                        <Select>
                            <option value="">No topic</option>
                            {topics.map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.title}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                )}
                <FormField form={form} name="description" label="Note for students" optional counterMax={2000}>
                    <Textarea rows={2} placeholder="What to prepare, what it covers…" />
                </FormField>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                    {editing ? "Save" : "Schedule and tell the course"}
                </Button>
            </ModalFooter>
        </form>
    );
}
