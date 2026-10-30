"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Download, Search } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import CourseRatings from "@/components/mentor/course/CourseRatings";
import { QuizAttemptModal, QuizQuestions } from "@/components/mentor/course/QuizBreakdown";
import { pad2, plural } from "@/components/mentor/dashboard/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { saveCsv } from "@/lib/download";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDate } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";
import type { SubmissionStatus } from "@/types/api.types";
import type { CourseResults, QuizResultsDetail } from "@/types/mentor.types";

type Assignment = CourseResults["assignments"][number];
type Quiz = CourseResults["quizzes"][number];
type QuizAttempt = QuizResultsDetail["attempts"][number];

const STATUS: Record<SubmissionStatus, { label: string; tone: string }> = {
    SUBMITTED: { label: "Waiting", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    UNDER_REVIEW: { label: "In review", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    ACCEPTED: { label: "Accepted", tone: "bg-primary/10 text-primary" },
    NEEDS_REVISION: { label: "Changes asked", tone: "bg-secondary text-secondary-foreground" },
    REJECTED: { label: "Rejected", tone: "bg-destructive/10 text-destructive" },
};

const matches = (name: string, term: string) => name.toLowerCase().includes(term.trim().toLowerCase());

/**
 * A course's marks: every assignment with its hand-ins and every quiz with
 * each student's best attempt. Students are names — never links, never more
 * (the API sends nothing else). Find one by name, open any hand-in on its
 * review form, or take the lot away as a CSV.
 */
export default function CourseResultsView({ courseId }: { courseId: string }) {
    const [term, setTerm] = useState("");
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["staff", "results", courseId],
        queryFn: () => curriculumAuthoring.getResults(courseId),
    });

    if (isLoading) {
        return (
            <div className="container-page space-y-6 py-8">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-24 rounded-card" />
                <Skeleton className="h-80 rounded-card" />
            </div>
        );
    }
    if (isError || !data) {
        return (
            <div className="container-page py-16 text-center">
                <p className="font-medium">Couldn&apos;t load the results.</p>
                <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "Try again in a moment.")}</p>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                    Try again
                </Button>
            </div>
        );
    }

    return <Results data={data} term={term} setTerm={setTerm} />;
}

function Results({ data, term, setTerm }: { data: CourseResults; term: string; setTerm: (value: string) => void }) {
    const searching = term.trim().length > 0;
    const handedIn = data.assignments.reduce((sum, assignment) => sum + assignment.handedIn, 0);
    const waiting = data.assignments.reduce((sum, assignment) => sum + assignment.counts.waiting, 0);
    const accepted = data.assignments.flatMap((assignment) => (assignment.averagePercent === null ? [] : [assignment.averagePercent]));
    const quizBest = data.quizzes.flatMap((quiz) => (quiz.averagePercent === null ? [] : [quiz.averagePercent]));
    const mean = (values: number[]) => (values.length ? `${Math.round(values.reduce((a, b) => a + b, 0) / values.length)}%` : "—");

    const assignments = searching
        ? data.assignments.filter((assignment) => assignment.submissions.some((row) => matches(row.student.name, term)))
        : data.assignments;
    const quizzes = searching ? data.quizzes.filter((quiz) => quiz.results.some((row) => matches(row.student.name, term))) : data.quizzes;

    return (
        <div className="container-page space-y-6 py-8">
            <header className="flex flex-wrap items-end justify-between gap-4 animate-in fade-in duration-500 motion-reduce:animate-none">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Results</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Marks for every assignment and quiz. Students appear by name, on their own work, and nowhere else.
                    </p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                            type="search"
                            value={term}
                            onChange={(event) => setTerm(event.target.value)}
                            placeholder="Find a student by name"
                            aria-label="Find a student by name"
                            className="pl-9"
                        />
                    </div>
                    <Button variant="brand-outline" onClick={() => downloadCsv(data)} disabled={handedIn === 0 && data.quizzes.every((quiz) => quiz.takers === 0)}>
                        <Download /> Marks (CSV)
                    </Button>
                </div>
            </header>

            <ul aria-label="Totals" className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card lg:grid-cols-4">
                <Total label="Hand-ins" value={handedIn} hint={`across ${plural(data.assignments.length, "assignment")} · ${data.learners} enrolled`} />
                <Total
                    label="Waiting for review"
                    value={waiting}
                    hint={waiting ? "Open the review queue" : "All marked"}
                    href={waiting ? `/mentor/reviews?course=${data.course.id}` : undefined}
                />
                <Total label="Average assignment mark" value={mean(accepted)} hint="Of accepted work" />
                <Total label="Average quiz score" value={mean(quizBest)} hint="Each student's best attempt" />
            </ul>

            <section aria-labelledby="assignments-title" className="space-y-3">
                <SectionTitle id="assignments-title" count={assignments.length} searching={searching}>
                    Assignments
                </SectionTitle>
                {assignments.length === 0 ? (
                    <Empty>
                        {searching
                            ? `No hand-ins from anyone called “${term.trim()}”.`
                            : "No assignments on this course yet — they're added in the Module Manager."}
                    </Empty>
                ) : (
                    <ol className="space-y-3">
                        {assignments.map((assignment) => (
                            <AssignmentRow
                                key={assignment.id}
                                assignment={assignment}
                                course={data.course}
                                learners={data.learners}
                                term={term}
                            />
                        ))}
                    </ol>
                )}
            </section>

            <section aria-labelledby="quizzes-title" className="space-y-3">
                <SectionTitle id="quizzes-title" count={quizzes.length} searching={searching}>
                    Quizzes
                </SectionTitle>
                {quizzes.length === 0 ? (
                    <Empty>
                        {searching ? `No quiz attempts from anyone called “${term.trim()}”.` : "No quizzes on this course yet."}
                    </Empty>
                ) : (
                    <ol className="space-y-3">
                        {quizzes.map((quiz) => (
                            <QuizRow key={quiz.id} quiz={quiz} course={data.course} term={term} />
                        ))}
                    </ol>
                )}
            </section>

            {!searching && <CourseRatings courseId={data.course.id} />}
        </div>
    );
}

function Total({ label, value, hint, href }: { label: string; value: ReactNode; hint: string; href?: string }) {
    const body = (
        <>
            <span className="block text-xs font-medium text-muted-foreground">{label}</span>
            <span className={cn("mt-1 block text-2xl font-bold tracking-tight tabular-nums sm:text-[1.75rem]", href && "text-primary")}>{value}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hint}</span>
        </>
    );
    return (
        <li className="min-w-0 bg-card">
            {href ? (
                <Link href={href} className="block h-full px-5 py-4 transition-colors hover:bg-secondary/40">
                    {body}
                </Link>
            ) : (
                <div className="px-5 py-4">{body}</div>
            )}
        </li>
    );
}

function SectionTitle({ id, count, searching, children }: { id: string; count: number; searching: boolean; children: ReactNode }) {
    return (
        <h3 id={id} className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
            {children}
            <span className="text-sm font-normal text-muted-foreground">
                {count}
                {searching && " with a match"}
            </span>
        </h3>
    );
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="rounded-card border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

/** One expandable row: a header that summarises, and the table it opens to. */
function Expandable({ summary, children, open, onToggle }: { summary: ReactNode; children: ReactNode; open: boolean; onToggle: () => void }) {
    return (
        <li className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40 sm:px-6"
            >
                <span className="min-w-0 flex-1">{summary}</span>
                <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
            </button>
            {/* Grid rows slide it open without measuring heights. */}
            <div className={cn("grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="min-h-0 overflow-hidden">{open && <div className="border-t border-border">{children}</div>}</div>
            </div>
        </li>
    );
}

function AssignmentRow({
    assignment,
    course,
    learners,
    term,
}: {
    assignment: Assignment;
    course: CourseResults["course"];
    learners: number;
    term: string;
}) {
    const [opened, setOpened] = useState(false);
    const open = opened || term.trim().length > 0;
    const rows = term.trim() ? assignment.submissions.filter((row) => matches(row.student.name, term)) : assignment.submissions;
    const { counts } = assignment;
    const share = learners > 0 ? Math.min(100, (assignment.handedIn / learners) * 100) : 0;
    const queue = `course=${course.id}&assignment=${assignment.id}`;

    return (
        <Expandable
            open={open}
            onToggle={() => setOpened((value) => !value)}
            summary={
                <span className="grid items-center gap-x-6 gap-y-2 md:grid-cols-[minmax(0,1fr)_12rem_5rem]">
                    <span className="min-w-0">
                        <span className="block text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                            {course.milestoneLabel} {pad2(assignment.milestone.order)}
                            {!assignment.isPublished && <span className="ml-2 normal-case tracking-normal">· not out yet</span>}
                        </span>
                        <span className="mt-0.5 block truncate font-semibold">{assignment.title}</span>
                        <span className="block text-xs text-muted-foreground">
                            Out of {assignment.totalMarks}
                            {assignment.deadline && ` · due ${formatDate(assignment.deadline)}`}
                        </span>
                    </span>
                    <span className="min-w-0">
                        <span className="flex items-baseline justify-between text-xs text-muted-foreground">
                            <span>
                                <span className="font-semibold tabular-nums text-foreground">{assignment.handedIn}</span> of {learners} handed in
                            </span>
                        </span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                            <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            <span>{counts.accepted} accepted</span>
                            {counts.waiting > 0 && <span className="font-medium text-amber-700 dark:text-amber-400">{counts.waiting} waiting</span>}
                            {counts.returned > 0 && <span>{counts.returned} returned</span>}
                            {counts.rejected > 0 && <span>{counts.rejected} rejected</span>}
                        </span>
                    </span>
                    <span className="text-left md:text-right">
                        <span className="block text-xl font-bold tabular-nums">{assignment.averagePercent === null ? "—" : `${assignment.averagePercent}%`}</span>
                        <span className="block text-[0.6875rem] text-muted-foreground">average</span>
                    </span>
                </span>
            }
        >
            {counts.waiting > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-500/5 px-5 py-3 sm:px-6">
                    <p className="text-sm">
                        <span className="font-semibold">{plural(counts.waiting, "hand-in")}</span> waiting for your review.
                    </p>
                    <Button asChild size="sm">
                        <Link href={`/mentor/reviews?${queue}`}>
                            Mark them <ArrowRight />
                        </Link>
                    </Button>
                </div>
            )}
            {rows.length === 0 ? (
                <p className="px-6 py-6 text-sm text-muted-foreground">Nothing handed in yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                <th scope="col" className="px-5 py-2 font-medium sm:px-6">Student</th>
                                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                                <th scope="col" className="px-3 py-2 text-right font-medium">Mark</th>
                                <th scope="col" className="px-3 py-2 font-medium">Handed in</th>
                                <th scope="col" className="px-5 py-2 sm:px-6"><span className="sr-only">Open</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((row) => {
                                const status = STATUS[row.status];
                                const pending = row.status === "SUBMITTED" || row.status === "UNDER_REVIEW";
                                return (
                                    <tr key={row.id} className="hover:bg-secondary/30">
                                        {/* A name, deliberately not a link: there's no profile for a mentor to open. */}
                                        <td className="px-5 py-2.5 font-medium sm:px-6">{row.student.name}</td>
                                        <td className="px-3 py-2.5">
                                            <span className={cn("rounded-sm px-2 py-0.5 text-xs font-medium", status.tone)}>{status.label}</span>
                                            {row.maxScore !== null && (
                                                <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-400" title={`Late — marked out of ${row.maxScore}`}>
                                                    Late
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">
                                            {row.score === null ? (
                                                <span className="text-muted-foreground">—</span>
                                            ) : (
                                                <>
                                                    <span className="font-semibold">{row.score}</span>
                                                    <span className="text-muted-foreground"> / {assignment.totalMarks}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.submittedAt)}</td>
                                        <td className="px-5 py-2.5 text-right sm:px-6">
                                            <Link
                                                href={`/mentor/reviews?status=${row.status}&focus=${row.id}&${queue}`}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                            >
                                                {pending ? "Review" : "Open"} <ArrowRight className="size-3.5" aria-hidden />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Expandable>
    );
}

function QuizRow({ quiz, course, term }: { quiz: Quiz; course: CourseResults["course"]; term: string }) {
    const [opened, setOpened] = useState(false);
    const [view, setView] = useState<"students" | "questions">("students");
    const [reviewing, setReviewing] = useState<{ attemptId: string; name: string } | null>(null);
    const searching = term.trim().length > 0;
    const open = opened || searching;
    const rows = searching ? quiz.results.filter((row) => matches(row.student.name, term)) : quiz.results;
    // The attempts and per-question counts come only once someone opens the row.
    const detail = useQuery({
        queryKey: ["staff", "quiz-results", quiz.id],
        queryFn: () => curriculumAuthoring.getQuizResults(quiz.id),
        enabled: open && rows.length > 0,
    });
    // A student's best attempt (newest first, so the latest wins a tie) — the one their row reports.
    const bestAttemptOf = (studentId: string) =>
        detail.data?.attempts
            .filter((attempt) => attempt.student.id === studentId)
            .reduce<QuizAttempt | null>((best, attempt) => (!best || attempt.percentage > best.percentage ? attempt : best), null) ?? null;
    const shown = searching ? "students" : view;

    return (
        <Expandable
            open={open}
            onToggle={() => setOpened((value) => !value)}
            summary={
                <span className="grid items-center gap-x-6 gap-y-2 md:grid-cols-[minmax(0,1fr)_12rem_5rem]">
                    <span className="min-w-0">
                        <span className="block text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                            {course.milestoneLabel} {pad2(quiz.module.milestone.order)} · {course.moduleLabel} {pad2(quiz.module.order)}
                            {!quiz.isPublished && <span className="ml-2 normal-case tracking-normal">· not out yet</span>}
                        </span>
                        <span className="mt-0.5 block truncate font-semibold">{quiz.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                            {plural(quiz._count.questions, "question")} · {quiz.module.title}
                        </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                        <span className="font-semibold tabular-nums text-foreground">{quiz.takers}</span> {quiz.takers === 1 ? "student" : "students"} ·{" "}
                        {plural(quiz.attempts, "attempt")}
                    </span>
                    <span className="text-left md:text-right">
                        <span className="block text-xl font-bold tabular-nums">{quiz.averagePercent === null ? "—" : `${quiz.averagePercent}%`}</span>
                        <span className="block text-[0.6875rem] text-muted-foreground">average best</span>
                    </span>
                </span>
            }
        >
            {rows.length === 0 ? (
                <p className="px-6 py-6 text-sm text-muted-foreground">Nobody has finished it yet.</p>
            ) : (
                <>
                    {!searching && (
                        <div role="tablist" aria-label="Show" className="flex gap-1 border-b border-border px-5 pt-2 sm:px-6">
                            {(
                                [
                                    ["students", "Students"],
                                    ["questions", "By question"],
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={shown === key}
                                    onClick={() => setView(key)}
                                    className={cn(
                                        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                                        shown === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                    {shown === "questions" ? (
                        detail.isLoading ? (
                            <div className="space-y-3 px-5 py-4 sm:px-6">
                                <Skeleton className="h-20 rounded-card" />
                                <Skeleton className="h-20 rounded-card" />
                            </div>
                        ) : detail.data ? (
                            <QuizQuestions detail={detail.data} />
                        ) : (
                            <div className="px-6 py-6 text-sm text-muted-foreground">
                                {getApiErrorMessage(detail.error, "Couldn't load the questions.")}{" "}
                                <button type="button" onClick={() => detail.refetch()} className="font-medium text-primary hover:underline">
                                    Try again
                                </button>
                            </div>
                        )
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[34rem] text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                        <th scope="col" className="px-5 py-2 font-medium sm:px-6">Student</th>
                                        <th scope="col" className="px-3 py-2 font-medium">Best score</th>
                                        <th scope="col" className="px-3 py-2 text-right font-medium">Attempts</th>
                                        <th scope="col" className="px-3 py-2 font-medium">Last taken</th>
                                        <th scope="col" className="px-5 py-2 sm:px-6"><span className="sr-only">Answers</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {rows.map((row) => {
                                        const best = bestAttemptOf(row.student.id);
                                        return (
                                            <tr key={row.student.id} className="hover:bg-secondary/30">
                                                <td className="px-5 py-2.5 font-medium sm:px-6">{row.student.name}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="flex items-center gap-2">
                                                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary" aria-hidden>
                                                            <span className="block h-full rounded-full bg-brand" style={{ width: `${row.bestPercent}%` }} />
                                                        </span>
                                                        <span className="font-semibold tabular-nums">{row.bestPercent}%</span>
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right tabular-nums">{row.attempts}</td>
                                                <td className="px-3 py-2.5 text-muted-foreground">{row.lastAt ? formatDate(row.lastAt) : "—"}</td>
                                                <td className="px-5 py-2.5 text-right sm:px-6">
                                                    <button
                                                        type="button"
                                                        disabled={!best}
                                                        onClick={() => best && setReviewing({ attemptId: best.id, name: row.student.name })}
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
                                                    >
                                                        Answers <ArrowRight className="size-3.5" aria-hidden />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
            <QuizAttemptModal attemptId={reviewing?.attemptId ?? null} studentName={reviewing?.name ?? ""} onClose={() => setReviewing(null)} />
        </Expandable>
    );
}

/** One row per student who has a mark, one column per assignment and quiz — names only, as on screen. */
function downloadCsv(data: CourseResults) {
    const students = new Map<string, string>();
    for (const assignment of data.assignments) for (const row of assignment.submissions) students.set(row.student.id, row.student.name);
    for (const quiz of data.quizzes) for (const row of quiz.results) students.set(row.student.id, row.student.name);

    const header = [
        "Student",
        ...data.assignments.map((assignment) => `${assignment.title} (/${assignment.totalMarks})`),
        ...data.quizzes.map((quiz) => `${quiz.title} (best %)`),
    ];
    const rows = [...students.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name]) => [
            name,
            ...data.assignments.map((assignment) => {
                const row = assignment.submissions.find((entry) => entry.student.id === id);
                if (!row) return "";
                return row.score !== null ? row.score : STATUS[row.status].label;
            }),
            ...data.quizzes.map((quiz) => quiz.results.find((entry) => entry.student.id === id)?.bestPercent ?? ""),
        ]);

    saveCsv(`${data.course.slug}-marks.csv`, [header, ...rows]);
}

