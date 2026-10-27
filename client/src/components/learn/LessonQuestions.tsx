"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, CornerDownRight, MessagesSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { lessonQaService } from "@/services";
import type { LessonQuestion, QaPerson } from "@/types/domain.types";

/** A name with a "Mentor" mark on the course's staff. */
export function QaName({ person }: { person: QaPerson }) {
    return (
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            {person.name}
            {person.isStaff && <span className="rounded-full bg-primary/10 px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide text-primary">Mentor</span>}
        </span>
    );
}

/**
 * Questions on this lesson, under the notes: ask one, answer a classmate's,
 * mark yours answered. The course's mentors are told about each new
 * question and answer from their own inbox; their replies carry a mark.
 */
export default function LessonQuestions({ videoId }: { videoId: string }) {
    const queryClient = useQueryClient();
    const key = ["learning", "lesson-questions", videoId];
    const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => lessonQaService.forLesson(videoId) });
    const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
    const [draft, setDraft] = useState("");
    const [focus, setFocus] = useState<string | null>(null);

    useEffect(() => setDraft(""), [videoId]);
    // A notification links to its question (#q-…): open the thread there.
    useEffect(() => {
        const hash = window.location.hash;
        if (hash.startsWith("#q-")) setFocus(hash.slice(3));
    }, []);
    useEffect(() => {
        if (focus && data) document.getElementById(`q-${focus}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [focus, data]);

    const ask = useMutation({
        mutationFn: () => lessonQaService.ask(videoId, draft.trim()),
        onSuccess: () => {
            setDraft("");
            toast.success("Asked — your mentors have been told.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't post your question.")),
    });

    const questions = data ?? [];
    const open = questions.filter((question) => !question.isResolved).length;

    return (
        <section aria-labelledby="qa-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h3 id="qa-title" className="flex items-center gap-2 text-sm font-semibold">
                    <MessagesSquare className="size-4 text-primary" aria-hidden /> Questions on this lesson
                </h3>
                {questions.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                        {questions.length} asked{open > 0 && ` · ${open} open`}
                    </span>
                )}
            </div>

            <form
                className="space-y-2 border-b border-border p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (draft.trim().length >= 3) ask.mutate();
                }}
            >
                <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    maxLength={3000}
                    placeholder="Stuck on something in this lesson? Ask — your mentors and classmates can answer."
                    aria-label="Your question"
                />
                <div className="flex justify-end">
                    <Button type="submit" size="sm" className="rounded-full px-5" disabled={draft.trim().length < 3} isLoading={ask.isPending}>
                        Ask
                    </Button>
                </div>
            </form>

            {isLoading ? (
                <div className="space-y-2 p-4">
                    <Skeleton className="h-16" />
                </div>
            ) : isError ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load the questions.</p>
            ) : questions.length === 0 ? (
                <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                    <CircleHelp className="size-4" aria-hidden /> No questions yet — be the first.
                </p>
            ) : (
                <ul className="divide-y divide-border">
                    {questions.map((question) => (
                        <QuestionThread key={question.id} question={question} highlighted={focus === question.id} onChange={refresh} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function QuestionThread({ question, highlighted, onChange }: { question: LessonQuestion; highlighted: boolean; onChange: () => void }) {
    const [replying, setReplying] = useState(false);
    const [reply, setReply] = useState("");

    const answer = useMutation({
        mutationFn: () => lessonQaService.answer(question.id, reply.trim()),
        onSuccess: () => {
            setReply("");
            setReplying(false);
            onChange();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't post your answer.")),
    });
    const resolve = useMutation({
        mutationFn: (isResolved: boolean) => lessonQaService.setResolved(question.id, isResolved),
        onSuccess: () => onChange(),
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update it.")),
    });
    const remove = useMutation({
        mutationFn: (target: { kind: "question" | "answer"; id: string }) =>
            target.kind === "question" ? lessonQaService.removeQuestion(target.id) : lessonQaService.removeAnswer(target.id),
        onSuccess: () => onChange(),
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove it.")),
    });
    const askRemove = async (target: { kind: "question" | "answer"; id: string }) => {
        if (await confirmAction({ title: `Remove your ${target.kind}?`, text: "It's taken off the lesson for everyone.", confirmText: "Remove" })) remove.mutate(target);
    };

    return (
        <li id={`q-${question.id}`} className={cn("scroll-mt-32 px-4 py-4", highlighted && "bg-primary/5")}>
            <div className="flex items-start gap-3">
                <Avatar name={question.author.name} size={30} />
                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <QaName person={question.author} />
                        <span>{formatDateTime(question.createdAt)}</span>
                        {question.isResolved && (
                            <span className="inline-flex items-center gap-1 font-medium text-success">
                                <CheckCircle2 className="size-3.5" aria-hidden /> Answered
                            </span>
                        )}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{question.body}</p>

                    {question.answers.length > 0 && (
                        <ul className="mt-3 space-y-3 border-l-2 border-border pl-4">
                            {question.answers.map((entry) => (
                                <li key={entry.id} className={cn(entry.author.isStaff && "rounded-lg bg-primary/5 p-2.5 -ml-2.5")}>
                                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                        <QaName person={entry.author} />
                                        <span>{formatDateTime(entry.createdAt)}</span>
                                        {entry.isMine && (
                                            <button
                                                type="button"
                                                onClick={() => void askRemove({ kind: "answer", id: entry.id })}
                                                aria-label="Remove your answer"
                                                className="ml-auto rounded p-1 transition-colors hover:bg-destructive/10 hover:text-destructive"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        )}
                                    </p>
                                    <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed">{entry.body}</p>
                                </li>
                            ))}
                        </ul>
                    )}

                    {replying ? (
                        <form
                            className="mt-3 space-y-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (reply.trim().length >= 3) answer.mutate();
                            }}
                        >
                            <Textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} maxLength={3000} autoFocus aria-label="Your answer" />
                            <div className="flex justify-end gap-2">
                                <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" size="sm" disabled={reply.trim().length < 3} isLoading={answer.isPending}>
                                    Answer
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium">
                            <button type="button" onClick={() => setReplying(true)} className="inline-flex items-center gap-1 text-primary hover:underline">
                                <CornerDownRight className="size-3.5" aria-hidden /> Answer
                            </button>
                            {question.isMine && (
                                <button
                                    type="button"
                                    onClick={() => resolve.mutate(!question.isResolved)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    {question.isResolved ? "Not answered yet" : "Mark answered"}
                                </button>
                            )}
                            {question.isMine && question.answers.length === 0 && (
                                <button
                                    type="button"
                                    onClick={() => void askRemove({ kind: "question", id: question.id })}
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
}
