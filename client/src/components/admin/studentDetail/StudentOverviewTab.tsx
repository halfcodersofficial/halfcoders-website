"use client";

import { formatDistanceToNow } from "date-fns";
import {
    Award,
    BookmarkCheck,
    BookOpen,
    ClipboardCheck,
    ClipboardList,
    CreditCard,
    Dumbbell,
    Headphones,
    ListChecks,
    NotebookPen,
    ThumbsDown,
    ThumbsUp,
    UserPlus,
    type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { TREND_COLORS, TrendChart } from "@/components/admin/TrendChart";
import { SafeImage } from "@/components/ui/safe-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatBDT } from "@/lib/utils";
import type { StudentEnrollment, StudentOverview } from "@/types/admin.types";
import { percentLabel, percentTone, weekLabel, XP_SOURCE_LABEL } from "./format";

const LEARNING_SERIES = [
    { key: "lessons" as const, label: "Lessons completed", ...TREND_COLORS[0] },
    { key: "submissions" as const, label: "Assignments submitted", ...TREND_COLORS[1] },
    { key: "checks" as const, label: "Quizzes & practice days", ...TREND_COLORS[2] },
];

const FEED: Record<StudentOverview["feed"][number]["kind"], { icon: LucideIcon; verb: string }> = {
    lesson: { icon: BookOpen, verb: "Completed lesson" },
    submission: { icon: ClipboardList, verb: "Submitted" },
    review: { icon: ClipboardCheck, verb: "Got marks on" },
    quiz: { icon: ListChecks, verb: "Took quiz" },
    practice: { icon: Dumbbell, verb: "Finished practice day" },
    support: { icon: Headphones, verb: "Joined support" },
    enrolled: { icon: UserPlus, verb: "Enrolled in" },
    certificate: { icon: Award, verb: "Earned a certificate for" },
    payment: { icon: CreditCard, verb: "Paid for" },
};

/**
 * The student at a glance: each course with how far they've got, what they
 * did over the last month, their latest activity, and where their XP came
 * from.
 */
export function StudentOverviewTab({
    data,
    onOpenCourse,
}: {
    data: StudentOverview;
    onOpenCourse: (courseId: string) => void;
}) {
    const trend = data.trend.map((day) => ({
        date: day.date,
        lessons: day.lessons,
        submissions: day.submissions,
        checks: day.quizzes + day.practice,
    }));

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="min-w-0 space-y-6 xl:col-span-2">
                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle>Courses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.enrollments.length === 0 ? (
                            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                Not enrolled in any course yet.
                            </p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {data.enrollments.map((enrollment) => (
                                    <li key={enrollment.id} className="py-5 first:pt-0 last:pb-0">
                                        <CourseRow enrollment={enrollment} onOpen={() => onOpenCourse(enrollment.courseId)} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle>Last 30 days</CardTitle>
                        <p className="text-sm text-muted-foreground">Lessons completed, work handed in, and quizzes and practice days done, day by day.</p>
                    </CardHeader>
                    <CardContent>
                        <TrendChart trend={trend} series={LEARNING_SERIES} emptyMessage="No learning activity in the last 30 days." />
                    </CardContent>
                </Card>
            </div>

            <div className="min-w-0 space-y-6">
                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle>Recent activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.feed.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nothing yet.</p>
                        ) : (
                            <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-3.5 before:w-px before:bg-border">
                                {data.feed.slice(0, 15).map((entry) => {
                                    const { icon: Icon, verb } = FEED[entry.kind];
                                    return (
                                        <li key={entry.id} className="relative flex gap-3">
                                            <span className="relative grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card text-primary">
                                                <Icon className="size-3.5" aria-hidden />
                                            </span>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <p className="text-sm leading-snug">
                                                    <span className="text-muted-foreground">{verb} </span>
                                                    <span className="font-medium wrap-break-word">{entry.title}</span>
                                                    {entry.detail && entry.kind !== "support" && (
                                                        <span className="font-semibold tabular-nums"> · {entry.detail}</span>
                                                    )}
                                                    {entry.amount !== undefined && (
                                                        <span className="font-semibold tabular-nums"> · {formatBDT(entry.amount)}</span>
                                                    )}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
                                                    {entry.by && entry.kind === "review" && ` · by ${entry.by.name}`}
                                                    {entry.by && entry.kind === "support" && ` · with ${entry.by.name}`}
                                                    {entry.course && entry.kind !== "enrolled" && entry.kind !== "certificate" && entry.kind !== "payment" && (
                                                        <> · {entry.course.title}</>
                                                    )}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-card">
                    <CardHeader className="flex-row items-baseline justify-between gap-3">
                        <CardTitle>XP</CardTitle>
                        <p className="text-2xl font-bold tabular-nums">{data.xp.total.toLocaleString()}</p>
                    </CardHeader>
                    <CardContent>
                        {data.xp.bySource.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No XP earned yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {data.xp.bySource.map((row) => (
                                    <li key={row.source} className="space-y-1">
                                        <div className="flex items-baseline justify-between gap-3 text-sm">
                                            <span className="truncate">{XP_SOURCE_LABEL[row.source] ?? row.source}</span>
                                            <span className="shrink-0 font-semibold tabular-nums">{row.points.toLocaleString()}</span>
                                        </div>
                                        <Progress
                                            value={data.xp.total ? (row.points / data.xp.total) * 100 : 0}
                                            className="h-1"
                                            barClassName="bg-brand"
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle>In the lessons</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-2 gap-3">
                            <Tally icon={NotebookPen} label="Notes written" value={data.engagement.notes} />
                            <Tally icon={BookmarkCheck} label="Bookmarked" value={data.engagement.bookmarks} />
                            <Tally icon={ThumbsUp} label="Liked" value={data.engagement.likes} />
                            <Tally icon={ThumbsDown} label="Disliked" value={data.engagement.dislikes} />
                        </dl>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function CourseRow({ enrollment, onOpen }: { enrollment: StudentEnrollment; onOpen: () => void }) {
    const { course } = enrollment;
    const where = [
        enrollment.currentMilestone && weekLabel(course.milestoneLabel, enrollment.currentMilestone.order),
        enrollment.currentModule?.title,
    ].filter(Boolean).join(" · ");

    return (
        <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative grid aspect-video w-full shrink-0 place-items-center self-start overflow-hidden rounded-md bg-secondary sm:w-36">
                <SafeImage
                    src={course.thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 144px"
                    className="object-cover"
                    fallback={<BookOpen className="size-6 text-muted-foreground" />}
                />
            </div>

            <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-start gap-2">
                    <p className="min-w-0 flex-1 font-semibold leading-snug">{course.title}</p>
                    <StatusPill kind="enrollment" value={enrollment.status} />
                </div>

                <div className="flex items-center gap-3">
                    <Progress value={enrollment.progress} className="h-2" barClassName="bg-brand" />
                    <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{enrollment.progress}%</span>
                </div>

                <p className="text-xs text-muted-foreground">
                    {enrollment.status === "COMPLETED"
                        ? "Finished the course"
                        : where
                            ? <>Now on <span className="text-foreground">{where}</span></>
                            : "Hasn't started yet"}
                    {enrollment.lastActivityAt &&
                        ` · active ${formatDistanceToNow(new Date(enrollment.lastActivityAt), { addSuffix: true })}`}
                </p>

                <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                    <Figure label="Lessons">{enrollment.lessons.completed}/{enrollment.lessons.total}</Figure>
                    <Figure label="Assignments">
                        {enrollment.assignments.submitted}/{enrollment.assignments.total}
                        {enrollment.assignments.averagePercent !== null && (
                            <span className={cn("ml-1", percentTone(enrollment.assignments.averagePercent))}>
                                ({percentLabel(enrollment.assignments.averagePercent)})
                            </span>
                        )}
                        {enrollment.assignments.missed > 0 && (
                            <span className="ml-1 text-destructive">· {enrollment.assignments.missed} missed</span>
                        )}
                    </Figure>
                    <Figure label="Quizzes">
                        {enrollment.quizzes.taken}/{enrollment.quizzes.total}
                        {enrollment.quizzes.averagePercent !== null && (
                            <span className={cn("ml-1", percentTone(enrollment.quizzes.averagePercent))}>
                                ({percentLabel(enrollment.quizzes.averagePercent)})
                            </span>
                        )}
                    </Figure>
                    <Figure label="Practice">{enrollment.practice.completed}/{enrollment.practice.total}</Figure>
                    <Figure label="XP">{enrollment.xp.toLocaleString()}</Figure>
                </dl>
            </div>

            <Button variant="brand-outline" size="sm" className="self-start" onClick={onOpen}>
                Week by week
            </Button>
        </div>
    );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{children}</dd>
        </div>
    );
}

function Tally({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
    return (
        <div className="flex items-center gap-2.5 rounded-md bg-secondary/40 px-3 py-2.5">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
                <dd className="font-semibold leading-none tabular-nums">{value}</dd>
                <dt className="mt-1 truncate text-xs text-muted-foreground">{label}</dt>
            </div>
        </div>
    );
}
