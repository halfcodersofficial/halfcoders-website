"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownWideNarrow, Check, ListOrdered, X } from "lucide-react";
import { useState } from "react";
import { Modal, ModalBody } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { quizService } from "@/services";
import type { QuizResultsDetail } from "@/types/mentor.types";

type Question = QuizResultsDetail["questions"][number];

/**
 * How each question went across every finished attempt: the share who got it
 * right, and which answers people picked — so a wrong option that drew half
 * the class stands out. Counts only; no student is named here.
 */
export function QuizQuestions({ detail }: { detail: QuizResultsDetail }) {
    const [hardestFirst, setHardestFirst] = useState(false);
    const answered = detail.questions.filter((question) => question.percentCorrect !== null);
    const hardest = answered.length > 1 ? answered.reduce((low, question) => (question.percentCorrect! < low.percentCorrect! ? question : low)) : null;
    const questions = hardestFirst
        ? [...detail.questions].sort((a, b) => (a.percentCorrect ?? 101) - (b.percentCorrect ?? 101))
        : detail.questions;

    if (detail.questions.length === 0) {
        return <p className="px-6 py-6 text-sm text-muted-foreground">This quiz has no questions yet.</p>;
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-3 px-5 pt-3 sm:px-6">
                <p className="text-xs text-muted-foreground">Across {detail.attempts.length} finished {detail.attempts.length === 1 ? "attempt" : "attempts"}</p>
                <button
                    type="button"
                    onClick={() => setHardestFirst((value) => !value)}
                    aria-pressed={hardestFirst}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                    {hardestFirst ? <ListOrdered className="size-3.5" aria-hidden /> : <ArrowDownWideNarrow className="size-3.5" aria-hidden />}
                    {hardestFirst ? "In quiz order" : "Hardest first"}
                </button>
            </div>
            <ol className="divide-y divide-border">
                {questions.map((question) => (
                    <QuestionStats key={question.id} question={question} mostMissed={question.id === hardest?.id && hardest.percentCorrect! < 100} />
                ))}
            </ol>
        </div>
    );
}

function QuestionStats({ question, mostMissed }: { question: Question; mostMissed: boolean }) {
    const share = question.percentCorrect;
    return (
        <li className="px-5 py-4 sm:px-6">
            <div className="flex items-start gap-4">
                <span className="mt-0.5 w-7 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">Q{question.order}</span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                        {question.question}
                        {mostMissed && (
                            <span className="ml-2 inline-block rounded-sm bg-destructive/10 px-2 py-0.5 align-middle text-[0.6875rem] font-medium text-destructive">
                                Most missed
                            </span>
                        )}
                    </p>
                    <ul className="mt-2.5 space-y-1.5" aria-label="Answers picked">
                        {question.options.map((option) => {
                            const width = question.answered ? (option.picked / question.answered) * 100 : 0;
                            return (
                                <li key={option.id} className="grid grid-cols-[minmax(0,1fr)_6rem_2rem] items-center gap-3 text-xs">
                                    <span className={cn("flex min-w-0 items-center gap-1.5", option.isCorrect ? "font-medium text-foreground" : "text-muted-foreground")}>
                                        {option.isCorrect ? (
                                            <Check className="size-3.5 shrink-0 text-primary" aria-label="Correct answer" />
                                        ) : (
                                            <span className="size-3.5 shrink-0" aria-hidden />
                                        )}
                                        <span className="truncate" title={option.text}>{option.text}</span>
                                    </span>
                                    <span className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                                        <span
                                            className={cn("block h-full rounded-full", option.isCorrect ? "bg-primary" : "bg-muted-foreground/40")}
                                            style={{ width: `${width}%` }}
                                        />
                                    </span>
                                    <span className="text-right tabular-nums text-muted-foreground">{option.picked}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <span className="w-16 shrink-0 text-right">
                    <span className="block text-lg font-bold tabular-nums">{share === null ? "—" : `${share}%`}</span>
                    <span className="block text-[0.6875rem] text-muted-foreground">{share === null ? "unanswered" : "got it right"}</span>
                </span>
            </div>
        </li>
    );
}

/**
 * One student's finished attempt, answer by answer: what they picked, what
 * was right, and the explanation they saw. Their name is the only thing
 * about them on it.
 */
export function QuizAttemptModal({
    attemptId,
    studentName,
    onClose,
}: {
    attemptId: string | null;
    studentName: string;
    onClose: () => void;
}) {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["quiz-attempt-review", attemptId],
        queryFn: () => quizService.getAttempt(attemptId!),
        enabled: attemptId !== null,
    });

    return (
        <Modal
            open={attemptId !== null}
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            title={`${studentName}'s answers`}
            description={
                data ? `${data.quiz.title} · ${data.correctCount} of ${data.totalQuestions} right · ${data.percentage}%` : "Loading the attempt…"
            }
        >
            <ModalBody className="space-y-4">
                {isLoading ? (
                    <>
                        <Skeleton className="h-28 rounded-card" />
                        <Skeleton className="h-28 rounded-card" />
                    </>
                ) : isError || !data ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">{getApiErrorMessage(error, "Couldn't open this attempt.")}</p>
                ) : (
                    <ol className="space-y-4">
                        {data.questions.map((question, index) => (
                            <li key={question.id} className="rounded-card border border-border p-4">
                                <p className="flex items-start gap-3 text-sm font-medium">
                                    <span className="mt-px shrink-0 tabular-nums text-muted-foreground">Q{index + 1}</span>
                                    <span className="min-w-0 flex-1">{question.question}</span>
                                    {question.isCorrect === null ? (
                                        <span className="shrink-0 text-xs font-normal text-muted-foreground">Not answered</span>
                                    ) : question.isCorrect ? (
                                        <Check className="size-4 shrink-0 text-primary" aria-label="Right" />
                                    ) : (
                                        <X className="size-4 shrink-0 text-destructive" aria-label="Wrong" />
                                    )}
                                </p>
                                <ul className="mt-3 space-y-1.5">
                                    {question.options.map((option) => {
                                        const picked = option.id === question.selectedOptionId;
                                        return (
                                            <li
                                                key={option.id}
                                                className={cn(
                                                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                                                    option.isCorrect && "border-primary/40 bg-primary/5",
                                                    picked && !option.isCorrect && "border-destructive/40 bg-destructive/5",
                                                    !picked && !option.isCorrect && "border-transparent text-muted-foreground",
                                                )}
                                            >
                                                <span className="min-w-0 flex-1">{option.text}</span>
                                                {picked && <span className="shrink-0 text-xs font-medium">Their answer</span>}
                                                {option.isCorrect && !picked && <span className="shrink-0 text-xs font-medium text-primary">Correct</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                                {question.explanation && (
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">Explanation: </span>
                                        {question.explanation}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </ModalBody>
        </Modal>
    );
}
