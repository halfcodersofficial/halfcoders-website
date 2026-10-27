"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface TrendSeries<K extends string> {
    key: K;
    label: string;
    fill: string;
    stroke: string;
}

/**
 * Categorical slots 1–3 of the data-viz reference palette (blue, orange,
 * aqua), each with its dark-surface step — validated as a set for three
 * series in both modes. Aqua is under 3:1 on the light surface, so the table
 * view below is required, not optional. Pair them with a chart's series in
 * this order; the first is the bottom of the stack.
 */
export const TREND_COLORS = [
    { fill: "bg-[#2a78d6] dark:bg-[#3987e5]", stroke: "border-[#2a78d6] dark:border-[#3987e5]" },
    { fill: "bg-[#eb6834] dark:bg-[#d95926]", stroke: "border-[#eb6834] dark:border-[#d95926]" },
    { fill: "bg-[#1baf7a] dark:bg-[#199e70]", stroke: "border-[#1baf7a] dark:border-[#199e70]" },
] as const;

type Day<K extends string> = { date: string } & Record<K, number>;

/** A clean y-axis step — the top is twice it, so the midline is a whole number too. */
const niceStep = (value: number) => {
    if (value <= 1) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const fraction = value / magnitude;
    return ([1, 2, 3, 4, 5, 6, 8, 10].find((step) => fraction <= step) ?? 10) * magnitude;
};

/** Centred over its column, but kept inside the chart near either edge. */
const tooltipPosition = (fraction: number) => ({
    left: `calc(2rem + (100% - 2rem) * ${fraction})`,
    transform: fraction < 0.2 ? "translateX(-1rem)" : fraction > 0.8 ? "translateX(calc(-100% + 1rem))" : "translateX(-50%)",
});

/** "YYYY-MM-DD" (a Dhaka day) as "12 Sep". */
const dayLabel = (date: string, withWeekday = false) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        ...(withWeekday ? { weekday: "short" } : {}),
    });

/**
 * Activity per day as stacked columns, one colour per series — a mentor's
 * content changes, reviews and support sessions; a student's lessons,
 * submissions and quizzes. Each column carries its own tooltip on hover and
 * keyboard focus; the table view holds every value.
 */
export function TrendChart<K extends string>({
    trend,
    series: SERIES,
    emptyMessage,
    format = String,
    formatTick = format,
}: {
    trend: Day<K>[];
    /** Up to three, coloured from `TREND_COLORS` in order. One needs no legend — the title names it. */
    series: TrendSeries<K>[];
    emptyMessage: string;
    /** A value as the tooltip and table show it — "৳1,099" rather than 1099. */
    format?: (value: number) => string;
    /** The same, short enough for the y-axis — "৳1.1K". */
    formatTick?: (value: number) => string;
}) {
    const total = (day: Day<K>) => SERIES.reduce((sum, { key }) => sum + day[key], 0);
    const describe = (day: Day<K>) =>
        `${dayLabel(day.date, true)}: ${SERIES.map(({ key, label }) => `${format(day[key])} ${label.toLowerCase()}`).join(", ")}`;

    const [active, setActive] = useState<number | null>(null);
    // One tab stop for the whole chart; arrow keys move between days.
    const [focusIndex, setFocusIndex] = useState(trend.length - 1);
    const columns = useRef<(HTMLDivElement | null)[]>([]);

    const moveFocus = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
        const next =
            event.key === "ArrowLeft" ? index - 1
                : event.key === "ArrowRight" ? index + 1
                    : event.key === "Home" ? 0
                        : event.key === "End" ? trend.length - 1
                            : null;
        if (next === null || next < 0 || next >= trend.length) return;
        event.preventDefault();
        setFocusIndex(next);
        columns.current[next]?.focus();
    };

    const peak = Math.max(0, ...trend.map(total));
    const step = niceStep(peak / 2);
    const top = step * 2;
    const empty = peak === 0;
    // Five evenly spread date labels: first, last and three between.
    const labelled = new Set([0, 7, 14, 21, trend.length - 1]);
    const activeDay = active !== null ? trend[active] : null;

    return (
        <figure className="space-y-3">
            {SERIES.length > 1 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
                    {SERIES.map((series) => (
                        <li key={series.key} className="flex items-center gap-1.5">
                            <span className={cn("size-2.5 rounded-[2px]", series.fill)} aria-hidden />
                            {series.label}
                        </li>
                    ))}
                </ul>
            )}

            <div className="relative h-44 pl-8">
                {/* Hairline grid at 0, the midline and the top — solid, one step off the surface. */}
                {[0, step, top].map((tick) => (
                    <div
                        key={tick}
                        className="pointer-events-none absolute inset-x-0 left-8 border-t border-border"
                        style={{ bottom: `${(tick / top) * 100}%` }}
                        aria-hidden
                    >
                        <span className="absolute -left-8 w-8 -translate-y-1/2 pr-2 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatTick(tick)}
                        </span>
                    </div>
                ))}

                {empty && (
                    <p className="absolute inset-0 left-8 grid place-items-center text-sm text-muted-foreground">
                        {emptyMessage}
                    </p>
                )}

                <div className="relative flex h-full items-end" onPointerLeave={() => setActive(null)}>
                    {trend.map((day, index) => {
                        const sum = total(day);
                        return (
                            // The whole column band is the hit target, not just the painted bar.
                            <div
                                key={day.date}
                                ref={(element) => {
                                    columns.current[index] = element;
                                }}
                                role="img"
                                tabIndex={index === focusIndex ? 0 : -1}
                                aria-label={describe(day)}
                                onPointerEnter={() => setActive(index)}
                                onFocus={() => {
                                    setActive(index);
                                    setFocusIndex(index);
                                }}
                                onKeyDown={(event) => moveFocus(event, index)}
                                onBlur={() => setActive(null)}
                                className={cn(
                                    "flex h-full flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active === index && "bg-secondary/70",
                                )}
                            >
                                {sum > 0 && (
                                    // A 2px surface gap between segments; the stack's rounded top is its data end.
                                    <div
                                        className="flex w-3/5 max-w-6 flex-col-reverse gap-0.5 overflow-hidden rounded-t-lg"
                                        style={{ height: `${(sum / top) * 100}%` }}
                                    >
                                        {SERIES.filter(({ key }) => day[key] > 0).map((series) => (
                                            <div
                                                key={series.key}
                                                className={series.fill}
                                                style={{ flex: `${day[series.key]} 1 0` }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {activeDay && active !== null && (
                    <div
                        className="pointer-events-none absolute bottom-full z-10 mb-2 min-w-40 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md"
                        style={tooltipPosition((active + 0.5) / trend.length)}
                        aria-hidden
                    >
                        <p className="mb-1.5 font-medium">{dayLabel(activeDay.date, true)}</p>
                        <ul className="space-y-1">
                            {SERIES.map((series) => (
                                <li key={series.key} className="flex items-center gap-2">
                                    <span className={cn("w-3 border-t-2", series.stroke)} />
                                    <span className="font-semibold tabular-nums">{format(activeDay[series.key])}</span>
                                    <span className="text-muted-foreground">{series.label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="flex pl-8 text-[11px] text-muted-foreground" aria-hidden>
                {trend.map((day, index) => (
                    <span key={day.date} className="relative flex-1">
                        {labelled.has(index) && (
                            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{dayLabel(day.date)}</span>
                        )}
                    </span>
                ))}
            </div>

            <details className="pt-3 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    Show as table
                </summary>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-secondary text-left text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 font-medium">Day</th>
                                {SERIES.map((series) => (
                                    <th key={series.key} className="px-3 py-2 text-right font-medium">
                                        {series.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {[...trend].reverse().map((day) => (
                                <tr key={day.date}>
                                    <td className="px-3 py-1.5">{dayLabel(day.date, true)}</td>
                                    {SERIES.map((series) => (
                                        <td key={series.key} className="px-3 py-1.5 text-right tabular-nums">
                                            {format(day[series.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </figure>
    );
}
