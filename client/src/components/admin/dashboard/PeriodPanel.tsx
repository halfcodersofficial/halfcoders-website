"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useState } from "react";
import { TREND_COLORS, TrendChart } from "@/components/admin/TrendChart";
import { cn, formatBDT } from "@/lib/utils";
import type { AdminDashboard, AdminDashboardMetric } from "@/types/admin.types";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const METRICS: {
    key: AdminDashboardMetric;
    label: string;
    /** For the chart's empty state: "No revenue in the last 30 days." */
    noun: string;
    format: (value: number) => string;
    formatTick: (value: number) => string;
}[] = [
    { key: "revenue", label: "Revenue", noun: "revenue", format: formatBDT, formatTick: (value) => `৳${compact.format(value)}` },
    { key: "enrolments", label: "Enrolments", noun: "enrolments", format: String, formatTick: (value) => compact.format(value) },
    { key: "learners", label: "New learners", noun: "new learners", format: String, formatTick: (value) => compact.format(value) },
    { key: "completions", label: "Completions", noun: "completed courses", format: String, formatTick: (value) => compact.format(value) },
];

/** The change against the previous 30 days — every one of these is better when it goes up. */
const changeOf = ({ current, previous }: { current: number; previous: number }) => {
    if (previous === 0) return current === 0 ? { text: "No change", tone: "flat" as const } : { text: "Up from none", tone: "up" as const };
    const percent = Math.round(((current - previous) / previous) * 100);
    if (percent === 0) return { text: "No change", tone: "flat" as const };
    return { text: `${percent > 0 ? "+" : ""}${percent}%`, tone: percent > 0 ? ("up" as const) : ("down" as const) };
};

/**
 * The last 30 days: four figures, each with its change against the 30 days
 * before, that double as tabs for the chart beneath — one measure at a time,
 * because revenue and head-counts don't share an axis.
 */
export default function PeriodPanel({ data }: { data: AdminDashboard }) {
    const [metric, setMetric] = useState<AdminDashboardMetric>("revenue");
    const active = METRICS.find((entry) => entry.key === metric) ?? METRICS[0];

    return (
        <section aria-labelledby="period-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 sm:px-6">
                <h2 id="period-title" className="text-lg font-semibold tracking-tight">
                    Last 30 days
                </h2>
                <p className="text-xs text-muted-foreground">Against the 30 days before · days in Dhaka time</p>
            </header>

            <div role="tablist" aria-label="Measure" className="mt-4 grid grid-cols-2 border-y border-border lg:grid-cols-4">
                {METRICS.map((entry, index) => {
                    const selected = entry.key === metric;
                    const numbers = data.period[entry.key];
                    const change = changeOf(numbers);
                    const ChangeIcon = change.tone === "up" ? ArrowUpRight : change.tone === "down" ? ArrowDownRight : Minus;

                    return (
                        <button
                            key={entry.key}
                            type="button"
                            role="tab"
                            id={`period-tab-${entry.key}`}
                            aria-selected={selected}
                            aria-controls="period-chart"
                            onClick={() => setMetric(entry.key)}
                            className={cn(
                                "relative min-w-0 px-5 py-4 text-left transition-colors sm:px-6",
                                index % 2 === 1 && "border-l border-border",
                                index >= 2 && "border-t border-border lg:border-t-0",
                                index === 2 && "lg:border-l",
                                selected ? "bg-primary/5" : "hover:bg-secondary/40",
                            )}
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    "absolute inset-x-0 top-0 h-0.5 bg-primary transition-opacity",
                                    selected ? "opacity-100" : "opacity-0",
                                )}
                            />
                            <span className={cn("block text-xs font-medium", selected ? "text-primary" : "text-muted-foreground")}>
                                {entry.label}
                            </span>
                            <span className="mt-1 block truncate text-2xl font-bold tracking-tight sm:text-[1.75rem]">
                                {entry.format(numbers.current)}
                            </span>
                            <span
                                className={cn(
                                    "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                                    change.tone === "up" && "text-success",
                                    change.tone === "down" && "text-destructive",
                                    change.tone === "flat" && "text-muted-foreground",
                                )}
                            >
                                <ChangeIcon className="size-3.5" aria-hidden />
                                {change.text}
                                <span className="font-normal text-muted-foreground">
                                    {" "}
                                    · {entry.format(numbers.previous)} before
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            <div id="period-chart" role="tabpanel" aria-labelledby={`period-tab-${metric}`} className="px-5 pb-5 pt-10 sm:px-6">
                <TrendChart
                    trend={data.trend}
                    series={[{ key: active.key, label: active.label, ...TREND_COLORS[0] }]}
                    emptyMessage={`No ${active.noun} in the last 30 days.`}
                    format={active.format}
                    formatTick={active.formatTick}
                />
            </div>
        </section>
    );
}
