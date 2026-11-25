"use client";

import { useEffect, useRef } from "react";
import { cn, formatDate } from "@/lib/utils";
import type { StudentActivitySummary } from "@/types/admin.types";

type Day = StudentActivitySummary["calendar"][number];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How dark a day is: none, a little, some, a lot, a big day. */
const shade = (total: number) =>
    total === 0 ? "bg-secondary" : total <= 2 ? "bg-primary/25" : total <= 5 ? "bg-primary/50" : total <= 9 ? "bg-primary/75" : "bg-primary";

const describe = (day: Day) => {
    const parts = [
        day.lessons && `${day.lessons} ${day.lessons === 1 ? "lesson" : "lessons"}`,
        day.submissions && `${day.submissions} ${day.submissions === 1 ? "submission" : "submissions"}`,
        day.quizzes && `${day.quizzes} ${day.quizzes === 1 ? "quiz" : "quizzes"}`,
        day.practice && `${day.practice} practice ${day.practice === 1 ? "day" : "days"}`,
    ].filter(Boolean);
    return `${formatDate(`${day.date}T00:00:00`)} — ${parts.length ? parts.join(", ") : "nothing"}`;
};

/**
 * Half a year of learning, a square a day — lessons, submissions, quizzes and
 * practice days; the darker, the more. A day with something in it can be
 * clicked to read the feed from that day back. Opens scrolled to today.
 */
export function ActivityCalendar({ days, selected, onSelect }: { days: Day[]; selected: string | null; onSelect: (date: string) => void }) {
    const scroller = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
    }, []);

    if (days.length === 0) return null;

    // Columns of weeks, Sunday on top; the first one padded to its weekday.
    const lead = new Date(`${days[0].date}T00:00:00`).getDay();
    const cells: (Day | null)[] = [...Array.from({ length: lead }, () => null), ...days];
    const weeks: (Day | null)[][] = [];
    for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));

    // A month's name over the week its 1st falls in — and over the first week,
    // unless a new month starts too soon after it for both names to fit.
    const monthName = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { month: "short" });
    const startsMonth = (week: (Day | null)[]) => week.find((day): day is Day => day !== null && day.date.endsWith("-01"));
    const months = weeks.map((week, index) => {
        const first = startsMonth(week);
        if (first) return monthName(first.date);
        if (index === 0 && !weeks.slice(1, 3).some(startsMonth)) return monthName(days[0].date);
        return null;
    });

    return (
        <div className="space-y-2">
            <div ref={scroller} className="no-scrollbar overflow-x-auto pb-1">
                <div className="inline-flex min-w-full gap-2">
                    <div className="grid shrink-0 grid-rows-[1rem_repeat(7,0.75rem)] gap-0.75 pr-1 text-[10px] leading-3 text-muted-foreground" aria-hidden>
                        <span />
                        {WEEKDAYS.map((name, index) => (
                            <span key={name}>{index % 2 === 1 ? name : ""}</span>
                        ))}
                    </div>
                    <div className="flex gap-0.75" role="grid" aria-label="Activity, day by day">
                        {weeks.map((week, column) => (
                            <div key={column} className="grid grid-rows-[1rem_repeat(7,0.75rem)] gap-0.75" role="row">
                                <span className="whitespace-nowrap text-[10px] leading-4 text-muted-foreground" aria-hidden>
                                    {months[column] ?? ""}
                                </span>
                                {Array.from({ length: 7 }).map((_, row) => {
                                    const day = week[row] ?? null;
                                    if (!day) return <span key={row} className="size-3" />;
                                    const label = describe(day);
                                    return (
                                        <button
                                            key={row}
                                            type="button"
                                            role="gridcell"
                                            title={label}
                                            aria-label={label}
                                            disabled={day.total === 0}
                                            onClick={() => onSelect(day.date)}
                                            className={cn(
                                                "size-3 rounded-[3px] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:scale-125",
                                                shade(day.total),
                                                selected === day.date && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                                            )}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
                Less
                {[0, 1, 3, 6, 10].map((total) => (
                    <span key={total} className={cn("size-3 rounded-[3px]", shade(total))} />
                ))}
                More
            </div>
        </div>
    );
}
