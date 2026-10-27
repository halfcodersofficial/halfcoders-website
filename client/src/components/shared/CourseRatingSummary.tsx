import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RatingSummary } from "@/types/domain.types";

const bn = (value: number) => value.toLocaleString("bn-BD");

/** Five stars, filled to `value` (half stars round to the nearer whole). */
export function Stars({ value, className }: { value: number; className?: string }) {
    const filled = Math.round(value);
    return (
        <span className={cn("inline-flex gap-0.5", className)} aria-hidden>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={cn("size-4", star <= filled ? "fill-syn-number text-syn-number" : "fill-transparent text-muted-foreground/40")} />
            ))}
        </span>
    );
}

/**
 * The course's rating from its students' published reviews: the average,
 * how many, and how they spread from five stars to one.
 */
export default function CourseRatingSummary({ summary }: { summary: RatingSummary }) {
    if (summary.count === 0 || summary.average === null) return null;
    const most = Math.max(...summary.spread.map((row) => row.count), 1);
    return (
        <div className="grid gap-6 rounded-card border border-border bg-card p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-6">
            <div className="text-center sm:pr-6 sm:text-left">
                <p className="font-mono text-5xl font-semibold tracking-tight tabular-nums">{bn(summary.average)}</p>
                <Stars value={summary.average} className="mt-2" />
                <p className="mt-1.5 text-sm text-muted-foreground" aria-label={`${summary.count} ratings, average ${summary.average} of 5`}>
                    {bn(summary.count)}টি রেটিং
                </p>
            </div>
            <ul className="space-y-1.5" aria-label="রেটিং বিভাজন">
                {summary.spread.map((row) => (
                    <li key={row.stars} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
                        <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
                            {bn(row.stars)} <Star className="size-3.5 fill-syn-number text-syn-number" aria-hidden />
                        </span>
                        <span className="h-2 overflow-hidden rounded-[1px] bg-secondary">
                            <span className="block h-full bg-syn-number" style={{ width: `${(row.count / most) * 100}%` }} />
                        </span>
                        <span className="text-right tabular-nums text-muted-foreground">{bn(row.count)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
