"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { MentorAgendaItem, MentorDashboard } from "@/types/mentor.types";
import { clock, DAY_MS, dayMonthOf, dhakaDayKey, minuteOfDhakaDay, pad2, plural, weekdayOf } from "./time";

type Kind = MentorAgendaItem["kind"];

/** One primary mark per kind, told apart by shape rather than colour. */
function Marker({ kind, className }: { kind: Kind; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "block shrink-0",
                kind === "session" && "size-2 rounded-full bg-primary",
                kind === "release" && "size-2 rounded-full border-[1.5px] border-primary bg-card",
                kind === "deadline" && "size-1.75 rotate-45 bg-primary",
                className,
            )}
        />
    );
}

const LEGEND: { kind: Kind; label: string }[] = [
    { kind: "session", label: "Sessions" },
    { kind: "release", label: "Releases" },
    { kind: "deadline", label: "Deadlines" },
];

const RELEASE_LABEL = { ASSIGNMENT: "Assignment", PRACTICE: "Practice day" } as const;

/** What a row says, and where it opens. */
function describe(item: MentorAgendaItem, now: number) {
    const at = new Date(item.at).getTime();

    if (item.kind === "session") {
        const ended = !item.isLive && at < now;
        return {
            title: item.title || "Support session",
            meta: [
                item.host ? `${item.host.name}'s` : null,
                item.course.title,
                `until ${clock(item.endAt)}`,
                item.isLive
                    ? `live now · ${item.queue.waiting} waiting`
                    : ended
                      ? `${item.queue.done} helped`
                      : item.queue.waiting > 0
                        ? `${item.queue.waiting} in line`
                        : null,
            ],
            // Their own to fix; a co-mentor's is theirs.
            warning: !ended && !item.hasMeetingLink && !item.host ? "No Meet link yet" : null,
            href: ended ? `/mentor/support/${item.id}/history` : `/mentor/support/${item.id}`,
            action: item.isLive ? "Open board" : ended ? "Attendance" : "View",
            past: ended,
        };
    }

    if (item.kind === "release") {
        const what =
            item.itemType === "MODULE"
                ? `${item.course.moduleLabel} ${pad2(item.order ?? 0)}`
                : RELEASE_LABEL[item.itemType];
        return {
            title: `${what} · ${item.title}`,
            meta: [
                item.course.title,
                `${item.course.milestoneLabel} ${pad2(item.milestoneOrder)}`,
                item.released ? "released" : at <= now ? "going out now" : "goes out",
            ],
            warning: null,
            href: `/mentor/courses/${item.course.id}/modules`,
            action: "Modules",
            past: item.released,
        };
    }

    const passed = at < now;
    return {
        title: `“${item.title}” ${passed ? "was due" : "due"}`,
        meta: [
            item.course.title,
            `${item.handedIn} of ${Math.max(item.handedIn, item.expected)} handed in`,
            item.toReview > 0 ? `${item.toReview} to review` : null,
        ],
        warning: null,
        href: item.toReview > 0 ? `/mentor/reviews?course=${item.course.id}` : `/mentor/courses/${item.course.id}/modules`,
        action: item.toReview > 0 ? "Review" : "View",
        past: passed,
    };
}

/**
 * The mentor's week: today and the six days after it as a strip of days, each
 * drawn as a 24-hour line with its sessions, releases and deadlines marked
 * where they fall — then the chosen day as a list, with a "now" line through
 * today's. Days are Dhaka days, as the API counts them.
 */
export default function WeekAgenda({ agenda, now }: { agenda: MentorDashboard["agenda"]; now: number }) {
    const from = new Date(agenda.from).getTime();
    const todayKey = dhakaDayKey(now);
    const days = Array.from({ length: 7 }, (_, index) => {
        const key = dhakaDayKey(from + index * DAY_MS + DAY_MS / 2);
        return { key, items: agenda.items.filter((item) => dhakaDayKey(item.at) === key) };
    });

    const [selected, setSelected] = useState(() => Math.max(0, days.findIndex((day) => day.key === todayKey)));
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const day = days[selected] ?? days[0];
    const isToday = day.key === todayKey;
    const nextBusy = days.findIndex((entry, index) => index > selected && entry.items.length > 0);
    const weekIsEmpty = agenda.items.length === 0;

    const choose = (index: number) => {
        setSelected(index);
        tabs.current[index]?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
        const moves: Record<string, number> = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: days.length - 1 };
        if (!(event.key in moves)) return;
        event.preventDefault();
        choose((moves[event.key] + days.length) % days.length);
    };

    // Today's list gets a "now" line between what's happened and what's next.
    const nowIndex = isToday ? day.items.findIndex((item) => new Date(item.at).getTime() > now) : -1;

    return (
        <section aria-labelledby="week-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-6">
                <div>
                    <h2 id="week-title" className="text-lg font-semibold tracking-tight">
                        This week
                    </h2>
                    <p className="text-xs text-muted-foreground">Sessions on your courses, releases and deadlines · Dhaka time</p>
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Key">
                    {LEGEND.map((entry) => (
                        <li key={entry.kind} className="inline-flex items-center gap-1.5">
                            <Marker kind={entry.kind} />
                            {entry.label}
                        </li>
                    ))}
                </ul>
            </header>

            {/* 1px gaps over the border colour draw the dividers. */}
            <div role="tablist" aria-label="Day" onKeyDown={onKeyDown} className="grid grid-cols-7 gap-px border-y border-border bg-border">
                {days.map((entry, index) => {
                    const isSelected = index === selected;
                    const today = entry.key === todayKey;
                    const nowMinute = today ? minuteOfDhakaDay(now) : null;
                    return (
                        <button
                            key={entry.key}
                            ref={(element) => {
                                tabs.current[index] = element;
                            }}
                            type="button"
                            role="tab"
                            id={`agenda-tab-${index}`}
                            aria-selected={isSelected}
                            aria-controls="agenda-day"
                            aria-label={`${today ? "Today, " : ""}${weekdayOf(entry.key, true)} ${dayMonthOf(entry.key)}: ${
                                entry.items.length ? plural(entry.items.length, "item") : "nothing"
                            }`}
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => setSelected(index)}
                            className={cn(
                                "relative min-w-0 bg-card px-2 pb-3 pt-3 text-left outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:px-4",
                                isSelected ? "bg-primary/5" : "hover:bg-secondary/40",
                            )}
                        >
                            <span
                                aria-hidden
                                className={cn("absolute inset-x-0 top-0 h-0.5 bg-primary transition-opacity", isSelected ? "opacity-100" : "opacity-0")}
                            />
                            <span
                                className={cn(
                                    "block truncate text-[0.6875rem] font-semibold uppercase tracking-wider",
                                    today ? "text-primary" : "text-muted-foreground",
                                )}
                            >
                                {today ? "Today" : weekdayOf(entry.key)}
                            </span>
                            <span className={cn("mt-0.5 block text-xl font-bold tabular-nums sm:text-2xl", entry.items.length === 0 && "text-muted-foreground/70")}>
                                {Number(entry.key.slice(8))}
                            </span>

                            {/* The day as a line, midnight to midnight. */}
                            <span aria-hidden className="relative mt-3 block h-3">
                                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                                {nowMinute !== null && (
                                    <>
                                        <span
                                            className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-primary/50"
                                            style={{ width: `${(nowMinute / 1440) * 100}%` }}
                                        />
                                        <span
                                            className="absolute top-0 h-full w-px bg-foreground/60"
                                            style={{ left: `${(nowMinute / 1440) * 100}%` }}
                                        />
                                    </>
                                )}
                                {entry.items.map((item) => (
                                    <span
                                        key={`${item.kind}-${item.id}`}
                                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                                        style={{ left: `${(minuteOfDhakaDay(item.at) / 1440) * 100}%` }}
                                    >
                                        <Marker kind={item.kind} className="ring-2 ring-card" />
                                    </span>
                                ))}
                            </span>

                            <span className="mt-2 hidden truncate text-xs text-muted-foreground sm:block">
                                {entry.items.length ? plural(entry.items.length, "thing") : "Clear"}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div id="agenda-day" role="tabpanel" aria-labelledby={`agenda-tab-${selected}`} className="px-5 py-4 sm:px-6">
                <p className="text-sm font-semibold">
                    {isToday ? "Today" : weekdayOf(day.key, true)}
                    <span className="font-normal text-muted-foreground">
                        {" "}
                        · {isToday ? `${weekdayOf(day.key, true)} ` : ""}
                        {dayMonthOf(day.key)}
                    </span>
                </p>

                {day.items.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">
                        {weekIsEmpty ? (
                            <>
                                A clear week — no sessions, releases or deadlines in the next seven days.{" "}
                                <Link href="/mentor/support?new=1" className="font-medium text-primary hover:underline">
                                    Schedule a session
                                </Link>
                            </>
                        ) : (
                            <>
                                Nothing {isToday ? "today" : `on ${weekdayOf(day.key, true)}`}.
                                {nextBusy !== -1 && (
                                    <>
                                        {" "}
                                        <button
                                            type="button"
                                            onClick={() => choose(nextBusy)}
                                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                        >
                                            Next: {weekdayOf(days[nextBusy].key, true)} <ArrowRight className="size-3.5" aria-hidden />
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </p>
                ) : (
                    <ol className="mt-2">
                        {day.items.map((item, index) => {
                            const row = describe(item, now);
                            return (
                                <Fragment key={`${item.kind}-${item.id}`}>
                                    {index === nowIndex && <NowLine now={now} />}
                                    <li className="border-t border-border first:border-t-0">
                                        <Link
                                            href={row.href}
                                            className={cn(
                                                "group -mx-2 grid grid-cols-[4.25rem_0.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/40 sm:grid-cols-[5rem_0.75rem_minmax(0,1fr)_auto]",
                                                row.past && "opacity-60 hover:opacity-100",
                                            )}
                                        >
                                            <time dateTime={item.at} className="text-sm tabular-nums text-muted-foreground">
                                                {clock(item.at)}
                                            </time>
                                            <span className="grid place-items-center">
                                                <Marker kind={item.kind} />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">{row.title}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {row.meta.filter(Boolean).join(" · ")}
                                                    {row.warning && (
                                                        <span className="font-medium text-amber-700 dark:text-amber-400"> · {row.warning}</span>
                                                    )}
                                                </span>
                                            </span>
                                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                                                <span className="max-sm:sr-only">{row.action}</span>
                                                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                                            </span>
                                        </Link>
                                    </li>
                                </Fragment>
                            );
                        })}
                        {isToday && nowIndex === -1 && <NowLine now={now} />}
                    </ol>
                )}
            </div>
        </section>
    );
}

function NowLine({ now }: { now: number }) {
    return (
        <li aria-hidden className="flex items-center gap-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Now · {clock(now)}
            <span className="h-px flex-1 bg-primary/30" />
        </li>
    );
}
