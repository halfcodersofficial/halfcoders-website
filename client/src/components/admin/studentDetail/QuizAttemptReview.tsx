"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, CircleSlash, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { quizService } from "@/services";
import type { QuizReviewQuestion } from "@/types/learning.types";
import { percentTone } from "./format";

type Show = "all" | "wrong" | "right";

const verdict = (question: QuizReviewQuestion) => (question.isCorrect === null ? "skipped" : question.isCorrect ? "right" : "wrong");

/**
 * One quiz attempt, question by question: what the student picked against the
 * right answer, and the explanation — the same answers they see on "See
 * correct answers". A strip of numbered squares at the top shows at a glance
 * which they got right and jumps to any question.
 */
export function QuizAttemptReview({ attemptId, title, onClose }: { attemptId: string | null; title?: string; onClose: () => void }) {
    return (
        <Modal
            open={attemptId !== null}
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            title={title ?? "Quiz answers"}
            description="Their answer against the right one, question by question."
        >
            {attemptId && <ReviewBody attemptId={attemptId} />}
            <ModalFooter>
                <Button variant="outline" onClick={onClose}>
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}

function ReviewBody({ attemptId }: { attemptId: string }) {
    const [show, setShow] = useState<Show>("all");
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["quiz-attempt-review", attemptId],
        queryFn: () => quizService.getAttempt(attemptId),
    });

    if (isLoading) {
        return (
            <ModalBody className="space-y-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
            </ModalBody>
        );
    }
    if (isError || !data) {
        return (
            <ModalBody>
                <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {getApiErrorMessage(error, "Couldn't open these answers.")}
                </p>
            </ModalBody>
        );
    }

    const right = data.questions.filter((question) => question.isCorrect === true).length;
    const wrong = data.questions.filter((question) => question.isCorrect === false).length;
    const skipped = data.questions.length - right - wrong;
    const finished = data.status === "COMPLETED";
    const shown = data.questions
        .map((question, index) => ({ question, number: index + 1 }))
        .filter(({ question }) => show === "all" || verdict(question) === show);

    const jumpTo = (number: number) => {
        setShow("all");
        // After the list re-renders with every question in it.
        window.requestAnimationFrame(() => document.getElementById(`review-q${number}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    return (
        <ModalBody className="space-y-5">
            {/* The score, and a square per question: green right, red wrong. */}
            <section className="space-y-3 rounded-md border border-border bg-surface p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className={cn("text-3xl font-bold tabular-nums leading-none", finished && percentTone(data.percentage))}>
                            {finished ? `${data.percentage}%` : "Unfinished"}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                            {finished && data.completedAt ? `Submitted ${formatDateTime(data.completedAt)}` : `Started ${formatDateTime(data.startedAt)}`}
                        </p>
                    </div>
                    <dl className="flex gap-5 text-sm">
                        <Tally label="Right" value={right} className="text-success" />
                        <Tally label="Wrong" value={wrong} className="text-destructive" />
                        {skipped > 0 && <Tally label="Not answered" value={skipped} className="text-muted-foreground" />}
                    </dl>
                </div>

                <ol className="flex flex-wrap gap-1.5" aria-label="Questions">
                    {data.questions.map((question, index) => {
                        const state = verdict(question);
                        return (
                            <li key={question.id}>
                                <button
                                    type="button"
                                    onClick={() => jumpTo(index + 1)}
                                    title={`Question ${index + 1}: ${state === "right" ? "right" : state === "wrong" ? "wrong" : "not answered"}`}
                                    className={cn(
                                        "grid size-8 place-items-center rounded-sm font-mono text-xs font-semibold tabular-nums transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        state === "right" && "bg-success/15 text-success-ink",
                                        state === "wrong" && "bg-destructive/15 text-destructive-ink",
                                        state === "skipped" && "bg-secondary text-muted-foreground",
                                    )}
                                >
                                    {index + 1}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </section>

            {finished && (
                <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
                    {(
                        [
                            ["all", `All ${data.questions.length}`],
                            ["wrong", `Wrong ${wrong}`],
                            ["right", `Right ${right}`],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={show === value}
                            onClick={() => setShow(value)}
                            className={cn(
                                "rounded-md border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                show === value ? "border-primary bg-primary/10 text-primary-ink" : "border-border text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {!finished && (
                <p className="rounded-md bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
                    This attempt was never submitted, so the right answers stay hidden — as they do for the student.
                </p>
            )}

            {shown.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{show === "wrong" ? "No wrong answers — every one was right." : "None right."}</p>
            ) : (
                <ol className="space-y-4">
                    {shown.map(({ question, number }) => (
                        <QuestionCard key={question.id} question={question} number={number} />
                    ))}
                </ol>
            )}
        </ModalBody>
    );
}

function QuestionCard({ question, number }: { question: QuizReviewQuestion; number: number }) {
    const state = verdict(question);
    return (
        <li id={`review-q${number}`} className="scroll-mt-4 overflow-hidden rounded-md border border-border">
            <header className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
                <span className="font-mono text-xs font-semibold text-muted-foreground">Q{String(number).padStart(2, "0")}</span>
                <span className="flex-1" />
                {state === "right" && (
                    <Badge variant="success">
                        <Check className="size-3" aria-hidden /> Right
                    </Badge>
                )}
                {state === "wrong" && (
                    <Badge variant="destructive">
                        <X className="size-3" aria-hidden /> Wrong
                    </Badge>
                )}
                {state === "skipped" && (
                    <Badge variant="secondary">
                        <CircleSlash className="size-3" aria-hidden /> Not answered
                    </Badge>
                )}
            </header>

            <div className="space-y-3 p-4">
                <p className="whitespace-pre-line font-medium wrap-break-word">{question.question}</p>
                {question.imageUrl && (
                    <a href={question.imageUrl} target="_blank" rel="noreferrer" className="block w-fit max-w-full" title="Open the picture full size">
                        {/* Any size, straight from Cloudinary — a plain <img> keeps its own size and proportions. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={question.imageUrl}
                            alt={`Picture for question ${number}`}
                            className="block h-auto max-h-72 max-w-full rounded-md border border-border bg-white"
                        />
                    </a>
                )}

                <ul className="space-y-1.5">
                    {question.options.map((option) => {
                        const picked = option.id === question.selectedOptionId;
                        const correct = option.isCorrect === true;
                        return (
                            <li
                                key={option.id}
                                className={cn(
                                    "flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm",
                                    correct && "border-success/40 bg-success/10",
                                    picked && !correct && "border-destructive/40 bg-destructive/10",
                                    !picked && !correct && "border-border text-muted-foreground",
                                )}
                            >
                                <span
                                    className={cn(
                                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                                        correct ? "bg-success text-white" : picked ? "bg-destructive text-white" : "border border-border",
                                    )}
                                    aria-hidden
                                >
                                    {correct ? <Check className="size-2.5" strokeWidth={3} /> : picked ? <X className="size-2.5" strokeWidth={3} /> : null}
                                </span>
                                <span className="min-w-0 flex-1 whitespace-pre-line wrap-break-word">{option.text}</span>
                                {(picked || correct) && (
                                    <span className={cn("shrink-0 text-xs font-semibold", correct ? "text-success-ink" : "text-destructive-ink")}>
                                        {picked && correct ? "Their answer · right" : picked ? "Their answer" : "Right answer"}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {question.explanation && (
                    <p className="rounded-md bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Why: </span>
                        {question.explanation}
                    </p>
                )}
            </div>
        </li>
    );
}

function Tally({ label, value, className }: { label: string; value: number; className?: string }) {
    return (
        // The label under the number, but first in the markup, as a definition list wants it.
        <div className="flex flex-col-reverse text-right">
            <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("text-xl font-bold tabular-nums leading-none", className)}>{value}</dd>
        </div>
    );
}
