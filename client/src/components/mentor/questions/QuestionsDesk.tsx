"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessagesSquare, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QaName } from "@/components/learn/LessonQuestions";
import { elapsed, pad2 } from "@/components/mentor/dashboard/time";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { dashboardService, lessonQaService } from "@/services";
import type { InboxQuestion } from "@/types/domain.types";

const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out fill-mode-both motion-reduce:animate-none";
const TABS = [
    { value: "open", label: "Waiting" },
    { value: "resolved", label: "Answered" },
    { value: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/**
 * Students' questions on lessons, across the courses this mentor teaches:
 * the ones still waiting first, oldest first — each with where it was asked
 * and the thread so far. Answer in place (the student is told, and emailed),
 * and mark it answered when it's settled. Students appear by name only.
 */
export default function QuestionsDesk() {
    const params = useSearchParams();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("open");
    const [courseId, setCourseId] = useState(params.get("course") ?? "");
    const focus = params.get("focus");
    const dashboard = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });

    const list = useInfiniteQuery({
        queryKey: ["lesson-questions", "inbox", tab, courseId],
        queryFn: ({ pageParam }) => lessonQaService.inbox({ status: tab, courseId: courseId || undefined, page: pageParam, limit: 20 }),
        initialPageParam: 1,
        getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    });
    const questions = list.data?.pages.flatMap((page) => page.data) ?? [];
    const waiting = list.data?.pages[0]?.meta?.open ?? 0;

    // A notification opens on its question: show everything so it's on the list, then bring it into view.
    useEffect(() => {
        if (focus) setTab("all");
    }, [focus]);
    useEffect(() => {
        if (focus && list.data) document.getElementById(`question-${focus}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [focus, list.data]);

    return (
        <div className="container-page space-y-6 py-8 sm:py-10">
            <header className={cn("flex flex-wrap items-end justify-between gap-4", RISE)}>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold sm:text-3xl">Student questions</h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                        What students asked on your courses&apos; lessons. Your answers carry a Mentor mark, and the student is told.
                    </p>
                </div>
                {(dashboard.data?.courses.length ?? 0) > 1 && (
                    <div className="w-full sm:w-64">
                        <Select
                            value={courseId}
                            onChange={(event) => {
                                setCourseId(event.target.value);
                                router.replace("/mentor/questions", { scroll: false });
                            }}
                            aria-label="Course"
                        >
                            <option value="">All my courses</option>
                            {dashboard.data?.courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                    {course.title}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}
            </header>

            <div role="tablist" aria-label="Show" className={cn("flex gap-1 border-b border-border", RISE)} style={{ animationDelay: "60ms" }}>
                {TABS.map((entry) => (
                    <button
                        key={entry.value}
                        type="button"
                        role="tab"
                        aria-selected={tab === entry.value}
                        onClick={() => setTab(entry.value)}
                        className={cn(
                            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                            tab === entry.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {entry.label}
                        {entry.value === "open" && waiting > 0 && <span className="ml-1.5 tabular-nums text-muted-foreground">{waiting}</span>}
                    </button>
                ))}
            </div>

            {list.isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-40 rounded-2xl" />
                    <Skeleton className="h-40 rounded-2xl" />
                </div>
            ) : list.isError ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="font-medium">Couldn&apos;t load the questions.</p>
                    <Button variant="outline" className="mt-4" onClick={() => list.refetch()}>
                        Try again
                    </Button>
                </div>
            ) : questions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
                    <span className="mx-auto grid size-11 place-items-center rounded-full bg-success/10 text-success">
                        <MessagesSquare className="size-5" aria-hidden />
                    </span>
                    <p className="mt-3 font-medium">{tab === "open" ? "Nothing waiting" : "Nothing here yet"}</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        {tab === "open" ? "When a student asks on a lesson, it lands here — and you get a notification." : "Questions show up here once students ask them."}
                    </p>
                </div>
            ) : (
                <>
                    <ol className="space-y-4">
                        {questions.map((question, index) => (
                            <QuestionCard key={question.id} question={question} highlighted={focus === question.id} delay={Math.min(index, 6) * 50} />
                        ))}
                    </ol>
                    {list.hasNextPage && (
                        <Button variant="ghost" className="w-full" onClick={() => list.fetchNextPage()} isLoading={list.isFetchingNextPage}>
                            Show more
                        </Button>
                    )}
                </>
            )}
        </div>
    );
}

function QuestionCard({ question, highlighted, delay }: { question: InboxQuestion; highlighted: boolean; delay: number }) {
    const queryClient = useQueryClient();
    const now = useNow(60_000);
    const [reply, setReply] = useState("");
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["lesson-questions"] });

    const answer = useMutation({
        mutationFn: async (andResolve: boolean) => {
            await lessonQaService.answer(question.id, reply.trim());
            if (andResolve) await lessonQaService.setResolved(question.id, true);
        },
        onSuccess: (_, andResolve) => {
            setReply("");
            toast.success(andResolve ? "Answered and closed — the student has been told." : "Answered — the student has been told.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't post your answer.")),
    });
    const resolve = useMutation({
        mutationFn: (isResolved: boolean) => lessonQaService.setResolved(question.id, isResolved),
        onSuccess: () => refresh(),
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update it.")),
    });

    const wait = elapsed(question.createdAt, now);
    const { course, video } = question;

    return (
        <li
            id={`question-${question.id}`}
            style={{ animationDelay: `${delay + 100}ms` }}
            className={cn(
                RISE,
                "scroll-mt-24 overflow-hidden rounded-2xl border bg-card shadow-sm",
                highlighted ? "border-primary ring-2 ring-primary/20" : "border-border",
            )}
        >
            <p className="flex flex-wrap items-center gap-x-2 border-b border-border bg-secondary/30 px-5 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                <span className="truncate">{course.title}</span>
                <span aria-hidden>·</span>
                <span>
                    {course.milestoneLabel} {pad2(video.module.milestone.order)} · {course.moduleLabel} {pad2(video.module.order)}
                </span>
                <span aria-hidden>·</span>
                <span className="truncate normal-case tracking-normal">{video.title}</span>
            </p>
            <div className="px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                    <Avatar name={question.author.name} size={34} />
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <QaName person={question.author} />
                            <span>{formatDateTime(question.createdAt)}</span>
                            {question.isResolved ? (
                                <span className="inline-flex items-center gap-1 font-medium text-success">
                                    <CheckCircle2 className="size-3.5" aria-hidden /> Answered
                                </span>
                            ) : (
                                <span className={cn(wait.days >= 1 && "font-semibold text-amber-700 dark:text-amber-400")}>waiting {wait.text}</span>
                            )}
                        </p>
                        <p className="mt-1 whitespace-pre-line leading-relaxed">{question.body}</p>
                    </div>
                </div>

                {question.answers.length > 0 && (
                    <ul className="ml-[2.875rem] mt-4 space-y-3 border-l-2 border-border pl-4">
                        {question.answers.map((entry) => (
                            <li key={entry.id}>
                                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                    <QaName person={entry.author} />
                                    <span>{formatDateTime(entry.createdAt)}</span>
                                </p>
                                <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed">{entry.body}</p>
                            </li>
                        ))}
                    </ul>
                )}

                {question.isResolved ? (
                    <div className="ml-[2.875rem] mt-3">
                        <button
                            type="button"
                            onClick={() => resolve.mutate(false)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                            <RotateCcw className="size-3.5" aria-hidden /> Reopen
                        </button>
                    </div>
                ) : (
                    <form
                        className="ml-[2.875rem] mt-4 space-y-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (reply.trim().length >= 3) answer.mutate(true);
                        }}
                    >
                        <Textarea
                            value={reply}
                            onChange={(event) => setReply(event.target.value)}
                            rows={3}
                            maxLength={3000}
                            placeholder="Your answer…"
                            aria-label={`Answer ${question.author.name}`}
                        />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={() => resolve.mutate(true)} isLoading={resolve.isPending}>
                                Close without answering
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="brand-outline"
                                disabled={reply.trim().length < 3}
                                isLoading={answer.isPending && answer.variables === false}
                                onClick={() => answer.mutate(false)}
                            >
                                Answer, keep open
                            </Button>
                            <Button type="submit" size="sm" disabled={reply.trim().length < 3} isLoading={answer.isPending && answer.variables === true}>
                                Answer and close
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </li>
    );
}
