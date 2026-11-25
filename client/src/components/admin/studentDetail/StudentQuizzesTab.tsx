"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ListChecks } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { StudentCourseQuizzes } from "@/types/admin.types";
import { CoursePicker } from "./CoursePicker";
import { percentLabel, percentTone, weekLabel } from "./format";
import { QuizAttemptReview } from "./QuizAttemptReview";

type Quiz = StudentCourseQuizzes["quizzes"][number];
type Show = "all" | "taken" | "waiting" | "low";

const SHOW: { id: Show; label: string; test: (quiz: Quiz) => boolean }[] = [
    { id: "all", label: "All", test: () => true },
    { id: "taken", label: "Taken", test: (quiz) => quiz.bestPercent !== null },
    { id: "waiting", label: "Not taken", test: (quiz) => quiz.bestPercent === null },
    { id: "low", label: "Under half marks", test: (quiz) => quiz.bestPercent !== null && quiz.bestPercent < 50 },
];

/** Bar colour for a score: strong, middling, weak — the same cut-offs as `percentTone`. */
const barTone = (percent: number) => (percent >= 80 ? "bg-success" : percent >= 50 ? "bg-brand" : "bg-destructive");

/**
 * Every quiz, course by course, in the order the student meets them — week by
 * week. Each shows the best score and when; a click opens their answers,
 * question by question. Quizzes not taken yet are listed too, so what's
 * missing shows.
 */
export function StudentQuizzesTab({ studentId, courseId, onCourse }: { studentId: string; courseId: string; onCourse: (id: string) => void }) {
    const [show, setShow] = useState<Show>("all");
    const [review, setReview] = useState<{ attemptId: string; title: string } | null>(null);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["admin", "student", studentId, "quizzes"],
        queryFn: () => adminService.studentQuizzes(studentId),
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-20 rounded-card" />
                <Skeleton className="h-80 rounded-card" />
            </div>
        );
    }
    if (isError || !data) {
        return (
            <p className="rounded-card border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                {getApiErrorMessage(error, "Couldn't load their quizzes.")}
            </p>
        );
    }
    if (data.length === 0) {
        return (
            <div className="rounded-card border border-dashed border-border p-10 text-center">
                <ListChecks className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-medium">Not on any course yet.</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Each course&apos;s quizzes show up here once they&apos;re enrolled.</p>
            </div>
        );
    }

    // The course asked for, else the one they've been quizzing in, else the first.
    const course = data.find((row) => row.course.id === courseId) ?? data.find((row) => row.quizzes.some((quiz) => quiz.attempts.length > 0)) ?? data[0];
    const rows = course.quizzes.filter(SHOW.find((option) => option.id === show)!.test);

    // Consecutive quizzes in the same week share a heading.
    const weeks: { key: string; label: string; title: string | null; quizzes: Quiz[] }[] = [];
    for (const quiz of rows) {
        const key = quiz.week ? String(quiz.week.order) : "none";
        const last = weeks[weeks.length - 1];
        if (last?.key === key) last.quizzes.push(quiz);
        else
            weeks.push({
                key,
                label: quiz.week ? weekLabel(course.course.milestoneLabel, quiz.week.order) : "Unplaced",
                title: quiz.week?.title ?? null,
                quizzes: [quiz],
            });
    }

    return (
        <div className="space-y-5">
            <CoursePicker
                items={data.map((row) => ({
                    id: row.course.id,
                    title: row.course.title,
                    thumbnail: row.course.thumbnail,
                    progress: row.progress,
                    hint: row.stats.taken
                        ? `${row.stats.taken} of ${row.stats.total} quizzes · ${percentLabel(row.stats.averagePercent)} average`
                        : `${row.stats.total} ${row.stats.total === 1 ? "quiz" : "quizzes"} · none taken yet`,
                }))}
                value={course.course.id}
                onChange={onCourse}
            />

            <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                <header className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <p className="font-mono text-xs text-syn-comment">{"// "}Quizzes in this course</p>
                        <h2 className="mt-1 text-lg font-semibold leading-snug">{course.course.title}</h2>
                    </div>
                    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4 lg:w-auto">
                        <Figure label="Taken" value={`${course.stats.taken} / ${course.stats.total}`} />
                        <Figure label="Average" value={percentLabel(course.stats.averagePercent)} tone={percentTone(course.stats.averagePercent)} />
                        <Figure label="Full marks" value={course.stats.fullMarks} />
                        <Figure label="Under half" value={course.stats.low} tone={course.stats.low ? "text-destructive" : undefined} />
                    </dl>
                </header>

                <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5 border-b border-border bg-surface px-5 py-3">
                    {SHOW.map((option) => {
                        const count = course.quizzes.filter(option.test).length;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                aria-pressed={show === option.id}
                                onClick={() => setShow(option.id)}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    show === option.id
                                        ? "border-primary bg-primary/10 text-primary-ink"
                                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {option.label}
                                <span className="font-mono tabular-nums opacity-80">{count}</span>
                            </button>
                        );
                    })}
                </div>

                {course.quizzes.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">This course has no quizzes out yet.</p>
                ) : rows.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Nothing here.</p>
                ) : (
                    <div className="divide-y divide-border">
                        {weeks.map((week) => (
                            <section key={week.key}>
                                <h3 className="flex items-baseline gap-2 bg-secondary/30 px-5 py-2 text-xs">
                                    <span className="font-mono font-semibold uppercase tracking-wider text-primary">{week.label}</span>
                                    {week.title && <span className="truncate text-muted-foreground">{week.title}</span>}
                                </h3>
                                <ul className="divide-y divide-border">
                                    {week.quizzes.map((quiz) => (
                                        <li key={quiz.id}>
                                            <QuizRow
                                                quiz={quiz}
                                                moduleLabel={course.course.moduleLabel}
                                                onOpen={(attemptId) => setReview({ attemptId, title: quiz.title })}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </section>

            <QuizAttemptReview attemptId={review?.attemptId ?? null} title={review?.title} onClose={() => setReview(null)} />
        </div>
    );
}

function QuizRow({ quiz, moduleLabel, onOpen }: { quiz: Quiz; moduleLabel: string; onOpen: (attemptId: string) => void }) {
    const finished = quiz.attempts.filter((attempt) => attempt.status === "COMPLETED");
    // The best attempt opens; any other attempts sit beside it.
    const best = [...finished].sort((a, b) => b.percentage - a.percentage)[0] ?? quiz.attempts[quiz.attempts.length - 1];
    const where = quiz.module ? `${moduleLabel} ${quiz.module.order} · ${quiz.module.title}` : quiz.assignment ? `Assignment · ${quiz.assignment.title}` : null;

    const content = (
        <>
            <span
                className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-md font-mono text-xs font-bold tabular-nums",
                    quiz.bestPercent === null
                        ? "border border-dashed border-border text-muted-foreground"
                        : quiz.bestPercent >= 80
                          ? "bg-success/15 text-success-ink"
                          : quiz.bestPercent >= 50
                            ? "bg-primary/10 text-primary-ink"
                            : "bg-destructive/15 text-destructive-ink",
                )}
                aria-hidden
            >
                {quiz.bestPercent === null ? "—" : quiz.bestPercent}
            </span>

            <div className="min-w-0 flex-1 basis-56">
                <p className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", best && "group-hover:underline")}>
                    <span className="min-w-0 wrap-break-word">{quiz.title}</span>
                    {!quiz.live && <Badge variant="secondary">Hidden now</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    {[where, `${quiz.questions} ${quiz.questions === 1 ? "question" : "questions"}`].filter(Boolean).join(" · ")}
                </p>
            </div>

            <div className="flex w-full items-center gap-4 pl-12 sm:w-auto sm:pl-0">
                {best ? (
                    <>
                        <div className="w-36 space-y-1">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                                <span className={cn("text-sm font-semibold tabular-nums", percentTone(best.status === "COMPLETED" ? best.percentage : null))}>
                                    {best.status === "COMPLETED" ? `${best.percentage}%` : "Unfinished"}
                                </span>
                                {best.status === "COMPLETED" && (
                                    <span className="tabular-nums text-muted-foreground">
                                        {best.correctCount}/{best.totalQuestions} right
                                    </span>
                                )}
                            </div>
                            <Progress
                                value={best.status === "COMPLETED" ? best.percentage : 0}
                                className="h-1.5"
                                barClassName={barTone(best.status === "COMPLETED" ? best.percentage : 0)}
                            />
                        </div>
                        <p className="hidden w-36 text-xs text-muted-foreground md:block">
                            {formatDateTime(best.completedAt ?? best.startedAt)}
                            {quiz.attempts.length > 1 && <span className="block">{quiz.attempts.length} attempts</span>}
                        </p>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">Not taken yet</p>
                )}
            </div>
        </>
    );

    if (!best) return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">{content}</div>;
    return (
        <button
            type="button"
            onClick={() => onOpen(best.id)}
            title="See their answers"
            className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
            {content}
        </button>
    );
}

function Figure({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
    return (
        <div className="min-w-24 bg-card px-3.5 py-2.5">
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className={cn("mt-0.5 text-lg font-bold tabular-nums", tone)}>{value}</dd>
        </div>
    );
}
