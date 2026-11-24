"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Scale, Send, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { pad2 } from "@/components/mentor/dashboard/time";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { assignmentService } from "@/services";
import type { SubmissionHistory } from "@/types/mentor.types";
import { eventTitle, historyEvents, queueHref, type HistoryEvent } from "./handInHistory";
import { STATUS_META } from "./MarkingPane";
import SentWork from "./SentWork";

const ICON: Record<HistoryEvent["kind"], LucideIcon> = { version: Send, review: Check, recheckAsked: Scale, recheckDecided: Scale };

const ADJUSTMENT_LABEL: Record<SubmissionHistory["adjustments"][number]["kind"], string> = {
    RESUBMIT_PENALTY: "Resubmitted before the results",
    RECHECK_FEE: "Recheck fee",
    RECHECK_REFUND: "Recheck fee given back",
    RECHECK_PENALTY: "Recheck: the mark was right",
};

/**
 * One hand-in's whole history, for its course's staff: every version the
 * student sent — exactly as they sent it — every marking with its feedback
 * and rubric, every recheck and how it was decided, and every mark taken or
 * given back. Newest first; a link from the review queue lands on its entry.
 */
export default function HandInHistory({ submissionId }: { submissionId: string }) {
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["reviews", "history", submissionId],
        queryFn: () => assignmentService.submissionHistory(submissionId),
    });

    // The entry a link pointed at (#review-…): scrolled to and outlined, once it's on the page.
    const [pointedAt, setPointedAt] = useState<string | null>(null);
    useEffect(() => {
        if (!data) return;
        const id = window.location.hash.slice(1);
        if (!id) return;
        setPointedAt(id);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [data]);

    if (isLoading) {
        return (
            <div className="w-full space-y-4">
                <Skeleton className="h-28 rounded-card" />
                <Skeleton className="h-64 rounded-card" />
                <Skeleton className="h-64 rounded-card" />
            </div>
        );
    }
    if (isError || !data) {
        return (
            <div className="w-full py-16 text-center">
                <p className="font-medium">Couldn&apos;t open this hand-in&apos;s history.</p>
                <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "Try again in a moment.")}</p>
                <div className="mt-4 flex justify-center gap-2">
                    <Button variant="outline" onClick={() => refetch()}>
                        Try again
                    </Button>
                    <Button asChild variant="ghost">
                        <Link href="/mentor/reviews">Back to the review queue</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const events = historyEvents(data);
    const total = data.assignment.totalMarks;
    const meta = data.recheckOpen ? { label: "Recheck", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" } : STATUS_META[data.status];

    return (
        <div className="w-full space-y-6">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                <Link href={queueHref(data)}>
                    <ArrowLeft /> Back to the review queue
                </Link>
            </Button>

            <header className="flex flex-wrap items-center gap-4 animate-in fade-in duration-500 motion-reduce:animate-none">
                <Avatar src={data.student.image} name={data.student.name} size={52} />
                <div className="min-w-0 flex-1">
                    <ConsoleEyebrow />
                    <h1 className="truncate text-2xl font-bold tracking-tight">{data.student.name}</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{data.assignment.title}</span> · {data.assignment.course.title} ·{" "}
                        {data.assignment.course.milestoneLabel} {pad2(data.assignment.milestone.order)}
                    </p>
                </div>
                <div className="text-right">
                    <span className={cn("rounded-sm px-2.5 py-0.5 text-xs font-semibold", meta.tone)}>{meta.label}</span>
                    {data.finalScore !== null && (
                        <p className="mt-1.5 text-sm text-muted-foreground">
                            Their mark now{" "}
                            <span className="font-semibold tabular-nums text-foreground">
                                {data.finalScore}/{total}
                            </span>
                        </p>
                    )}
                </div>
            </header>

            <p className="text-sm text-muted-foreground">
                {plural(data.versions.length, "version")} sent · {plural(data.reviews.length, "marking")} · {plural(data.rechecks.length, "recheck")} — newest
                first.
            </p>

            <ol className="space-y-4">
                {events.map((event, index) => (
                    <li key={event.id} id={event.id} className="scroll-mt-24">
                        <EventCard event={event} total={total} latest={index === 0} pointedAt={pointedAt === event.id} />
                    </li>
                ))}
            </ol>

            {data.adjustments.length > 0 && (
                <section aria-labelledby="adjustments-title" className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                    <h2 id="adjustments-title" className="border-b border-border bg-surface px-4 py-3 font-semibold">
                        Marks taken and given back
                    </h2>
                    <ul className="divide-y divide-border">
                        {data.adjustments.map((entry) => (
                            <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                                <span className="min-w-0">
                                    {ADJUSTMENT_LABEL[entry.kind]}
                                    <span className="block text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                                </span>
                                <span className={cn("shrink-0 font-semibold tabular-nums", entry.marks < 0 ? "text-destructive" : "text-success")}>
                                    {entry.marks > 0 ? `+${entry.marks}` : `−${Math.abs(entry.marks)}`}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** One entry of the history, in full. */
function EventCard({ event, total, latest, pointedAt }: { event: HistoryEvent; total: number; latest: boolean; pointedAt: boolean }) {
    const Icon = ICON[event.kind];
    return (
        <article
            className={cn(
                "overflow-hidden rounded-card border bg-card shadow-card transition-shadow",
                pointedAt ? "border-primary ring-2 ring-primary/30" : "border-border",
            )}
        >
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-4 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-3.5" aria-hidden />
                </span>
                <h2 className="min-w-0 flex-1 font-semibold">{eventTitle(event, total)}</h2>
                {latest && (
                    <span className="rounded-sm bg-primary px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide text-primary-foreground">
                        Latest
                    </span>
                )}
                <time dateTime={event.at} className="text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(event.at)}
                </time>
            </header>
            <div className="px-4 py-4">
                <EventBody event={event} total={total} />
            </div>
        </article>
    );
}

function EventBody({ event, total }: { event: HistoryEvent; total: number }) {
    switch (event.kind) {
        case "version":
            return <SentWork content={event.version.content} submissionUrl={event.version.submissionUrl} fileUrls={event.version.fileUrls} />;

        case "review": {
            const { review } = event;
            return (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {review.reviewer && (
                            <span className="inline-flex items-center gap-2 text-sm">
                                <Avatar src={review.reviewer.image} name={review.reviewer.name} size={24} />
                                {review.reviewer.name}
                            </span>
                        )}
                        <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold", STATUS_META[review.status].tone)}>
                            {STATUS_META[review.status].label}
                        </span>
                        {review.status === "ACCEPTED" && review.score !== null && (
                            <span className="text-sm font-semibold tabular-nums">
                                {review.score}/{total}
                            </span>
                        )}
                    </div>
                    <Block title="Feedback">
                        {review.feedback ? (
                            <p className="whitespace-pre-wrap wrap-break-word text-sm">{review.feedback}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No written feedback{review.rubric?.length ? " — the marks per part are below" : ""}.
                            </p>
                        )}
                    </Block>
                    {review.rubric && review.rubric.length > 0 && (
                        <Block title="Rubric">
                            <ul className="divide-y divide-border rounded-md border border-border text-sm">
                                {review.rubric.map((line, index) => (
                                    <li key={index} className="px-3 py-2">
                                        <span className="flex items-baseline justify-between gap-4">
                                            <span className="font-medium">{line.title}</span>
                                            <span className="shrink-0 tabular-nums">
                                                <span className="font-semibold">{line.points}</span>
                                                <span className="text-muted-foreground"> / {line.maxPoints}</span>
                                            </span>
                                        </span>
                                        {line.comment && <span className="mt-0.5 block text-xs text-muted-foreground">{line.comment}</span>}
                                    </li>
                                ))}
                            </ul>
                        </Block>
                    )}
                </div>
            );
        }

        case "recheckAsked":
            return (
                <div className="space-y-3">
                    <Block title="Why they asked">
                        <p className="whitespace-pre-wrap wrap-break-word text-sm">{event.recheck.reason}</p>
                    </Block>
                    <p className="text-xs text-muted-foreground">
                        Their mentor&apos;s mark then: <span className="font-semibold tabular-nums text-foreground">{event.recheck.scoreBefore}</span>
                        {event.recheck.status === "PENDING" && " · still waiting for a decision"}
                    </p>
                </div>
            );

        case "recheckDecided": {
            const { recheck } = event;
            return (
                <div className="space-y-3">
                    <p className={cn("text-sm font-medium", recheck.status === "VALID" ? "text-success" : "text-destructive")}>
                        {recheck.status === "VALID"
                            ? `Mark raised from ${recheck.scoreBefore} to ${recheck.scoreAfter}.`
                            : `Mark kept at ${recheck.scoreBefore}.`}
                    </p>
                    {recheck.reviewedBy && (
                        <span className="inline-flex items-center gap-2 text-sm">
                            <Avatar src={recheck.reviewedBy.image} name={recheck.reviewedBy.name} size={24} />
                            Decided by {recheck.reviewedBy.name}
                        </span>
                    )}
                    {recheck.reviewerNote && (
                        <Block title="What the mentor said">
                            <p className="whitespace-pre-wrap wrap-break-word text-sm">{recheck.reviewerNote}</p>
                        </Block>
                    )}
                </div>
            );
        }
    }
}

function Block({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h3 className="mb-1.5 text-[0.6875rem] font-semibold font-mono uppercase tracking-wider text-muted-foreground">{title}</h3>
            {children}
        </section>
    );
}
