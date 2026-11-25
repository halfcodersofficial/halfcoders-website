"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { TREND_COLORS, TrendChart } from "@/components/admin/TrendChart";
import { cn, formatBDT } from "@/lib/utils";
import type { AdminDashboard, AdminDashboardMetric } from "@/types/admin.types";
import Panel from "./Panel";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** A head-count average: one decimal while it's small ("1.4"), whole after. */
const countAverage = (value: number) => (value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10));

const METRICS: {
    key: AdminDashboardMetric;
    label: string;
    /** For the chart's empty state: "No revenue in the last 30 days." */
    noun: string;
    format: (value: number) => string;
    formatTick: (value: number) => string;
    formatAverage: (value: number) => string;
}[] = [
    {
        key: "revenue",
        label: "Revenue",
        noun: "revenue",
        format: formatBDT,
        formatTick: (value) => `৳${compact.format(value)}`,
        formatAverage: (value) => formatBDT(Math.round(value)),
    },
    { key: "enrolments", label: "Enrolments", noun: "enrolments", format: String, formatTick: (value) => compact.format(value), formatAverage: countAverage },
    { key: "learners", label: "New learners", noun: "new learners", format: String, formatTick: (value) => compact.format(value), formatAverage: countAverage },
    {
        key: "completions",
        label: "Completions",
        noun: "completed courses",
        format: String,
        formatTick: (value) => compact.format(value),
        formatAverage: countAverage,
    },
];

/** The change against the previous 30 days — every one of these is better when it goes up. */
const changeOf = ({ current, previous }: { current: number; previous: number }) => {
    if (previous === 0) return current === 0 ? { text: "No change", tone: "flat" as const } : { text: "Up from none", tone: "up" as const };
    const percent = Math.round(((current - previous) / previous) * 100);
    if (percent === 0) return { text: "No change", tone: "flat" as const };
    return { text: `${percent > 0 ? "+" : ""}${percent}%`, tone: percent > 0 ? ("up" as const) : ("down" as const) };
};

/** "YYYY-MM-DD" (a Dhaka day) as "Tue, 18 Nov". */
const dayLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/**
 * Thirty days as a small line under each figure, so all four trends show at
 * once — the chart beneath shows the chosen one in full. Scaled to its own
 * peak: it's the shape that matters here, not the size.
 */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
    const peak = Math.max(1, ...values);
    const last = values.length - 1;
    const points = values.map((value, index) => `${(index / last) * 100},${23 - (value / peak) * 21}`).join(" ");

    return (
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={cn("block h-7 w-full overflow-visible", className)} aria-hidden>
            <polygon points={`0,24 ${points} 100,24`} className="fill-current opacity-10" />
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

/**
 * The last 30 days: four figures, each with its change against the 30 days
 * before and a line of its days, that double as tabs for the chart beneath —
 * one measure at a time, because revenue and head-counts don't share an axis.
 * The foot reads the chosen measure in plain numbers: a usual day, the best
 * day, and today so far.
 */
export default function PeriodPanel({ data }: { data: AdminDashboard }) {
    const [metric, setMetric] = useState<AdminDashboardMetric>("revenue");
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const active = METRICS.find((entry) => entry.key === metric) ?? METRICS[0];

    const days = data.trend;
    const values = days.map((day) => day[active.key]);
    const average = days.length ? data.period[active.key].current / days.length : 0;
    const bestIndex = values.reduce((best, value, index) => (value > values[best] ? index : best), 0);
    const best = values[bestIndex] > 0 ? days[bestIndex] : null;
    const today = days.at(-1);

    // One tab stop for the row; the arrow keys move along it (the WAI-ARIA tabs pattern).
    const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const next =
            event.key === "ArrowRight"
                ? (index + 1) % METRICS.length
                : event.key === "ArrowLeft"
                  ? (index - 1 + METRICS.length) % METRICS.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? METRICS.length - 1
                      : null;
        if (next === null) return;
        event.preventDefault();
        setMetric(METRICS[next].key);
        tabs.current[next]?.focus();
    };

    return (
        <Panel
            id="period-title"
            title="Last 30 days"
            file="last-30-days.json"
            actions={<span className="hidden text-xs text-muted-foreground sm:inline">Compared with the 30 days before · Dhaka time</span>}
            footer={
                <>
                    <span>
                        Daily average <span className="font-semibold text-foreground">{active.formatAverage(average)}</span>
                    </span>
                    <span>
                        Best day{" "}
                        <span className="font-semibold text-foreground">
                            {best ? `${dayLabel(best.date)} · ${active.format(best[active.key])}` : "None yet"}
                        </span>
                    </span>
                    {today && (
                        <span>
                            Today so far <span className="font-semibold text-foreground">{active.format(today[active.key])}</span>
                        </span>
                    )}
                </>
            }
        >
            <div role="tablist" aria-label="Measure" className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
                {METRICS.map((entry, index) => {
                    const selected = entry.key === metric;
                    const numbers = data.period[entry.key];
                    const change = changeOf(numbers);
                    const ChangeIcon = change.tone === "up" ? ArrowUpRight : change.tone === "down" ? ArrowDownRight : Minus;

                    return (
                        <button
                            key={entry.key}
                            ref={(element) => {
                                tabs.current[index] = element;
                            }}
                            type="button"
                            role="tab"
                            id={`period-tab-${entry.key}`}
                            aria-selected={selected}
                            aria-controls="period-chart"
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setMetric(entry.key)}
                            onKeyDown={(event) => moveFocus(event, index)}
                            className={cn(
                                "group relative min-w-0 px-5 pb-3 pt-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6",
                                index % 2 === 1 && "border-l border-border",
                                index >= 2 && "border-t border-border lg:border-t-0",
                                index === 2 && "lg:border-l",
                                selected ? "bg-primary/5" : "hover:bg-secondary/40",
                            )}
                        >
                            <span
                                aria-hidden
                                className={cn("absolute inset-x-0 top-0 h-0.5 bg-primary transition-opacity", selected ? "opacity-100" : "opacity-0")}
                            />
                            <span className={cn("block text-xs font-medium", selected ? "text-primary" : "text-muted-foreground")}>{entry.label}</span>
                            <span className="mt-1 block truncate font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-[1.6rem]">
                                {entry.format(numbers.current)}
                            </span>
                            <span
                                className={cn(
                                    "mt-1 flex flex-wrap items-center gap-x-1 text-xs font-medium",
                                    change.tone === "up" && "text-success",
                                    change.tone === "down" && "text-destructive",
                                    change.tone === "flat" && "text-muted-foreground",
                                )}
                            >
                                <ChangeIcon className="size-3.5" aria-hidden />
                                {change.text}
                                <span className="font-normal text-muted-foreground">· {entry.format(numbers.previous)} before</span>
                            </span>
                            <Sparkline
                                values={days.map((day) => day[entry.key])}
                                className={cn(
                                    "mt-3 transition-colors",
                                    selected ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground",
                                )}
                            />
                        </button>
                    );
                })}
            </div>

            <div id="period-chart" role="tabpanel" aria-labelledby={`period-tab-${metric}`} className="px-5 pb-5 pt-10 sm:px-6">
                <TrendChart
                    trend={days}
                    series={[{ key: active.key, label: active.label, ...TREND_COLORS[0] }]}
                    emptyMessage={`No ${active.noun} in the last 30 days.`}
                    format={active.format}
                    formatTick={active.formatTick}
                    reference={{ value: average, label: `Daily average ${active.formatTick(average)}` }}
                />
            </div>
        </Panel>
    );
}
