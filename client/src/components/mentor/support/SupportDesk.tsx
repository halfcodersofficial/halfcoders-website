"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ban, CalendarPlus, ClipboardList, Copy, Link2Off, Pencil, Radio, Trash2, Users, Video } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import RowActions from "@/components/admin/RowActions";
import SupportStage from "@/components/mentor/dashboard/SupportStage";
import { clock, DAY_MS, dayMonthOf, dhakaDayKey, plural, weekdayOf } from "@/components/mentor/dashboard/time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { confirmAction } from "@/lib/confirm";
import { hasSupport } from "@/lib/courseClassification";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { dashboardService, supportService } from "@/services";
import type { ApiMeta } from "@/types/api.types";
import type { MentorColleagueSession, MentorPastSession, MentorSupportSession } from "@/types/mentor.types";
import SessionFormModal from "./SessionFormModal";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";
const PANEL = "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

/** "Today", "Tomorrow", or "Saturday 18 October". */
const dayHeading = (key: string, now: number) =>
    key === dhakaDayKey(now) ? "Today" : key === dhakaDayKey(now + DAY_MS) ? "Tomorrow" : `${weekdayOf(key, true)} ${dayMonthOf(key)}`;

type Dialog = { mode: "create"; courseId?: string } | { mode: "edit"; session: MentorSupportSession };

/**
 * The mentor's support sessions: the one on air or coming up next, every
 * session still to come day by day — each with its Meet link checked, its
 * line counted and the way to open its board — and the ones that are over,
 * with how their line went. Scheduling, editing, cancelling and deleting all
 * happen here; the queue itself is worked on the session's board.
 */
export default function SupportDesk() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const now = useNow(30_000);
    const [dialog, setDialog] = useState<Dialog | null>(null);

    const dashboard = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });
    // A previous (recorded) course holds no support sessions, so it's never offered to schedule one.
    const courses = (dashboard.data?.courses ?? []).filter((course) => hasSupport(course.phase));
    const sessions = useMemo(() => dashboard.data?.upcomingSupport ?? [], [dashboard.data]);
    const colleagues = (dashboard.data?.colleagueSessions ?? []).filter((session) => new Date(session.endTime).getTime() >= now);

    const past = useInfiniteQuery({
        queryKey: ["support", "past"],
        queryFn: ({ pageParam }): Promise<{ data: MentorPastSession[]; meta?: ApiMeta }> => supportService.myPastSessions({ page: pageParam, limit: 15 }),
        initialPageParam: 1,
        getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    });
    const pastSessions = past.data?.pages.flatMap((page) => page.data) ?? [];
    const pastTotal = past.data?.pages[0]?.meta?.total ?? pastSessions.length;

    // Links in: `?new=1` (and `&course=`) schedules, `?edit=<id>` edits — from the
    // dashboard, a course, or this page's own stage. Read, then dropped from the address.
    const linkNew = searchParams.get("new") === "1";
    const linkCourse = searchParams.get("course") ?? undefined;
    const linkEdit = searchParams.get("edit");
    useEffect(() => {
        if (!linkNew && !linkEdit) return;
        if (linkEdit && !dashboard.data) return;
        if (linkNew) setDialog({ mode: "create", courseId: linkCourse });
        else if (linkEdit) {
            const session = sessions.find((entry) => entry.id === linkEdit);
            if (session) setDialog({ mode: "edit", session });
            else toast.info("That session has already ended.");
        }
        router.replace(pathname, { scroll: false });
    }, [linkNew, linkCourse, linkEdit, dashboard.data, sessions, router, pathname]);

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "mentor"] });
        void queryClient.invalidateQueries({ queryKey: ["support"] });
    };

    const cancel = useMutation({
        mutationFn: (session: MentorSupportSession) => supportService.setSessionStatus(session.id, "CANCELLED"),
        onSuccess: () => {
            toast.success("Session cancelled — students have been told.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't cancel that session.")),
    });
    const remove = useMutation({
        mutationFn: (session: MentorSupportSession) => supportService.deleteSession(session.id),
        onSuccess: () => {
            toast.success("Session deleted.");
            refresh();
        },
        // The API refuses once students have joined — attendance must stick — and says so.
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't delete that session.")),
    });

    const askCancel = async (session: MentorSupportSession) => {
        const confirmed = await confirmAction({
            title: `Cancel “${session.title || "Support session"}”?`,
            text: "Anyone in line is let go, and everyone on the course is told it's off. It stays in your past sessions.",
            confirmText: "Cancel session",
        });
        if (confirmed) cancel.mutate(session);
    };
    const askDelete = async (session: MentorSupportSession) => {
        const confirmed = await confirmAction({
            title: `Delete “${session.title || "Support session"}”?`,
            text: "It's removed for good. Students who were told about it aren't told it's gone — cancel it instead if they might come.",
            confirmText: "Delete session",
        });
        if (confirmed) remove.mutate(session);
    };

    // Still to come (or on now), by Dhaka day.
    const upcoming = sessions.filter((session) => new Date(session.endTime).getTime() >= now);
    const days = upcoming.reduce<{ key: string; sessions: MentorSupportSession[] }[]>((groups, session) => {
        const key = dhakaDayKey(session.startTime);
        const last = groups.at(-1);
        if (last && last.key === key) last.sessions.push(session);
        else groups.push({ key, sessions: [session] });
        return groups;
    }, []);

    return (
        <div className="container-page space-y-6 py-8 sm:py-10">
            <header className={cn("flex flex-wrap items-end justify-between gap-4", RISE)}>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold sm:text-3xl">Support sessions</h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                        Schedule a session and your students are told. When it goes live they take a number, and you work the line from its board.
                    </p>
                </div>
                {courses.length > 0 && (
                    <Button onClick={() => setDialog({ mode: "create" })}>
                        <CalendarPlus /> Schedule a session
                    </Button>
                )}
            </header>

            {dashboard.isLoading ? (
                <div className="space-y-6">
                    <Skeleton className="h-72 rounded-3xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
            ) : dashboard.isError ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="font-medium">Couldn&apos;t load your sessions.</p>
                    <Button variant="outline" className="mt-4" onClick={() => dashboard.refetch()}>
                        Try again
                    </Button>
                </div>
            ) : (
                <>
                    <div className={RISE} style={{ animationDelay: "60ms" }}>
                        <SupportStage sessions={sessions} />
                    </div>

                    <section aria-labelledby="upcoming-title" className={cn(PANEL, RISE)} style={{ animationDelay: "120ms" }}>
                        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4 sm:px-6">
                            <h2 id="upcoming-title" className="text-lg font-semibold tracking-tight">
                                Coming up <span className="font-normal text-muted-foreground">{upcoming.length}</span>
                            </h2>
                            <p className="text-xs text-muted-foreground">Dhaka time</p>
                        </header>
                        {upcoming.length === 0 ? (
                            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                                Nothing scheduled.{" "}
                                {courses.length > 0 && (
                                    <button type="button" onClick={() => setDialog({ mode: "create" })} className="font-medium text-primary hover:underline">
                                        Schedule a session
                                    </button>
                                )}
                            </p>
                        ) : (
                            <ol>
                                {days.map((day) => (
                                    <li key={day.key}>
                                        <p className="border-b border-border bg-secondary/30 px-5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                                            {dayHeading(day.key, now)}
                                        </p>
                                        <ul className="divide-y divide-border border-b border-border last:border-b-0">
                                            {day.sessions.map((session) => (
                                                <UpcomingRow
                                                    key={session.id}
                                                    session={session}
                                                    now={now}
                                                    onEdit={() => setDialog({ mode: "edit", session })}
                                                    onCancel={() => void askCancel(session)}
                                                    onDelete={() => void askDelete(session)}
                                                />
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>

                    {colleagues.length > 0 && (
                        <section aria-labelledby="colleagues-title" className={cn(PANEL, RISE)} style={{ animationDelay: "150ms" }}>
                            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4 sm:px-6">
                                <h2 id="colleagues-title" className="text-lg font-semibold tracking-tight">
                                    Co-mentors&apos; sessions <span className="font-normal text-muted-foreground">{colleagues.length}</span>
                                </h2>
                                <p className="text-xs text-muted-foreground">On courses you share — step in on the board if they need a hand</p>
                            </header>
                            <ul className="divide-y divide-border">
                                {colleagues.map((session) => (
                                    <ColleagueRow key={session.id} session={session} now={now} />
                                ))}
                            </ul>
                        </section>
                    )}

                    <section aria-labelledby="past-title" className={cn(PANEL, RISE)} style={{ animationDelay: "180ms" }}>
                        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4 sm:px-6">
                            <h2 id="past-title" className="text-lg font-semibold tracking-tight">
                                Past sessions <span className="font-normal text-muted-foreground">{pastTotal}</span>
                            </h2>
                            <p className="text-xs text-muted-foreground">How each line went — open one for its attendance</p>
                        </header>
                        {past.isLoading ? (
                            <div className="space-y-2 p-4">
                                <Skeleton className="h-14" />
                                <Skeleton className="h-14" />
                            </div>
                        ) : pastSessions.length === 0 ? (
                            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Sessions you&apos;ve run show up here once they&apos;re over.</p>
                        ) : (
                            <>
                                <ul className="divide-y divide-border">
                                    {pastSessions.map((session) => (
                                        <PastRow key={session.id} session={session} />
                                    ))}
                                </ul>
                                {past.hasNextPage && (
                                    <div className="border-t border-border p-2">
                                        <Button variant="ghost" className="w-full" onClick={() => past.fetchNextPage()} isLoading={past.isFetchingNextPage}>
                                            Show older sessions
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </>
            )}

            <SessionFormModal
                open={dialog !== null}
                onOpenChange={(open) => !open && setDialog(null)}
                courses={courses}
                session={dialog?.mode === "edit" ? dialog.session : null}
                initialCourseId={dialog?.mode === "create" ? dialog.courseId : undefined}
            />
        </div>
    );
}

function UpcomingRow({
    session,
    now,
    onEdit,
    onCancel,
    onDelete,
}: {
    session: MentorSupportSession;
    now: number;
    onEdit: () => void;
    onCancel: () => void;
    onDelete: () => void;
}) {
    const live = new Date(session.startTime).getTime() <= now;
    const waiting = session.queueStats?.waiting ?? 0;
    const joined = session._count?.queue ?? 0;
    const capacity = Math.max(1, Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60_000 / session.slotMinutes));

    return (
        <li className={cn("grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:px-6", live && "bg-success/5")}>
            <p className="tabular-nums">
                <span className="block text-sm font-semibold">{clock(session.startTime)}</span>
                <span className="block text-xs text-muted-foreground">to {clock(session.endTime)}</span>
            </p>
            <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{session.title || "Support session"}</span>
                    {live && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                            <span className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" aria-hidden />
                            Live · {waiting} waiting
                        </span>
                    )}
                    {!session.joinOpen && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">Sign-ups closed</span>}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="truncate">{session.course.title}</span>
                    <span aria-hidden>·</span>
                    <span>
                        {session.slotMinutes} min a student, room for ~{capacity}
                    </span>
                    {!live && joined > 0 && (
                        <>
                            <span aria-hidden>·</span>
                            <span>{plural(joined, "student")} joined</span>
                        </>
                    )}
                    <span aria-hidden>·</span>
                    {session.meetingLink ? (
                        <span className="inline-flex items-center gap-1 text-foreground/80">
                            <Video className="size-3.5" aria-hidden /> Meet link set
                        </span>
                    ) : (
                        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 font-medium text-amber-700 hover:underline dark:text-amber-400">
                            <Link2Off className="size-3.5" aria-hidden /> No Meet link yet — add one
                        </button>
                    )}
                </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
                <RowActions
                    label={`More for ${session.title || "this session"}`}
                    primary={
                        <Button asChild size="sm" variant={live ? "default" : "outline"}>
                            <Link href={`/mentor/support/${session.id}`}>
                                {live ? (
                                    <>
                                        <Radio /> Open queue board
                                    </>
                                ) : (
                                    "Open"
                                )}
                            </Link>
                        </Button>
                    }
                    items={[
                        { label: "Edit", icon: Pencil, onSelect: onEdit },
                        {
                            label: "Copy Meet link",
                            icon: Copy,
                            hidden: !session.meetingLink,
                            onSelect: () =>
                                void navigator.clipboard?.writeText(session.meetingLink ?? "").then(
                                    () => toast.success("Meet link copied."),
                                    () => toast.error("Couldn't copy it."),
                                ),
                        },
                        { label: "Cancel session", icon: Ban, onSelect: onCancel, destructive: true, separatorBefore: true },
                        // Once anyone has joined, deleting would erase attendance — the API refuses; cancel instead.
                        { label: "Delete", icon: Trash2, onSelect: onDelete, destructive: true, hidden: joined > 0 },
                    ]}
                />
            </div>
        </li>
    );
}

function ColleagueRow({ session, now }: { session: MentorColleagueSession; now: number }) {
    const live = new Date(session.startTime).getTime() <= now;
    const day = dhakaDayKey(session.startTime);
    return (
        <li className={cn("grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3.5 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:px-6", live && "bg-success/5")}>
            <p className="tabular-nums">
                <span className="block text-sm font-semibold">{clock(session.startTime)}</span>
                <span className="block truncate text-xs text-muted-foreground">{dayHeading(day, now)}</span>
            </p>
            <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{session.title || "Support session"}</span>
                    {live && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                            <span className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" aria-hidden />
                            Live · {session.queueStats.waiting} waiting
                        </span>
                    )}
                </p>
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                        {session.mentor.name} · {session.course.title} · until {clock(session.endTime)}
                    </span>
                </p>
            </div>
            <Link
                href={`/mentor/support/${session.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                aria-label={`${live ? "Open the board for" : "View"} ${session.mentor.name}'s session`}
            >
                <span className="max-sm:sr-only">{live ? "Open board" : "View"}</span> <ArrowRight className="size-3.5" aria-hidden />
            </Link>
        </li>
    );
}

function PastRow({ session }: { session: MentorPastSession }) {
    const { attendance } = session;
    const cancelled = session.status === "CANCELLED";
    const key = dhakaDayKey(session.startTime);
    const share = (count: number) => (attendance.joined > 0 ? (count / attendance.joined) * 100 : 0);

    return (
        <li>
            <Link
                href={`/mentor/support/${session.id}/history`}
                className="group grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-secondary/40 sm:grid-cols-[5.5rem_minmax(0,1fr)_14rem_auto] sm:px-6"
            >
                <span className="tabular-nums">
                    <span className="block text-sm font-semibold">
                        {weekdayOf(key)} {Number(key.slice(8))}
                    </span>
                    <span className="block text-xs text-muted-foreground">{clock(session.startTime)}</span>
                </span>
                <span className="min-w-0">
                    <span className="flex items-center gap-2">
                        <span className={cn("truncate text-sm font-semibold", cancelled && "text-muted-foreground line-through")}>{session.title || "Support session"}</span>
                        {cancelled && <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-medium text-secondary-foreground">Cancelled</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                        {session.course.title} · {dayMonthOf(key)}
                    </span>
                </span>
                <span className="col-span-2 min-w-0 sm:col-span-1">
                    {attendance.joined === 0 ? (
                        <span className="text-xs text-muted-foreground">{cancelled ? "Called off" : "Nobody joined"}</span>
                    ) : (
                        <>
                            <span className="flex h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                                <span className="bg-brand" style={{ width: `${share(attendance.helped)}%` }} />
                                <span className="bg-amber-400" style={{ width: `${share(attendance.skipped)}%` }} />
                                <span className="bg-muted-foreground/40" style={{ width: `${share(attendance.left)}%` }} />
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                                <span className="font-semibold tabular-nums text-foreground">{attendance.helped}</span> helped of {attendance.joined}
                                {attendance.skipped > 0 && ` · ${attendance.skipped} skipped`}
                                {attendance.left > 0 && ` · ${attendance.left} left`}
                            </span>
                        </>
                    )}
                </span>
                <span className="hidden items-center gap-1 text-xs font-medium text-primary sm:inline-flex">
                    <ClipboardList className="size-3.5" aria-hidden /> Attendance
                </span>
            </Link>
        </li>
    );
}
