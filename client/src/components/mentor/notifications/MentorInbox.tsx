"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { clock, dhakaDayKey, elapsed, weekdayOf } from "@/components/mentor/dashboard/time";
import Inbox, { type InboxConfig } from "@/components/shared/inbox/Inbox";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { assignmentService, dashboardService } from "@/services";
import type { AppNotification } from "@/types/domain.types";

/** What a notification's link points at, in the mentor console. */
function targetOf(link: string | null) {
    if (!link) return null;
    const url = new URL(link, "https://halfcoders.local");
    const path = url.pathname;
    if (path === "/mentor/reviews") {
        return { kind: "reviews" as const, courseId: url.searchParams.get("course"), assignmentId: url.searchParams.get("assignment") };
    }
    const session = path.match(/^\/mentor\/support\/([^/]+)$/);
    if (session) return { kind: "session" as const, id: session[1] };
    const course = path.match(/^\/mentor\/courses\/([^/]+)$/);
    if (course) return { kind: "course" as const, id: course[1] };
    return null;
}

const MENTOR_INBOX: InboxConfig = {
    title: "Notifications",
    blurb: "hand-ins, your sessions, your courses and announcements.",
    filters: [
        {
            value: "",
            label: "All",
            params: {},
            empty: {
                title: "Nothing here yet.",
                text: "Hand-ins from your students, your sessions going live, courses you're added to and the Half Coders team's announcements land here.",
            },
        },
        {
            value: "UNREAD",
            label: "Unread",
            params: { isRead: "false" },
            counts: "all",
            empty: { title: "All caught up.", text: "Nothing unread — new ones show up here the moment they arrive." },
        },
        {
            value: "ASSIGNMENT",
            label: "Hand-ins",
            params: { type: "ASSIGNMENT" },
            counts: ["ASSIGNMENT"],
            empty: {
                title: "No hand-ins yet.",
                text: "When a student hands in or resubmits work on a course you teach, it shows here — one entry per assignment, counting up until you read it.",
            },
        },
        {
            value: "SUPPORT",
            label: "Support",
            params: { type: "SUPPORT" },
            counts: ["SUPPORT"],
            empty: { title: "No support updates.", text: "You're told here when a session you host goes live." },
        },
        {
            value: "COURSE",
            label: "Courses",
            params: { type: "COURSE" },
            counts: ["COURSE"],
            empty: { title: "No course changes.", text: "When an admin adds you to a course, changes your role on one or takes you off it, it shows here." },
        },
        {
            value: "ANNOUNCEMENT",
            label: "Announcements",
            params: { type: ["GENERAL", "SYSTEM"] },
            counts: ["GENERAL", "SYSTEM"],
            empty: { title: "No announcements.", text: "Messages the Half Coders team sends to mentors show here." },
        },
    ],
    types: {
        ASSIGNMENT: { label: "Hand-in", noun: "hand-in update", icon: ClipboardCheck },
    },
    actionFor: ({ link }) => {
        const target = targetOf(link);
        if (target?.kind === "reviews") return target.assignmentId ? "Review these hand-ins" : "Open the review queue";
        if (target?.kind === "session") return "Open the queue board";
        if (target?.kind === "course") return "Open the course";
        if (link === "/mentor/courses") return "Your courses";
        return "Open";
    },
    Context: MentorContext,
};

/**
 * The mentor's inbox: the shared staff inbox, with mentor filters and, under
 * each message, how things stand now — the hand-ins still waiting, whether
 * the session is live, how the course is doing.
 */
export default function MentorInbox() {
    return <Inbox config={MENTOR_INBOX} />;
}

function MentorContext({ notification }: { notification: AppNotification }) {
    const target = targetOf(notification.link);
    if (target?.kind === "reviews" && target.assignmentId) {
        return <HandInsWaiting courseId={target.courseId} assignmentId={target.assignmentId} />;
    }
    if (target?.kind === "session") return <SessionNow id={target.id} />;
    if (target?.kind === "course") return <CourseNow id={target.id} />;
    return null;
}

function Panel({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-xl border border-border">
            <header className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-2">
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
                {aside}
            </header>
            {children}
        </section>
    );
}

/** The hand-ins on this assignment still waiting for a review, oldest first — each opening on its form. */
function HandInsWaiting({ courseId, assignmentId }: { courseId: string | null; assignmentId: string }) {
    const now = useNow(60_000);
    // Under `["reviews"]`, so saving a review in the queue refreshes this too.
    const { data, isLoading } = useQuery({
        queryKey: ["reviews", "assignment", assignmentId],
        queryFn: () =>
            assignmentService.reviewQueue({
                assignmentId,
                courseId: courseId ?? undefined,
                status: "SUBMITTED",
                sortOrder: "asc",
                limit: 5,
            }),
    });
    const waiting = data?.data ?? [];
    const total = data?.meta?.total ?? waiting.length;
    const query = `${courseId ? `&course=${courseId}` : ""}&assignment=${assignmentId}`;

    return (
        <Panel label="Waiting now" aside={!isLoading && <span className="text-xs font-semibold tabular-nums">{total}</span>}>
            {isLoading ? (
                <div className="space-y-2 p-3">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                </div>
            ) : total === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">All reviewed — nothing from this assignment is waiting.</p>
            ) : (
                <>
                    <ul className="divide-y divide-border">
                        {waiting.map((submission) => {
                            const wait = elapsed(submission.submittedAt, now);
                            return (
                                <li key={submission.id}>
                                    <Link
                                        href={`/mentor/reviews?status=SUBMITTED&focus=${submission.id}${query}`}
                                        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/40"
                                    >
                                        <Avatar name={submission.student.name} size={28} />
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{submission.student.name}</span>
                                        {submission.maxScore !== null && (
                                            <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-px text-[0.6875rem] font-medium text-amber-700 dark:text-amber-400">
                                                Late
                                            </span>
                                        )}
                                        <span
                                            className={cn(
                                                "shrink-0 text-xs tabular-nums",
                                                wait.days >= 2 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                                            )}
                                        >
                                            {wait.text}
                                        </span>
                                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    {total > waiting.length && (
                        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">and {total - waiting.length} more behind them</p>
                    )}
                </>
            )}
        </Panel>
    );
}

/** The session as it stands: live with its line, still to come, or over. */
function SessionNow({ id }: { id: string }) {
    const now = useNow(30_000);
    const { data, isLoading } = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });
    if (isLoading) return <Skeleton className="h-14 rounded-xl" />;

    const session = data?.upcomingSupport.find((entry) => entry.id === id);
    if (!session || new Date(session.endTime).getTime() < now) {
        return (
            <Panel label="This session">
                <p className="px-4 py-3 text-sm text-muted-foreground">
                    It&apos;s over.{" "}
                    <Link href={`/mentor/support/${id}/history`} className="font-medium text-primary hover:underline">
                        See who came
                    </Link>
                </p>
            </Panel>
        );
    }

    const live = new Date(session.startTime).getTime() <= now;
    const queue = session.queueStats;
    return (
        <Panel label="This session">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
                {live ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-success">
                        <span className="relative flex size-2.5" aria-hidden>
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
                            <span className="relative inline-flex size-2.5 rounded-full bg-success" />
                        </span>
                        Live until {clock(session.endTime)}
                    </span>
                ) : (
                    <span className="font-semibold">
                        Starts {dhakaDayKey(session.startTime) === dhakaDayKey(now) ? "today" : weekdayOf(dhakaDayKey(session.startTime), true)}{" "}
                        {clock(session.startTime)}
                    </span>
                )}
                {queue && (
                    <span className="text-muted-foreground">
                        <span className="font-medium tabular-nums text-foreground">{queue.waiting}</span> waiting ·{" "}
                        <span className="font-medium tabular-nums text-foreground">{queue.done}</span> helped
                    </span>
                )}
                <span className="truncate text-muted-foreground">{session.course.title}</span>
            </div>
        </Panel>
    );
}

/** How the course is doing, from the dashboard's own figures. */
function CourseNow({ id }: { id: string }) {
    const { data, isLoading } = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });
    if (isLoading) return <Skeleton className="h-14 rounded-xl" />;

    const course = data?.courses.find((entry) => entry.id === id);
    if (!course) return null;
    const { stats } = course;
    const figures: { value: ReactNode; label: string; href?: string }[] = [
        { value: stats.students, label: stats.students === 1 ? "student" : "students" },
        { value: `${stats.averageProgress}%`, label: "average progress" },
        { value: stats.toReview, label: "to review", href: stats.toReview > 0 ? `/mentor/reviews?course=${id}` : undefined },
        { value: stats.completed, label: "finished" },
    ];

    return (
        <Panel label={course.title}>
            {/* 1px gaps over the border colour draw the dividers. */}
            <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                {figures.map((figure) => {
                    const body = (
                        <>
                            <span className="block text-lg font-bold tabular-nums">{figure.value}</span>
                            <span className="block text-xs text-muted-foreground">{figure.label}</span>
                        </>
                    );
                    return (
                        <li key={figure.label} className="bg-card">
                            {figure.href ? (
                                <Link href={figure.href} className="block px-4 py-3 transition-colors hover:bg-secondary/40">
                                    {body}
                                </Link>
                            ) : (
                                <div className="px-4 py-3">{body}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}
