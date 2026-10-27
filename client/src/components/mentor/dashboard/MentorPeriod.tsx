import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { TREND_COLORS, TrendChart } from "@/components/admin/TrendChart";
import { cn } from "@/lib/utils";
import type { MentorDashboard } from "@/types/mentor.types";
import { formatHours } from "./time";

type Tone = "good" | "bad" | "flat";

/** The change against the previous 30 days, coloured by whether it's better — for a turnaround, lower is. */
function changeOf(current: number | null, previous: number | null, lowerIsBetter = false): { text: string; tone: Tone; up: boolean | null } {
    if (current === null || previous === null) return { text: previous === null ? "New" : "No change", tone: "flat", up: null };
    if (previous === 0) return current === 0 ? { text: "No change", tone: "flat", up: null } : { text: "Up from none", tone: "good", up: true };
    const percent = Math.round(((current - previous) / previous) * 100);
    if (percent === 0) return { text: "No change", tone: "flat", up: null };
    const better = lowerIsBetter ? percent < 0 : percent > 0;
    return { text: `${percent > 0 ? "+" : ""}${percent}%`, tone: better ? "good" : "bad", up: percent > 0 };
}

/**
 * The mentor's own last 30 days against the 30 before: reviews saved, how
 * long a hand-in typically waits for one, students helped in support and the
 * sessions held — with the work drawn day by day beneath.
 */
export default function MentorPeriod({ period, trend }: { period: MentorDashboard["period"]; trend: MentorDashboard["trend"] }) {
    const turnaround = period.turnaroundHours;
    const figures = [
        {
            label: "Reviews",
            value: String(period.reviews.current),
            before: `${period.reviews.previous} before`,
            change: changeOf(period.reviews.current, period.reviews.previous),
        },
        {
            label: "Typical turnaround",
            value: turnaround.current === null ? "—" : formatHours(turnaround.current),
            before: turnaround.previous === null ? "none before" : `${formatHours(turnaround.previous)} before`,
            change:
                turnaround.current === null
                    ? { text: "Nothing reviewed", tone: "flat" as const, up: null }
                    : changeOf(turnaround.current, turnaround.previous, true),
            hint: "Median, hand-in to your review",
        },
        {
            label: "Students helped",
            value: String(period.helped.current),
            before: `${period.helped.previous} before`,
            change: changeOf(period.helped.current, period.helped.previous),
        },
        {
            label: "Sessions held",
            value: String(period.sessions.current),
            before: `${period.sessions.previous} before`,
            change: changeOf(period.sessions.current, period.sessions.previous),
        },
    ];

    return (
        <section aria-labelledby="period-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 sm:px-6">
                <h2 id="period-title" className="text-lg font-semibold tracking-tight">
                    Your last 30 days
                </h2>
                <p className="text-xs text-muted-foreground">Against the 30 days before · days in Dhaka time</p>
            </header>

            <dl className="mt-4 grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-4">
                {figures.map((figure) => {
                    const Icon = figure.change.up === null ? Minus : figure.change.up ? ArrowUpRight : ArrowDownRight;
                    return (
                        <div key={figure.label} className="min-w-0 bg-card px-5 py-4 sm:px-6">
                            <dt className="truncate text-xs font-medium text-muted-foreground" title={figure.hint}>
                                {figure.label}
                            </dt>
                            <dd className="mt-1 truncate text-2xl font-bold tracking-tight tabular-nums sm:text-[1.75rem]">{figure.value}</dd>
                            <dd
                                className={cn(
                                    "mt-1 inline-flex flex-wrap items-center gap-x-1 text-xs font-medium",
                                    figure.change.tone === "good" && "text-success",
                                    figure.change.tone === "bad" && "text-destructive",
                                    figure.change.tone === "flat" && "text-muted-foreground",
                                )}
                            >
                                <Icon className="size-3.5" aria-hidden />
                                {figure.change.text}
                                <span className="font-normal text-muted-foreground">· {figure.before}</span>
                            </dd>
                            {figure.hint && <dd className="mt-0.5 hidden text-[0.6875rem] text-muted-foreground sm:block">{figure.hint}</dd>}
                        </div>
                    );
                })}
            </dl>

            <div className="px-5 pb-5 pt-10 sm:px-6">
                <TrendChart
                    trend={trend}
                    series={[
                        { key: "reviews", label: "Reviews", ...TREND_COLORS[0] },
                        { key: "helped", label: "Students helped", ...TREND_COLORS[1] },
                    ]}
                    emptyMessage="No reviews or support sessions in the last 30 days."
                />
            </div>
        </section>
    );
}
