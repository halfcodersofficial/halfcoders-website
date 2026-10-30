"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { CalendarPlus, ChevronRight, Clock, Lock, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CourseSummaryHeader, since } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import { LiveNowBadge, SupportPhaseBar } from "@/components/admin/support/SupportCourseCard";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateTimeInput, localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, modalFormClass } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupportSlotDefault } from "@/hooks/useSupportSlotDefault";
import { useZodForm } from "@/hooks/useZodForm";
import { hasSupport } from "@/lib/courseClassification";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatTime } from "@/lib/utils";
import { dateTimeField, numericField, optionalTextField, optionalUrlField } from "@/lib/validation";
import { supportService } from "@/services";
import { adminService } from "@/services/admin";
import type { AdminSupportCourseDetail, AdminSupportSession } from "@/types/admin.types";

/** Five minutes of slack, so a session being scheduled right now still saves. */
const PAST_GRACE_MS = 5 * 60_000;

const createSessionSchema = z
    .object({
        title: optionalTextField({ label: "Title", max: 160 }),
        /** Empty means "default to me" — see `resolveHostMentorId` server-side. */
        mentorId: optionalTextField({ label: "Mentor" }),
        meetingLink: optionalUrlField("Paste the full meeting link, e.g. https://meet.google.com/abc-defg-hij"),
        startTime: dateTimeField,
        endTime: dateTimeField,
        slotMinutes: numericField({ label: "Minutes per student", min: 1, max: 60 }),
        notes: optionalTextField({ label: "Notes", max: 2000 }),
    })
    .refine((data) => new Date(data.startTime).getTime() > Date.now() - PAST_GRACE_MS, {
        path: ["startTime"],
        message: "Pick a start time in the future — students are notified as soon as you schedule it",
    })
    .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
        path: ["endTime"],
        message: "The session must end after it starts",
    });

/** Tonight at 21:00–22:00, the slot most mentors actually use. */
const defaultWindow = () => {
    const start = new Date();
    start.setHours(21, 0, 0, 0);
    const end = new Date(start);
    end.setHours(22, 0, 0, 0);
    return { start: toLocalDateTimeValue(start), end: toLocalDateTimeValue(end) };
};

type Phase = "live" | "upcoming" | "held" | "cancelled";
type Filter = "" | "UPCOMING" | "HELD" | "CANCELLED";

/** As the server rolls them up: "live" by the clock, "upcoming" not started, "held" past or ended. */
const phaseOf = (session: AdminSupportSession, now: number): Phase => {
    if (session.status === "CANCELLED") return "cancelled";
    if (session.isLive) return "live";
    if (session.status !== "ENDED" && new Date(session.startTime).getTime() > now) return "upcoming";
    return "held";
};

const RANK: Record<Phase, number> = { live: 0, upcoming: 1, held: 2, cancelled: 3 };

const inFilter = (phase: Phase, filter: Filter) =>
    filter === "" ||
    (filter === "UPCOMING" && (phase === "live" || phase === "upcoming")) ||
    (filter === "HELD" && phase === "held") ||
    (filter === "CANCELLED" && phase === "cancelled");

/**
 * One course's support sessions: its roll-up on top, then every session —
 * live first, upcoming soonest first, then the past. Scheduling happens
 * here, so a new session always belongs to this course.
 */
export default function AdminSupportCoursePage() {
    const { courseId } = useParams<{ courseId: string }>();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<Filter>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [scheduling, setScheduling] = useState(false);

    const summaryQuery = useQuery({
        queryKey: ["admin", "support-course", courseId],
        queryFn: () => adminService.supportCourse(courseId),
        refetchInterval: 60_000,
    });

    const { data: sessions, isLoading } = useQuery({
        queryKey: ["admin", "support", courseId],
        queryFn: () => adminService.supportSessions(courseId),
        refetchInterval: 60_000,
    });

    const summary = summaryQuery.data;
    const now = Date.now();
    const term = searchTerm.trim().toLowerCase();
    const list = (sessions ?? [])
        .map((session) => ({ session, phase: phaseOf(session, now) }))
        .filter(({ session, phase }) =>
            inFilter(phase, filter) &&
            (!term ||
                (session.title ?? "support session").toLowerCase().includes(term) ||
                session.mentor.name.toLowerCase().includes(term)),
        )
        .sort((a, b) => {
            const byPhase = RANK[a.phase] - RANK[b.phase];
            if (byPhase !== 0) return byPhase;
            const gap = new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime();
            // Ahead of us: soonest first. Behind: most recent first.
            return a.phase === "upcoming" || a.phase === "live" ? gap : -gap;
        });

    // For the header: the next session still to start, even while another is live.
    const nextUpcoming = (sessions ?? [])
        .filter((session) => phaseOf(session, now) === "upcoming")
        .reduce<AdminSupportSession | null>(
            (soonest, session) => (!soonest || session.startTime < soonest.startTime ? session : soonest),
            null,
        );

    // A previous (recorded) course holds no support sessions — the API refuses one too.
    const supportOpen = !summary || hasSupport(summary.course.phase);
    const scheduleButton = supportOpen ? (
        <Button onClick={() => setScheduling(true)}>
            <CalendarPlus /> Schedule session
        </Button>
    ) : (
        <Button disabled title="A previous (recorded) course has no support sessions">
            <Lock /> No support sessions
        </Button>
    );

    if (summaryQuery.isError) {
        return (
            <div className="space-y-5">
                <BackButton href="/admin/support" label="All courses" />
                <div className="rounded-card border border-dashed border-border bg-card px-6 py-16 text-center">
                    <p className="font-medium">This course couldn&apos;t be found.</p>
                    <p className="mt-1 text-sm text-muted-foreground">It may have been removed. Go back to pick another course.</p>
                </div>
            </div>
        );
    }

    const counts = summary?.counts;

    return (
        <>
            <DataShell
                header={
                    <div className="space-y-4">
                        <BackButton href="/admin/support" label="All courses" />
                        {summary ? (
                            <CourseHeader summary={summary} nextUpcomingAt={nextUpcoming?.startTime ?? null} action={scheduleButton} />
                        ) : (
                            <Skeleton className="h-72 rounded-card" />
                        )}
                    </div>
                }
                searchPlaceholder="Search by title or mentor…"
                onSearch={setSearchTerm}
                filters={[
                    { value: "", label: "All", count: counts?.total },
                    { value: "UPCOMING", label: "Live & upcoming", count: counts ? counts.live + counts.upcoming : undefined },
                    { value: "HELD", label: "Held", count: counts?.held },
                    ...(counts?.cancelled ? [{ value: "CANCELLED", label: "Cancelled", count: counts.cancelled }] : []),
                ]}
                activeFilter={filter}
                onFilter={(value) => setFilter(value as Filter)}
                isLoading={isLoading}
                skeleton={
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-20 rounded-card" />
                        ))}
                    </div>
                }
                isEmpty={list.length === 0}
                emptyMessage={
                    term ? "No sessions match." : filter ? "No sessions here." : "No sessions for this course yet."
                }
                emptyHint={
                    term || filter
                        ? "Try a different search or filter."
                        : !supportOpen
                          ? "This is a previous (recorded) course, so it holds no support sessions. Move it back to Present in the course editor to schedule one."
                          : "Schedule one, or a mentor can from their console. Students are notified when it's scheduled."
                }
                emptyAction={!term && !filter && supportOpen ? scheduleButton : undefined}
            >
                <ul className="space-y-2">
                    {list.map(({ session, phase }) => (
                        <li key={session.id}>
                            <SessionRow session={session} phase={phase} courseId={courseId} />
                        </li>
                    ))}
                </ul>
            </DataShell>

            <Modal
                open={scheduling}
                onOpenChange={setScheduling}
                size="lg"
                closeOnOutsideClick={false}
                title="Schedule a support session"
                description={summary ? `For ${summary.course.title}. Its students are notified straight away.` : undefined}
            >
                {scheduling && summary && (
                    <ScheduleForm
                        courseId={courseId}
                        mentors={summary.mentors}
                        onDone={() => {
                            setScheduling(false);
                            void queryClient.invalidateQueries({ queryKey: ["admin", "support", courseId] });
                            void queryClient.invalidateQueries({ queryKey: ["admin", "support-course", courseId] });
                            void queryClient.invalidateQueries({ queryKey: ["admin", "support-courses"] });
                        }}
                        onCancel={() => setScheduling(false)}
                    />
                )}
            </Modal>
        </>
    );
}

function CourseHeader({
    summary,
    nextUpcomingAt,
    action,
}: {
    summary: AdminSupportCourseDetail;
    nextUpcomingAt: string | null;
    action: React.ReactNode;
}) {
    const { counts } = summary;
    return (
        <CourseSummaryHeader
            course={summary.course}
            action={action}
            details={
                <>
                    <span className="inline-flex items-center gap-2">
                        {summary.mentors.length > 0 ? (
                            <>
                                <span className="flex -space-x-1.5">
                                    {summary.mentors.slice(0, 4).map((mentor) => (
                                        <span key={mentor.id} title={mentor.name} className="rounded-full ring-2 ring-card">
                                            <Avatar src={mentor.image} name={mentor.name} size={28} />
                                        </span>
                                    ))}
                                </span>
                                {summary.mentors.length === 1
                                    ? `${summary.mentors[0].name} can host`
                                    : `${summary.mentors.length} mentors can host`}
                            </>
                        ) : (
                            "No mentors assigned — you can host it yourself"
                        )}
                    </span>
                    {summary.next?.isLive && <LiveNowBadge />}
                </>
            }
            stats={[
                {
                    label: "Live now",
                    value: String(counts.live),
                    hint: summary.next?.isLive ? summary.next.mentorName : "Nothing running",
                },
                {
                    label: "Upcoming",
                    value: String(counts.upcoming),
                    hint: nextUpcomingAt
                        ? `Next ${formatDistanceToNowStrict(new Date(nextUpcomingAt), { addSuffix: true })}`
                        : "None scheduled",
                },
                { label: "Held", value: String(counts.held), hint: since("Last", summary.lastHeldAt, "None yet") },
                { label: "Students joined", value: String(summary.joined), hint: "Across every session" },
            ]}
            bar={<SupportPhaseBar counts={counts} />}
        />
    );
}

/** One session: a calendar leaf for its day, what and who, and the way to its attendance. */
function SessionRow({ session, phase, courseId }: { session: AdminSupportSession; phase: Phase; courseId: string }) {
    const start = new Date(session.startTime);
    const ahead = phase === "upcoming";

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-4 rounded-card border bg-card p-3 pr-4 shadow-card",
                phase === "live" ? "border-success/40 bg-success/5" : "border-border",
                phase === "cancelled" && "opacity-70",
            )}
        >
            <div
                className={cn(
                    "grid w-14 shrink-0 overflow-hidden rounded-md border text-center",
                    phase === "live" ? "border-success/40" : "border-border",
                )}
            >
                <span
                    className={cn(
                        "py-0.5 text-[0.625rem] font-semibold font-mono uppercase tracking-wider",
                        phase === "live" ? "bg-success text-success-foreground" : ahead ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                    )}
                >
                    {start.toLocaleDateString("en-GB", { month: "short" })}
                </span>
                <span className="py-1 text-xl font-bold leading-none tabular-nums">{start.getDate()}</span>
                <span className="pb-1 text-[0.625rem] font-medium uppercase text-muted-foreground">
                    {start.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{session.title ?? "Support session"}</p>
                    {phase === "live" ? (
                        <LiveNowBadge />
                    ) : phase === "upcoming" ? (
                        <Badge variant="default">Upcoming</Badge>
                    ) : phase === "cancelled" ? (
                        <Badge variant="destructive">Cancelled</Badge>
                    ) : (
                        <Badge variant="secondary">Held</Badge>
                    )}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <Avatar src={session.mentor.image} name={session.mentor.name} size={18} />
                        {session.mentor.name}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="size-3" aria-hidden />
                        {formatTime(session.startTime)}–{formatTime(session.endTime)}
                        {ahead && ` · ${formatDistanceToNowStrict(start, { addSuffix: true })}`}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users className="size-3" aria-hidden />
                        {session._count.queue} joined · {session.slotMinutes} min each
                    </span>
                </p>
            </div>

            <Button asChild variant="outline" size="sm">
                <Link href={`/admin/support/${session.id}/history?course=${courseId}`}>
                    Attendance <ChevronRight />
                </Link>
            </Button>
        </div>
    );
}

function ScheduleForm({
    courseId,
    mentors,
    onDone,
    onCancel,
}: {
    courseId: string;
    mentors: AdminSupportCourseDetail["mentors"];
    onDone: () => void;
    onCancel: () => void;
}) {
    const slot = defaultWindow();
    const form = useZodForm({
        schema: createSessionSchema,
        initialValues: {
            title: "Support Session",
            mentorId: "",
            meetingLink: "",
            startTime: slot.start,
            endTime: slot.end,
            slotMinutes: "5",
            notes: "",
        },
        onSubmit: (values) => create.mutate(values),
    });
    useSupportSlotDefault(form.values.slotMinutes, (value) => form.setValue("slotMinutes", value));

    const create = useMutation({
        mutationFn: (values: z.output<typeof createSessionSchema>) =>
            supportService.createSession({
                courseId,
                title: values.title || undefined,
                mentorId: values.mentorId || undefined,
                meetingLink: values.meetingLink || undefined,
                startTime: localDateTimeToISO(values.startTime),
                endTime: localDateTimeToISO(values.endTime),
                slotMinutes: Number(values.slotMinutes),
                notes: values.notes || undefined,
            }),
        onSuccess: () => {
            toast.success("Session scheduled — students have been notified.");
            onDone();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't schedule that session.")),
    });

    return (
        <form className={modalFormClass} noValidate onSubmit={form.handleSubmit}>
            <ModalBody className="space-y-4">
                <RequiredLegend />

                <FormField form={form} name="title" label="Session title" optional counterMax={160}>
                    <Input placeholder="Support Session" />
                </FormField>

                <FormField form={form} name="mentorId" label="Mentor" optional hint="Who hosts it. Leave blank to host it yourself.">
                    <Select placeholder="You (default)">
                        {mentors.map((mentor) => (
                            <option key={mentor.id} value={mentor.id}>
                                {mentor.name}
                            </option>
                        ))}
                    </Select>
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField form={form} name="startTime" label="Starts" required>
                        <DateTimeInput min={toLocalDateTimeValue(new Date())} />
                    </FormField>
                    <FormField form={form} name="endTime" label="Ends" required>
                        <DateTimeInput min={form.values.startTime} />
                    </FormField>
                </div>

                <FormField
                    form={form}
                    name="meetingLink"
                    label="Google Meet link"
                    optional
                    hint="Students only see this once the session goes live."
                >
                    <Input type="url" inputMode="url" spellCheck={false} placeholder="https://meet.google.com/abc-defg-hij" />
                </FormField>

                <FormField
                    form={form}
                    name="slotMinutes"
                    label="Minutes per student"
                    required
                    className="max-w-xs"
                    hint="Only used for the wait estimate students see."
                >
                    <Input type="number" inputMode="numeric" min={1} max={60} />
                </FormField>

                <FormField form={form} name="notes" label="Notes" optional counterMax={2000} hint="For staff only — students never see this.">
                    <Textarea rows={3} />
                </FormField>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={create.isPending}>
                    {!create.isPending && <CalendarPlus />} Schedule session
                </Button>
            </ModalFooter>
        </form>
    );
}
