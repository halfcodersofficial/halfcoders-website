"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { type StaffArea, staffSupportRoutes } from "@/lib/staffRoutes";
import { clock } from "@/components/mentor/dashboard/time";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { cn, formatQueueNumber } from "@/lib/utils";
import { supportService } from "@/services";
import type { SupportQueueStatus } from "@/types/api.types";
import type { QueueHistoryEntry } from "@/types/mentor.types";

const STATUS: Record<SupportQueueStatus, { label: string; tone: string }> = {
    WAITING: { label: "Still waiting", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    SERVING: { label: "Being helped", tone: "bg-primary/10 text-primary" },
    COMPLETED: { label: "Helped", tone: "bg-success/10 text-success" },
    SKIPPED: { label: "Skipped", tone: "bg-secondary text-secondary-foreground" },
    LEFT: { label: "Left the line", tone: "bg-secondary text-muted-foreground" },
};

const FILTERS: { value: SupportQueueStatus | ""; label: string }[] = [
    { value: "", label: "Everyone" },
    { value: "COMPLETED", label: "Helped" },
    { value: "SKIPPED", label: "Skipped" },
    { value: "LEFT", label: "Left" },
];

const minutesBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
const median = (values: number[]) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const asMinutes = (value: number | null) => (value === null ? "—" : value < 1 ? "<1 min" : `${Math.round(value)} min`);

/**
 * Who joined a support session's line and how it went for each: their
 * number, when they were seen and for how long, what they needed and the
 * mentor's note — with the session's medians on top. Mentors open it from
 * the board they ran; admins from the course's sessions. Mentors see
 * students by name only.
 */
export default function SupportSessionHistory({
    sessionId,
    area,
    backHref,
}: {
    sessionId: string;
    area: StaffArea;
    /** Where "back" leads instead of the console's own support page — the course the admin came from. */
    backHref?: string;
}) {
    const routes = staffSupportRoutes(area, sessionId);
    const [filter, setFilter] = useState<SupportQueueStatus | "">("");

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["support", "history", sessionId],
        queryFn: () => supportService.sessionHistory(sessionId),
    });

    if (isLoading) {
        return (
            <div className="w-full space-y-6">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-24 rounded-card" />
                <Skeleton className="h-72 rounded-card" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="mx-auto grid w-full min-h-[60dvh] max-w-md place-items-center text-center">
                <div>
                    <p className="font-medium">Can&apos;t open this session</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getApiErrorMessage(error, "It may belong to a course you don't mentor.")}</p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={backHref ?? routes.home}>Back to sessions</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const count = (status: SupportQueueStatus) => data.filter((entry) => entry.status === status).length;
    const waits = data.flatMap((entry) => (entry.servedAt ? [minutesBetween(entry.joinedAt, entry.servedAt)] : []));
    const helpTimes = data.flatMap((entry) => (entry.servedAt && entry.completedAt && entry.status === "COMPLETED" ? [minutesBetween(entry.servedAt, entry.completedAt)] : []));
    const rows = filter ? data.filter((entry) => entry.status === filter) : data;

    return (
        <div className="w-full space-y-6">
            <header className="space-y-4 animate-in fade-in duration-500 motion-reduce:animate-none">
                <BackButton
                    href={backHref ?? routes.session}
                    label={backHref ? "Course sessions" : area === "admin" ? "Support sessions" : "The queue board"}
                />
                <div>
                    <ConsoleEyebrow />
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Attendance</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Everyone who took a number, in the order they joined · Dhaka time</p>
                </div>
            </header>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card sm:grid-cols-4">
                <Figure label="Joined" value={data.length} />
                <Figure label="Helped" value={count("COMPLETED")} hint={count("SKIPPED") || count("LEFT") ? `${count("SKIPPED")} skipped · ${count("LEFT")} left` : undefined} />
                <Figure label="Median wait" value={asMinutes(median(waits))} hint="From joining to being seen" />
                <Figure label="Median help" value={asMinutes(median(helpTimes))} hint="Time with the mentor" />
            </dl>

            {data.length === 0 ? (
                <div className="rounded-card border border-dashed border-border px-6 py-14 text-center">
                    <Users className="mx-auto size-7 text-muted-foreground" aria-hidden />
                    <p className="mt-3 font-medium">Nobody joined this session.</p>
                </div>
            ) : (
                <section aria-label="Everyone in line" className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                    <div role="group" aria-label="Show" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
                        {FILTERS.map((option) => (
                            <button
                                key={option.value || "all"}
                                type="button"
                                aria-pressed={filter === option.value}
                                onClick={() => setFilter(option.value)}
                                className={cn(
                                    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                    filter === option.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {option.label}
                                <span className="ml-1.5 tabular-nums text-muted-foreground">{option.value ? count(option.value) : data.length}</span>
                            </button>
                        ))}
                    </div>
                    {rows.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-muted-foreground">Nobody here.</p>
                    ) : (
                        <ol className="divide-y divide-border">
                            {rows.map((entry) => (
                                <Row key={entry.id} entry={entry} />
                            ))}
                        </ol>
                    )}
                </section>
            )}
        </div>
    );
}

function Figure({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div className="bg-card px-5 py-4">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
            {hint && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</dd>}
        </div>
    );
}

function Row({ entry }: { entry: QueueHistoryEntry }) {
    const status = STATUS[entry.status];
    const waited = entry.servedAt ? minutesBetween(entry.joinedAt, entry.servedAt) : null;
    const helped = entry.servedAt && entry.completedAt ? minutesBetween(entry.servedAt, entry.completedAt) : null;
    return (
        <li className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:px-5">
            <span className="pt-1.5 font-mono text-sm font-semibold tabular-nums text-muted-foreground">{formatQueueNumber(entry.queueNumber)}</span>
            <div className="flex min-w-0 items-start gap-3">
                <Avatar src={entry.student.image} name={entry.student.name} size={32} />
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-medium">{entry.student.name}</span>
                        {entry.student.email && <span className="truncate text-xs text-muted-foreground">{entry.student.email}</span>}
                    </p>
                    {entry.topic && <p className="mt-0.5 text-sm leading-relaxed text-foreground/80">{entry.topic}</p>}
                    {entry.mentorNote && <p className="mt-1 border-l-2 border-primary/30 pl-2 text-xs text-muted-foreground">{entry.mentorNote}</p>}
                </div>
            </div>
            <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:col-start-3 sm:flex-col sm:items-end">
                <span className={cn("rounded-sm px-2 py-0.5 font-semibold", status.tone)}>{status.label}</span>
                <span className="tabular-nums">
                    joined {clock(entry.joinedAt)}
                    {waited !== null && ` · waited ${asMinutes(waited)}`}
                    {helped !== null && ` · ${asMinutes(helped)} with mentor`}
                </span>
            </div>
        </li>
    );
}
