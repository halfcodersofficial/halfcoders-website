"use client";

import { useEffect, useState } from "react";
import { useCourseBatches } from "@/hooks/useCourseBatches";
import { formatBatchDateTime, type BatchSchedule } from "@/lib/courseBatch";
import { cn } from "@/lib/utils";

interface CourseCountdownProps {
    schedule: BatchSchedule;
    /** When the server rendered the page — see `useCourseBatches`. */
    renderedAt?: number;
    /** On the course page's navy hero. */
    onDark?: boolean;
    className?: string;
}

const UNITS = [
    { key: "days", label: "দিন", size: 86_400 },
    { key: "hours", label: "ঘণ্টা", size: 3_600 },
    { key: "minutes", label: "মিনিট", size: 60 },
    { key: "seconds", label: "সেকেন্ড", size: 1 },
] as const;

/**
 * How long enrolment stays open, counting down to the end of whichever
 * enrolment window is open, the present batch's or the next's. Nothing while
 * enrolment is closed, or open with no end.
 *
 * Renders dashes until it has mounted: the server can't know the visitor's
 * clock, and a number rendered at build time would mismatch on hydration and
 * then jump. Whether to show at all goes by `useCourseBatches`, which matches
 * the server's render first and then shuts the timer the moment enrolment does.
 *
 * Set like a process timer in a terminal: a comment line, then the figures in
 * mono cells separated by colons.
 */
export default function CourseCountdown({ schedule, renderedAt, onDark = false, className }: CourseCountdownProps) {
    const batches = useCourseBatches(schedule, renderedAt);
    const [now, setNow] = useState<number | null>(null);

    useEffect(() => {
        setNow(Date.now());
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    const closesAt = batches?.enrollmentOpen ? batches.closesAt : null;
    if (!closesAt) return null;
    const target = closesAt.getTime();
    if (now !== null && target <= now) return null;

    let remaining = now === null ? null : Math.floor((target - now) / 1000);

    const parts = UNITS.map((unit) => {
        if (remaining === null) return { ...unit, value: "--" };
        const value = Math.floor(remaining / unit.size);
        remaining -= value * unit.size;
        return { ...unit, value: String(value).padStart(2, "0") };
    });

    return (
        <div
            className={cn(
                "overflow-hidden rounded-card border",
                onDark ? "border-editor-line bg-editor-panel" : "border-border bg-card",
                className,
            )}
        >
            <div
                className={cn(
                    "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4 py-2.5 font-mono text-xs",
                    onDark ? "border-editor-line" : "border-border bg-surface",
                )}
            >
                <p className="flex items-center gap-2 text-syn-string">
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
                        <span className="relative inline-flex size-2 rounded-full bg-current" />
                    </span>
                    <span lang="bn" className="font-sans text-sm font-semibold">ভর্তির সময় বাকি</span>
                </p>
                <span lang="bn" className={cn("font-sans", onDark ? "text-editor-muted" : "text-muted-foreground")}>
                    {formatBatchDateTime(closesAt)} পর্যন্ত
                </span>
            </div>
            <div className="flex items-start justify-between gap-1 px-3 py-4 sm:px-5" role="timer" aria-live="off" aria-label="ভর্তি শেষ হতে বাকি সময়">
                {parts.map((part, index) => (
                    <div key={part.key} className="flex flex-1 items-start">
                        <div className="flex-1 text-center">
                            <p
                                className={cn(
                                    "font-mono text-3xl font-semibold leading-none tabular-nums sm:text-4xl",
                                    onDark ? "text-editor-fg" : "text-foreground",
                                )}
                            >
                                {part.value}
                            </p>
                            <p className={cn("mt-2 text-xs", onDark ? "text-editor-muted" : "text-muted-foreground")}>{part.label}</p>
                        </div>
                        {index < parts.length - 1 && (
                            <span aria-hidden className="font-mono text-2xl leading-none text-syn-comment sm:text-3xl">
                                :
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
