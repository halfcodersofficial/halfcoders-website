"use client";

import { BookOpen, CalendarClock, ChevronRight, GraduationCap, Headphones, Radio } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Modal, ModalBody } from "@/components/ui/modal";
import { SafeImage } from "@/components/ui/safe-image";
import { hasSupport } from "@/lib/courseClassification";
import { cn, formatDateTime } from "@/lib/utils";
import type { StudentDashboard } from "@/types/domain.types";

/**
 * The header's support entry point — what "Support" replaces where the
 * catalogue search used to sit for a signed-in student.
 *
 * Half Coders has no recurring "office hours" concept — a mentor schedules one
 * dated window per session (`SupportSession.startTime`/`endTime`), nothing
 * repeats automatically. Support is also course-scoped: a session belongs to
 * one course's mentor, so a student picks which of their enrolled courses
 * they need help with before seeing anything else — that's the `/learn/
 * {slug}/support` page, which already owns the live/queue/empty states in
 * full. This modal is just that course picker, with a small live/upcoming
 * hint per row pulled from `dashboard.upcomingSupport` — passed in rather
 * than re-fetched, since the header already holds it for the XP pill.
 *
 * `variant="none"` draws no trigger: the caller opens it through `open` /
 * `onOpenChange` — the avatar menu's "Support" item does.
 */
export default function SupportSessionModal({
    dashboard,
    variant = "icon",
    open: openProp,
    onOpenChange,
}: {
    dashboard: StudentDashboard | undefined;
    variant?: "icon" | "row" | "none";
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [ownOpen, setOwnOpen] = useState(false);
    const open = openProp ?? ownOpen;
    const setOpen = onOpenChange ?? setOwnOpen;

    // A previous (recorded) course holds no support sessions, so it isn't offered here.
    const allEnrollments = dashboard?.enrollments ?? [];
    const enrollments = allEnrollments.filter((enrollment) => hasSupport(enrollment.course.phase));
    const hasEnrollments = enrollments.length > 0;
    const sessions = dashboard?.upcomingSupport ?? [];

    return (
        <>
            {variant === "icon" && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex h-9 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-surface hover:text-foreground"
                >
                    Support
                </button>
            )}
            {variant === "row" && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.9375rem] font-medium transition-colors hover:bg-surface"
                >
                    Support
                </button>
            )}

            <Modal
                open={open}
                onOpenChange={setOpen}
                size="sm"
                title="Support Session"
                description={hasEnrollments ? "Which course do you need help with?" : undefined}
            >
                <ModalBody className="min-h-40">
                    {allEnrollments.length > 0 && !hasEnrollments ? (
                        // Enrolled, but only on previous (recorded) courses, which hold no sessions.
                        <div className="py-6 text-center">
                            <Headphones className="mx-auto mb-3 size-9 text-muted-foreground" />
                            <p className="font-semibold">No support sessions on your courses</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Your courses are previous recorded courses — you learn from the recordings, and they don&apos;t hold support sessions.
                            </p>
                        </div>
                    ) : !hasEnrollments ? (
                        // No course, no course-scoped mentor to hold a session for —
                        // the honest next step is enrolling, not an empty schedule.
                        <div className="py-6 text-center">
                            <GraduationCap className="mx-auto mb-3 size-9 text-muted-foreground" />
                            <p className="font-semibold">Enrol in a course first</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                আগে একটা কোর্সে ভর্তি হয়ে নাও — তাহলে সাপোর্ট সেশনে
                                জয়েন করতে পারবে।
                            </p>
                            <Link
                                href="/courses"
                                className={cn(buttonVariants({ size: "sm" }), "mt-4")}
                            >
                                Browse courses
                            </Link>
                        </div>
                    ) : (
                        <>
                            <ul className="space-y-2">
                                {enrollments.map((enrollment) => {
                                    const session = sessions.find(
                                        (item) => item.course.id === enrollment.course.id,
                                    );

                                    return (
                                        <li key={enrollment.id}>
                                            <Link
                                                href={`/learn/${enrollment.course.slug}/support`}
                                                onClick={() => setOpen(false)}
                                                className="group flex items-center gap-3 rounded-md border border-border p-2.5 pr-3 transition-colors hover:border-primary/40 hover:bg-surface"
                                            >
                                                <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                                                    <SafeImage
                                                        src={enrollment.course.thumbnail}
                                                        alt=""
                                                        fill
                                                        sizes="64px"
                                                        className="object-cover"
                                                        fallback={
                                                            <BookOpen className="size-5 text-muted-foreground" />
                                                        }
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <p className="truncate text-sm font-medium">
                                                        {enrollment.course.title}
                                                    </p>
                                                    {session ? (
                                                        session.isLive ? (
                                                            <Badge variant="success" className="gap-1">
                                                                <Radio className="size-3" /> Live now
                                                            </Badge>
                                                        ) : (
                                                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <CalendarClock className="size-3 shrink-0" />
                                                                {formatDateTime(session.startTime)}
                                                            </p>
                                                        )
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">
                                                            No support session scheduled
                                                        </p>
                                                    )}
                                                </div>
                                                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </ModalBody>
            </Modal>
        </>
    );
}
