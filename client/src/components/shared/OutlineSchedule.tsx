"use client";

import { BookOpen, CalendarOff, CalendarRange, Check, ChevronLeft, ChevronRight, Dumbbell, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ClassModeTag } from "@/components/shared/CourseClassification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import type { OutlineItem, OutlineItemKind, OutlineWeek } from "@/types/domain.types";

export const OUTLINE_KIND_META: Record<OutlineItemKind, { label: string; icon: LucideIcon }> = {
    MODULE: { label: "Module", icon: BookOpen },
    PRACTICE: { label: "Practice day", icon: Dumbbell },
    NO_MODULE: { label: "No module", icon: CalendarOff },
};

/**
 * What the outline says about an item — a function of the clock and nothing
 * else. It never reflects whether a real module has been published; that's
 * the Module Manager's business, on its own dates.
 */
export const outlineItemStatus = (item: OutlineItem, now: number) => {
    if (item.kind === "NO_MODULE") return { label: "No module", variant: "secondary" as const };
    if (!item.scheduledAt) return { label: "Date TBA", variant: "secondary" as const };
    return new Date(item.scheduledAt).getTime() <= now
        ? { label: "Published", variant: "success" as const }
        : { label: "Upcoming", variant: "warning" as const };
};

export const weekLabelFor = (week: Pick<OutlineWeek, "order">, label: string) =>
    `${label} ${String(week.order).padStart(2, "0")}`;

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const formatItemTime = (value: string) =>
    new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** "in 3 days", "in 2 hours", "tomorrow" — how far off a planned time is. */
export const relativeTime = (target: number, now: number) => {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const minutes = (target - now) / 60_000;
    if (Math.abs(minutes) < 60) return rtf.format(Math.round(minutes), "minute");
    const hours = minutes / 60;
    if (Math.abs(hours) < 24) return rtf.format(Math.round(hours), "hour");
    return rtf.format(Math.round(hours / 24), "day");
};

/** Items already arrive in date order; this only groups consecutive same-day ones. */
const groupByDay = (items: OutlineItem[]) => {
    const groups: { key: string; date: Date | null; items: OutlineItem[] }[] = [];
    for (const item of items) {
        const date = item.scheduledAt ? new Date(item.scheduledAt) : null;
        const key = date ? dayKey(date) : "tba";
        const last = groups.at(-1);
        if (last && last.key === key) last.items.push(item);
        else groups.push({ key, date, items: [item] });
    }
    return groups;
};

/** The week a student most likely wants: the first with something still to come. */
const initialWeekIndex = (weeks: OutlineWeek[], now: number) => {
    const upcoming = weeks.findIndex((week) =>
        week.items.some((item) => item.scheduledAt && new Date(item.scheduledAt).getTime() > now),
    );
    if (upcoming !== -1) return upcoming;
    return Math.max(0, weeks.length - 1);
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const isReleased = (item: OutlineItem, now: number) =>
    Boolean(item.scheduledAt) && new Date(item.scheduledAt!).getTime() <= now;

/** A week's modules and practice days (not its "no module" days), and how many of them are out. */
export const weekCounts = (week: OutlineWeek, now: number) => {
    const items = week.items.filter((item) => item.kind !== "NO_MODULE");
    return { total: items.length, released: items.filter((item) => isReleased(item, now)).length };
};

/** "30 Sept – 6 Oct", from a week's first and last dated items. */
const weekRange = (week: OutlineWeek) => {
    const dates = week.items.filter((item) => item.scheduledAt).map((item) => new Date(item.scheduledAt!));
    if (dates.length === 0) return "Dates TBA";
    const fmt = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const first = fmt(dates[0]);
    const last = fmt(dates[dates.length - 1]);
    return first === last ? first : `${first} – ${last}`;
};

/** A date as a tear-off calendar leaf: weekday, a large day number, the month. */
export function DayLeaf({ date, isToday = false, tone = "light" }: { date: Date | null; isToday?: boolean; tone?: "light" | "dark" }) {
    return (
        <div
            className={cn(
                "flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-xl text-center shadow-sm",
                tone === "dark" ? "bg-white/10 ring-1 ring-white/15" : "border border-border bg-card",
                isToday && "border-transparent ring-2 ring-primary",
            )}
        >
            <span
                className={cn(
                    "w-full py-0.5 text-[0.625rem] font-bold uppercase tracking-wider",
                    isToday ? "bg-brand text-white" : tone === "dark" ? "bg-white/10 text-white/80" : "bg-secondary text-muted-foreground",
                )}
            >
                {isToday ? "Today" : date ? date.toLocaleDateString("en-GB", { weekday: "short" }) : "TBA"}
            </span>
            <span className="pt-1 text-2xl font-bold leading-none tabular-nums">{date ? date.getDate() : "—"}</span>
            <span className={cn("pb-1.5 text-[0.6875rem] font-medium", tone === "dark" ? "text-white/60" : "text-muted-foreground")}>
                {date ? date.toLocaleDateString("en-GB", { month: "short" }) : "date"}
            </span>
        </div>
    );
}

function EmptyOutline({ undated }: { undated: boolean }) {
    return (
        <div className="relative grid place-items-center overflow-hidden rounded-3xl border border-border bg-brand-soft px-6 py-16 text-center">
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-2xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-accent/15 blur-2xl" />
            <div className="relative max-w-md space-y-3">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary shadow-card">
                    <CalendarRange className="size-6" aria-hidden />
                </span>
                <p className="text-lg font-semibold">{undated ? "The outline is on its way" : "The schedule is being planned"}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {undated
                        ? "Your mentors haven't published this course's outline yet. It will appear here as soon as they do."
                        : "Your mentors haven't planned the schedule yet. It will appear here, week by week, as soon as they do."}
                </p>
            </div>
        </div>
    );
}

/**
 * The planned outline as a student reads it. Used by the student outline page
 * and by the Outline Maker's "Student view", so staff preview exactly what
 * students get.
 *
 * A bootcamp outline is a strip of weeks, then the selected week as a
 * day-by-day timeline — the student wants "this week". `undated` is a
 * traditional (self-paced) course's outline: no dates and no "this week", so
 * it reads as a whole syllabus instead — see `Syllabus`.
 */
export default function OutlineSchedule({
    weeks,
    weekLabel,
    undated = false,
}: {
    weeks: OutlineWeek[];
    weekLabel: string;
    undated?: boolean;
}) {
    if (weeks.length === 0) return <EmptyOutline undated={undated} />;
    return undated ? <Syllabus weeks={weeks} weekLabel={weekLabel} /> : <DatedSchedule weeks={weeks} weekLabel={weekLabel} />;
}

function DatedSchedule({ weeks, weekLabel }: { weeks: OutlineWeek[]; weekLabel: string }) {
    const now = useNow();
    const [activeIndex, setActiveIndex] = useState(() => initialWeekIndex(weeks, Date.now()));
    const cardRefs = useRef(new Map<string, HTMLButtonElement>());

    const index = Math.min(activeIndex, Math.max(0, weeks.length - 1));
    const currentIndex = initialWeekIndex(weeks, now);
    const activeWeek = weeks[index];
    const todayKey = dayKey(new Date(now));

    const goTo = (next: number) => {
        const clamped = Math.max(0, Math.min(weeks.length - 1, next));
        setActiveIndex(clamped);
        const week = weeks[clamped];
        if (week) cardRefs.current.get(week.id)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    };

    return (
        <div className="space-y-6">
            {/* ---- The weeks, each with its dates and how much is out ---- */}
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    className="hidden shrink-0 rounded-full sm:inline-flex"
                    aria-label={`Previous ${weekLabel.toLowerCase()}`}
                    disabled={index === 0}
                    onClick={() => goTo(index - 1)}
                >
                    <ChevronLeft className="size-4" />
                </Button>

                <nav aria-label={`${weekLabel}s`} className="no-scrollbar flex flex-1 gap-3 overflow-x-auto scroll-smooth px-1 py-2">
                    {weeks.map((week, weekIndex) => {
                        const isActive = weekIndex === index;
                        const { total, released } = weekCounts(week, now);
                        const isDone = total > 0 && released === total;
                        const isCurrent = !isDone && weekIndex === currentIndex;
                        return (
                            <button
                                key={week.id}
                                ref={(el) => {
                                    if (el) cardRefs.current.set(week.id, el);
                                    else cardRefs.current.delete(week.id);
                                }}
                                type="button"
                                aria-current={isActive ? "true" : undefined}
                                onClick={() => goTo(weekIndex)}
                                className={cn(
                                    "flex w-48 shrink-0 flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-all",
                                    isActive
                                        ? "border-primary bg-card shadow-card ring-2 ring-primary/20"
                                        : "border-border bg-card/60 hover:border-primary/30 hover:bg-card",
                                )}
                            >
                                <span className="flex items-center justify-between gap-2">
                                    <span
                                        className={cn(
                                            "text-[0.6875rem] font-bold uppercase tracking-wider",
                                            isActive ? "text-primary" : "text-muted-foreground",
                                        )}
                                    >
                                        {weekLabelFor(week, weekLabel)}
                                    </span>
                                    {isDone ? (
                                        <span className="grid size-5 place-items-center rounded-full bg-success text-white">
                                            <Check className="size-3" strokeWidth={3} />
                                        </span>
                                    ) : isCurrent ? (
                                        <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-primary">
                                            <span className="relative flex size-2">
                                                <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                                                <span className="relative size-2 rounded-full bg-primary" />
                                            </span>
                                            Now
                                        </span>
                                    ) : null}
                                </span>
                                {week.title ? (
                                    <span className="truncate text-sm font-semibold">{week.title}</span>
                                ) : (
                                    <span className="truncate text-sm text-muted-foreground">
                                        {week.items.length > 0 ? plural(week.items.length, "item") : "Nothing planned yet"}
                                    </span>
                                )}
                                <span className="text-xs text-muted-foreground">{weekRange(week)}</span>
                                <span className="mt-1 flex items-center gap-2">
                                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                                        <span
                                            className="block h-full rounded-full bg-brand"
                                            style={{ width: `${total ? (released / total) * 100 : 0}%` }}
                                        />
                                    </span>
                                    <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
                                        {released}/{total}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <Button
                    variant="outline"
                    size="icon"
                    className="hidden shrink-0 rounded-full sm:inline-flex"
                    aria-label={`Next ${weekLabel.toLowerCase()}`}
                    disabled={index === weeks.length - 1}
                    onClick={() => goTo(index + 1)}
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>

            {/* ---- The selected week, day by day ------------------------- */}
            {activeWeek && (
                <section
                    aria-label={weekLabelFor(activeWeek, weekLabel)}
                    className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-7"
                >
                    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                                {activeWeek.title ? `${weekLabelFor(activeWeek, weekLabel)} · ` : ""}
                                {weekRange(activeWeek)}
                            </p>
                            <h2 className="mt-1 text-balance text-2xl font-bold tracking-tight">
                                {activeWeek.title ?? weekLabelFor(activeWeek, weekLabel)}
                            </h2>
                        </div>
                        {(() => {
                            const { total, released } = weekCounts(activeWeek, now);
                            return total > 0 ? (
                                <p className="text-sm tabular-nums text-muted-foreground">
                                    <span className="font-semibold text-foreground">{released}</span> of {total} released
                                </p>
                            ) : null;
                        })()}
                    </header>

                    {activeWeek.items.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">
                            Nothing planned for this {weekLabel.toLowerCase()} yet.
                        </p>
                    ) : (
                        <ol className="pt-6">
                            {groupByDay(activeWeek.items).map((group, groupIndex, groups) => {
                                const isToday = group.key === todayKey;
                                const isPast = group.items.every((item) => isReleased(item, now));
                                const previous = groups[groupIndex - 1];
                                // "Now" falls between the last day that's all out and the next one.
                                const nowBefore =
                                    !isPast &&
                                    !isToday &&
                                    Boolean(group.date) &&
                                    Boolean(previous) &&
                                    previous.items.every((item) => isReleased(item, now));
                                const isLast = groupIndex === groups.length - 1;

                                return (
                                    <li key={group.key}>
                                        {nowBefore && (
                                            <div className="flex items-center gap-3 pb-5 pl-17">
                                                <span className="rounded-full bg-brand px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-white shadow-sm">
                                                    Now
                                                </span>
                                                <span className="h-0.5 flex-1 rounded-full bg-linear-to-r from-primary to-transparent" />
                                            </div>
                                        )}
                                        <div className="relative grid grid-cols-[4rem_1fr] gap-4 pb-6">
                                            {/* The spine, from this day's leaf down to the next. */}
                                            {!isLast && (
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        "absolute bottom-0 left-8 top-20 w-0.5 -translate-x-1/2 rounded-full",
                                                        isPast ? "bg-primary/60" : "bg-border",
                                                    )}
                                                />
                                            )}
                                            <div className={cn(isPast && !isToday && "opacity-70")}>
                                                <DayLeaf date={group.date} isToday={isToday} />
                                            </div>
                                            <ul className="min-w-0 space-y-2.5">
                                                {group.items.map((item) => (
                                                    <ScheduleRow key={item.id} item={item} now={now} />
                                                ))}
                                            </ul>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            )}
        </div>
    );
}

function ScheduleRow({ item, now }: { item: OutlineItem; now: number }) {
    const meta = OUTLINE_KIND_META[item.kind];
    const Icon = meta.icon;
    const status = outlineItemStatus(item, now);
    const isGap = item.kind === "NO_MODULE";
    const released = isReleased(item, now);
    const when = item.scheduledAt && !isGap ? new Date(item.scheduledAt).getTime() : null;

    return (
        <li
            className={cn(
                "flex items-start gap-3 rounded-2xl border p-3.5",
                isGap
                    ? "border-dashed border-border bg-[repeating-linear-gradient(135deg,transparent_0_8px,var(--secondary)_8px_16px)] text-muted-foreground"
                    : released
                        ? "border-border bg-card"
                        : "border-primary/20 bg-primary/3",
            )}
        >
            <span
                className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    isGap ? "bg-card text-muted-foreground" : released ? "bg-brand text-white shadow-sm" : "bg-primary/10 text-primary",
                )}
                aria-hidden
            >
                <Icon className="size-4.5" />
            </span>

            <div className="min-w-0 flex-1">
                <p className={cn("font-semibold leading-snug", isGap && "font-medium")}>{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {meta.label}
                    {when !== null && ` · ${formatItemTime(item.scheduledAt!)}`}
                    {when !== null && !released && (
                        <span className="font-semibold text-primary"> · {relativeTime(when, now)}</span>
                    )}
                    {item.mode && !isGap && (
                        <>
                            {" · "}
                            <ClassModeTag mode={item.mode} className="align-bottom" />
                        </>
                    )}
                </p>
                {item.note && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.note}</p>}
            </div>

            {!isGap && (
                <Badge variant={status.variant} className="shrink-0 rounded-full">
                    {status.label}
                </Badge>
            )}
        </li>
    );
}

const WEEK_ANCHOR = "outline-week-";

/**
 * A traditional (self-paced) outline: there is no "this week" to land on, so
 * every week is on the page at once, like a syllabus — each as a numbered
 * route of its items, the number keeping the hand-dragged order readable.
 * When there's room, a sticky index of the weeks runs alongside, lighting up
 * the one being read (the same `IntersectionObserver` approach as
 * `CourseSectionNav`).
 *
 * Students only ever receive published items and never a no-module day (a
 * bootcamp thing); staff previewing get everything, so the same filter runs
 * here to keep the preview honest.
 */
function Syllabus({ weeks, weekLabel }: { weeks: OutlineWeek[]; weekLabel: string }) {
    const sections = weeks.map((week) => ({
        week,
        items: week.items.filter((item) => item.isPublished && item.kind !== "NO_MODULE"),
    }));
    const total = sections.reduce((sum, section) => sum + section.items.length, 0);
    const [activeId, setActiveId] = useState(weeks[0]?.id ?? "");

    const weekIds = weeks.map((week) => week.id).join(",");
    const hasItems = total > 0;
    useEffect(() => {
        if (!hasItems) return;
        const elements = weekIds
            .split(",")
            .map((id) => document.getElementById(`${WEEK_ANCHOR}${id}`))
            .filter((element): element is HTMLElement => element !== null);

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveId(visible[0].target.id.slice(WEEK_ANCHOR.length));
            },
            { rootMargin: "-80px 0px -55% 0px", threshold: 0 },
        );
        elements.forEach((element) => observer.observe(element));
        return () => observer.disconnect();
    }, [weekIds, hasItems]);

    if (!hasItems) return <EmptyOutline undated />;

    const jumpTo = (weekId: string) => {
        setActiveId(weekId);
        document.getElementById(`${WEEK_ANCHOR}${weekId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Container queries, not viewport ones: the same component sits full-width
    // on the student page and inside the admin console beside its sidebar.
    return (
        <div className="@container/syllabus">
            <div className="grid gap-6 @4xl/syllabus:grid-cols-[15rem_minmax(0,1fr)] @4xl/syllabus:gap-8">
                <nav aria-label={`${weekLabel}s`} className="hidden @4xl/syllabus:block">
                    <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-card">
                        <p className="px-3 pb-2 pt-2 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
                            {plural(weeks.length, weekLabel.toLowerCase())} · {plural(total, "item")}
                        </p>
                        <ol className="space-y-0.5">
                            {sections.map(({ week, items }) => {
                                const isActive = week.id === activeId;
                                return (
                                    <li key={week.id}>
                                        <button
                                            type="button"
                                            aria-current={isActive ? "true" : undefined}
                                            onClick={() => jumpTo(week.id)}
                                            className={cn(
                                                "flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors",
                                                isActive ? "bg-primary/10" : "hover:bg-secondary/60",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums",
                                                    isActive ? "bg-brand text-white" : "bg-secondary text-muted-foreground",
                                                )}
                                                aria-hidden
                                            >
                                                {week.order}
                                            </span>
                                            <span className="min-w-0">
                                                <span
                                                    className={cn(
                                                        "line-clamp-2 text-sm font-medium",
                                                        isActive ? "text-primary" : "text-foreground",
                                                    )}
                                                >
                                                    {week.title ?? weekLabelFor(week, weekLabel)}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {items.length > 0 ? plural(items.length, "item") : "Coming soon"}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </nav>

                <div className="min-w-0 space-y-5">
                    {sections.map(({ week, items }) => (
                        <SyllabusWeek key={week.id} week={week} items={items} weekLabel={weekLabel} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function SyllabusWeek({ week, items, weekLabel }: { week: OutlineWeek; items: OutlineItem[]; weekLabel: string }) {
    const label = weekLabelFor(week, weekLabel);
    const headingId = `${WEEK_ANCHOR}${week.id}-heading`;
    const modules = items.filter((item) => item.kind === "MODULE").length;
    const practiceDays = items.filter((item) => item.kind === "PRACTICE").length;
    const summary = [
        modules > 0 && plural(modules, "module"),
        practiceDays > 0 && plural(practiceDays, "practice day"),
    ].filter(Boolean);

    return (
        <section
            id={`${WEEK_ANCHOR}${week.id}`}
            aria-labelledby={headingId}
            className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-card"
        >
            <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-border px-5 pb-4 pt-5">
                <div className="min-w-0">
                    {week.title && (
                        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-primary">{label}</p>
                    )}
                    <h2 id={headingId} className="text-lg font-bold tracking-tight">
                        {week.title ?? label}
                    </h2>
                </div>
                {summary.length > 0 && <p className="text-xs text-muted-foreground">{summary.join(" · ")}</p>}
            </header>

            {items.length === 0 ? (
                <p className="px-5 py-5 text-sm text-muted-foreground">Coming soon.</p>
            ) : (
                <ol className="py-3">
                    {items.map((item, index) => {
                        const meta = OUTLINE_KIND_META[item.kind];
                        const Icon = meta.icon;
                        return (
                            <li key={item.id} className="relative flex items-start gap-3.5 px-5 py-2.5">
                                {/* The route between numbers. */}
                                {index < items.length - 1 && (
                                    <span aria-hidden className="absolute bottom-0 left-9 top-10 w-0.5 -translate-x-1/2 bg-border" />
                                )}
                                <span
                                    className="relative grid size-8 shrink-0 place-items-center rounded-full border-2 border-primary/30 bg-card text-xs font-bold tabular-nums text-primary"
                                    aria-hidden
                                >
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1 pt-1">
                                    <p className="text-sm font-semibold leading-snug">{item.title}</p>
                                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                        <Icon className="size-3.5" aria-hidden />
                                        {meta.label}
                                        {item.mode && (
                                            <>
                                                <span aria-hidden>·</span>
                                                <ClassModeTag mode={item.mode} />
                                            </>
                                        )}
                                    </p>
                                    {item.note && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.note}</p>}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
