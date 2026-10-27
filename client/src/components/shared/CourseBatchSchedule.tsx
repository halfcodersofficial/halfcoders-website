"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { useCourseBatches } from "@/hooks/useCourseBatches";
import type { UiLanguage } from "@/lib/i18n";
import { formatBatchDate, formatBatchDateTime, hasBatchDates, type Batch, type BatchSchedule } from "@/lib/courseBatch";
import { cn } from "@/lib/utils";

interface CourseBatchScheduleProps {
    schedule: BatchSchedule;
    /** When the server rendered the page — see `useCourseBatches`. */
    renderedAt?: number;
    /** See `CourseBatchInfo` — the public page is Bangla without a provider. */
    lang: UiLanguage;
    /** Plays the entrance. Off in the admin preview, which scrolls inside its own panel. */
    animate?: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* Calendar faces in Bangladesh time, whatever the visitor's clock says. */
const ZONE = { timeZone: "Asia/Dhaka" } as const;
const MONTH = new Intl.DateTimeFormat("en-GB", { ...ZONE, month: "short" });
const DAY_OF_MONTH = new Intl.DateTimeFormat("en-GB", { ...ZONE, day: "numeric" });
const TIME = new Intl.DateTimeFormat("en-US", { ...ZONE, hour: "numeric", minute: "2-digit" });
const WEEKDAY = {
    bn: { short: new Intl.DateTimeFormat("bn-BD", { ...ZONE, weekday: "short" }), long: new Intl.DateTimeFormat("bn-BD", { ...ZONE, weekday: "long" }) },
    en: { short: new Intl.DateTimeFormat("en-GB", { ...ZONE, weekday: "short" }), long: new Intl.DateTimeFormat("en-GB", { ...ZONE, weekday: "long" }) },
};

type Kind = "enrol" | "class";

/** A date on a batch's way: enrolment opening or closing, classes starting or ending. */
interface Milestone {
    kind: Kind;
    label: string;
    at: Date;
    /** Enrolment opens and closes at a time of day; classes go by the day. */
    withTime: boolean;
}

/** Today as the page knows it: the server's render time first, so hydration matches, then the real clock, every half minute. */
const useClock = (renderedAt?: number) => {
    const [now, setNow] = useState(() => renderedAt ?? Date.now());
    useEffect(() => {
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, []);
    return now;
};

/** The timestamp panel rises in, then each batch's log lines follow one after another. */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root.querySelectorAll("[data-bs-spot]"), { autoAlpha: 0, y: 18, duration: 0.6, ...SETTLE })
        .from(root.querySelectorAll("[data-bs-line]"), { autoAlpha: 0, x: -10, duration: 0.4, stagger: 0.06, ...SETTLE }, 0.25);
};

/**
 * A bootcamp's batches, set out like a terminal. Up top, on the dark editor
 * surface, the date that matters next — enrolment closing while it's open, or
 * opening while it's shut — as a timestamp in mono, with what it is and how
 * long is left, ticking down to the second. Under it, a log for each batch,
 * present and next: one line per date the admin set (enrolment opens, closes,
 * classes start, end), the date and time in mono, a ✓ on the lines gone by and
 * a ▶ on the next one. Each batch says where it stands; the present batch
 * goes once its classes have begun, since it can't be joined any more. Kept
 * live, like the purchase panel. Sized by its container, so it lays out the
 * same in the editor's narrow preview. Nothing off bootcamp, or without dates.
 */
export default function CourseBatchSchedule({ schedule, renderedAt, lang, animate = false }: CourseBatchScheduleProps) {
    const batches = useCourseBatches(schedule, renderedAt);
    const now = useClock(renderedAt);
    const rootRef = useRef<HTMLDivElement>(null);
    useScrollEntrance(rootRef, animate ? buildEntrance : null);

    if (!hasBatchDates(batches)) return null;

    const t = (en: string, bn: string) => (lang === "bn" ? bn : en);
    const weekday = WEEKDAY[lang === "bn" ? "bn" : "en"];
    const { present, next, enrollingInto, enrollmentOpen, closesAt, opensAt } = batches;

    // Enrolment is drawn only where the admin set a window, as before; classes wherever they're dated.
    const milestonesOf = (batch: Batch): Milestone[] =>
        [
            batch.hasOwnWindow && batch.enrollment.opensAt
                ? { kind: "enrol" as const, label: t("Enrolment opens", "ভর্তি শুরু"), at: batch.enrollment.opensAt, withTime: true }
                : null,
            batch.hasOwnWindow && batch.enrollment.closesAt
                ? { kind: "enrol" as const, label: t("Enrolment closes", "ভর্তি শেষ"), at: batch.enrollment.closesAt, withTime: true }
                : null,
            batch.startsAt ? { kind: "class" as const, label: t("Classes start", "ক্লাস শুরু"), at: batch.startsAt, withTime: false } : null,
            batch.endsAt ? { kind: "class" as const, label: t("Classes end", "ক্লাস শেষ"), at: batch.endsAt, withTime: false } : null,
        ].filter((milestone): milestone is Milestone => milestone !== null);

    /** Where a batch stands today, as a chip on its row. */
    const standing = (batch: Batch, enrolling: boolean) => {
        if (enrolling) return { tone: "open" as const, text: t("Enrolling now", "ভর্তি চলছে") };
        const start = batch.startsAt?.getTime();
        const end = batch.endsAt?.getTime();
        if (end !== undefined && end < now) return { tone: "over" as const, text: t("Finished", "শেষ হয়েছে") };
        if (start !== undefined && start <= now) return { tone: "live" as const, text: t("Classes under way", "ক্লাস চলছে") };
        const opens = batch.enrollment.opensAt?.getTime();
        if (opens !== undefined && opens > now) return { tone: "soon" as const, text: t("Enrolling soon", "ভর্তি শিগগিরই") };
        return null;
    };

    // A batch whose classes have begun can't be joined any more, so its row goes; the next batch stays.
    const presentStarted = present.startsAt !== null && present.startsAt.getTime() <= now;
    const rows = [
        ...((present.startsAt || present.hasOwnWindow) && !presentStarted
            ? [{ key: "present", label: t("Present batch", "বর্তমান ব্যাচ"), batch: present, enrolling: enrollingInto === "present" }]
            : []),
        ...(next ? [{ key: "next", label: t("Next batch", "পরের ব্যাচ"), batch: next, enrolling: enrollingInto === "next" }] : []),
    ].map((row) => ({ ...row, milestones: milestonesOf(row.batch), standing: standing(row.batch, row.enrolling) }));

    // ---- The date that matters next, for the big page.
    const upcoming = rows
        .flatMap((row) => row.milestones)
        .filter((milestone) => milestone.at.getTime() > now)
        .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
    const spot =
        enrollmentOpen && closesAt
            ? { tone: "open" as const, label: t("Enrolment is open — it closes on", "ভর্তি চলছে — শেষ হবে"), at: closesAt, withTime: true }
            : !enrollmentOpen && opensAt
                ? { tone: "soon" as const, label: t("Enrolment opens on", "ভর্তি শুরু হবে"), at: opensAt, withTime: true }
                : upcoming
                    ? { tone: upcoming.kind === "enrol" ? ("soon" as const) : ("class" as const), label: upcoming.label, at: upcoming.at, withTime: upcoming.withTime }
                    : null;
    const spotTime = spot?.at.getTime();

    const closedNote =
        !enrollmentOpen && !opensAt
            ? t("Enrolment for this batch has closed. The next batch will be announced soon.", "এই ব্যাচে ভর্তি বন্ধ। পরের ব্যাচের তারিখ শিগগিরই জানানো হবে।")
            : null;

    return (
        <div ref={rootRef} className="@container space-y-4">
            {spot && (
                <div data-bs-spot className="editor flex flex-col gap-5 rounded-card border border-editor-line p-5 @lg:flex-row @lg:items-center @lg:p-6">
                    <div className="shrink-0 border-editor-line @lg:border-r @lg:pr-6">
                        <p lang="en" className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-editor-gutter">
                            {MONTH.format(spot.at)} · {weekday.short.format(spot.at)}
                        </p>
                        <p className="mt-1 font-mono text-5xl font-semibold leading-none tabular-nums text-editor-fg">{DAY_OF_MONTH.format(spot.at)}</p>
                        {spot.withTime && <p className="mt-2 font-mono text-xs text-editor-muted">{TIME.format(spot.at)}</p>}
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className={cn("flex items-center gap-2 text-sm font-semibold", spot.tone === "open" ? "text-syn-string" : "text-syn-keyword")}>
                            <span className="relative flex size-2" aria-hidden>
                                <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
                                <span className="relative size-2 rounded-full bg-current" />
                            </span>
                            {spot.label}
                        </p>
                        <p className="mt-1.5 text-xl font-bold text-editor-fg sm:text-2xl">
                            {spot.withTime ? formatBatchDateTime(spot.at) : formatBatchDate(spot.at)}
                        </p>
                        <Countdown target={spot.at.getTime()} renderedAt={renderedAt} lang={lang} />
                    </div>
                </div>
            )}

            {closedNote && (
                <p data-bs-spot className="rounded-card border border-border bg-surface px-5 py-4 font-medium text-muted-foreground">
                    {closedNote}
                </p>
            )}

            {rows.length > 0 && (
                <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
                    {rows.map((row) => (
                        <div key={row.key}>
                            <div className="flex flex-wrap items-center gap-2.5 bg-surface px-5 py-3">
                                <h3 className="font-semibold">{row.label}</h3>
                                {row.standing && (
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-mono text-[0.7rem] font-semibold",
                                            row.standing.tone === "open" && "bg-success/10 text-success-ink",
                                            row.standing.tone === "live" && "bg-primary/10 text-primary",
                                            row.standing.tone === "soon" && "border border-primary/30 text-primary",
                                            row.standing.tone === "over" && "bg-secondary text-muted-foreground",
                                        )}
                                    >
                                        <span className="size-1.5 rounded-full bg-current" aria-hidden />
                                        {row.standing.text}
                                    </span>
                                )}
                            </div>

                            {row.milestones.length === 0 ? (
                                <p className="px-5 py-4 text-sm text-muted-foreground">{t("Dates to be announced", "তারিখ শিগগিরই জানানো হবে")}</p>
                            ) : (
                                <ol className="py-2">
                                    {row.milestones.map((milestone) => {
                                        const time = milestone.at.getTime();
                                        const gone = time <= now;
                                        const isNext = time === spotTime;
                                        return (
                                            <li
                                                key={`${milestone.kind}-${time}`}
                                                data-bs-line
                                                className={cn(
                                                    "grid grid-cols-[1.25rem_minmax(0,1fr)] items-baseline gap-x-3 px-5 py-2 text-sm @md:grid-cols-[1.25rem_11rem_minmax(0,1fr)]",
                                                    isNext && "bg-primary/5",
                                                    gone && "text-muted-foreground",
                                                )}
                                            >
                                                <span aria-hidden className={cn("font-mono text-xs", gone ? "text-syn-string" : isNext ? "text-primary" : "text-syn-comment")}>
                                                    {gone ? <Check className="size-3.5" strokeWidth={3} /> : isNext ? "▶" : "○"}
                                                </span>
                                                <span lang="en" className={cn("font-mono text-xs tabular-nums @md:order-none", !gone && "text-foreground")}>
                                                    {DAY_OF_MONTH.format(milestone.at)} {MONTH.format(milestone.at)} · {weekday.short.format(milestone.at)}
                                                    {milestone.withTime && <span className="text-muted-foreground"> {TIME.format(milestone.at)}</span>}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "col-start-2 font-medium @md:col-start-auto",
                                                        milestone.kind === "enrol" ? "text-success-ink" : "text-primary-ink",
                                                        gone && "text-muted-foreground",
                                                    )}
                                                >
                                                    {milestone.label}
                                                </span>
                                                <span className="sr-only">
                                                    {milestone.withTime ? formatBatchDateTime(milestone.at) : formatBatchDate(milestone.at)}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** "54", "০২" — a count in the page's digits, padded. */
const digitsIn = (lang: UiLanguage, n: number, pad: number) => {
    const text = String(n).padStart(pad, "0");
    return lang === "bn" ? text.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : text;
};

/**
 * How long is left until `target`, to the second, as one mono line —
 * `3d 04h 12m 08s` — ticking on its own every second, so the schedule around
 * it doesn't re-render with it. It starts from the server's render time, so
 * hydration matches, and stops at zero.
 */
function Countdown({ target, renderedAt, lang }: { target: number; renderedAt?: number; lang: UiLanguage }) {
    const [now, setNow] = useState(() => renderedAt ?? Date.now());

    useEffect(() => {
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const t = (en: string, bn: string) => (lang === "bn" ? bn : en);
    const left = Math.max(0, target - now);
    const parts = [
        { value: Math.floor(left / DAY), pad: 1, unit: t("d", "দিন") },
        { value: Math.floor((left % DAY) / HOUR), pad: 2, unit: t("h", "ঘ") },
        { value: Math.floor((left % HOUR) / MINUTE), pad: 2, unit: t("m", "মি") },
        { value: Math.floor((left % MINUTE) / 1000), pad: 2, unit: t("s", "সে") },
    ];

    return (
        <p role="timer" aria-live="off" className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono">
            {parts.map((part) => (
                <span key={part.unit} className="whitespace-nowrap">
                    <span className="text-2xl font-semibold tabular-nums text-syn-number">{digitsIn(lang, part.value, part.pad)}</span>
                    <span className="ml-0.5 text-xs text-editor-muted">{part.unit}</span>
                </span>
            ))}
            <span className="text-sm text-editor-muted">{t("to go", "বাকি")}</span>
        </p>
    );
}
