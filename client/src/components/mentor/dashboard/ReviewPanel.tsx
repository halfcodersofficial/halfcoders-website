import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MentorWaitingReview } from "@/types/mentor.types";
import { elapsed } from "./time";

/** The review queue opened on this one submission. */
export const reviewHref = (submission: { id: string; status: string }, extra = "") =>
    `/mentor/reviews?status=${submission.status}&focus=${submission.id}${extra}`;

/**
 * The review queue at a glance: how many hand-ins are waiting, how long the
 * oldest has, and the ones at the front of the line — each opening straight
 * onto its review form. Two days is where the queue page turns a wait amber.
 */
export default function ReviewPanel({ pending, waiting, now }: { pending: number; waiting: MentorWaitingReview[]; now: number }) {
    const oldest = waiting[0] ? elapsed(waiting[0].submittedAt, now) : null;

    return (
        <section aria-labelledby="reviews-title" className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <header className="flex items-center justify-between gap-3 px-6 pt-6">
                <h2 id="reviews-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Review queue
                </h2>
                <Link href="/mentor/reviews" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    Open <ArrowRight className="size-4" aria-hidden />
                </Link>
            </header>

            {pending === 0 ? (
                <div className="flex flex-1 flex-col justify-center px-6 pb-8 pt-6">
                    <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
                        <Check className="size-6" strokeWidth={2.5} aria-hidden />
                    </span>
                    <p className="mt-5 text-2xl font-bold tracking-tight">All caught up</p>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                        New hand-ins from your courses land here, whoever has waited longest first.
                    </p>
                </div>
            ) : (
                <>
                    <div className="px-6 pt-4">
                        <p className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">{pending}</span>
                            <span className="text-sm text-muted-foreground">{pending === 1 ? "hand-in waits" : "hand-ins wait"} for you</span>
                        </p>
                        {oldest && (
                            <p className={cn("mt-2 text-sm", oldest.days >= 2 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                                The oldest has waited {oldest.text}.
                            </p>
                        )}
                    </div>

                    <ol className="mt-5 divide-y divide-border border-y border-border">
                        {waiting.map((submission) => {
                            const wait = elapsed(submission.submittedAt, now);
                            return (
                                <li key={submission.id}>
                                    <Link
                                        href={reviewHref(submission)}
                                        className="group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-secondary/40"
                                    >
                                        <Avatar name={submission.student.name} size={32} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{submission.student.name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {submission.assignment.title} · {submission.assignment.course.title}
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                                                wait.days >= 2
                                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                                    : "bg-secondary text-secondary-foreground",
                                            )}
                                        >
                                            {wait.text}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                        <Button asChild>
                            <Link href="/mentor/reviews">Start reviewing</Link>
                        </Button>
                        {pending > waiting.length && (
                            <span className="text-xs text-muted-foreground">and {pending - waiting.length} more behind them</span>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
