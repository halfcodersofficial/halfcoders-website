import { CourseSummaryCard, CourseSummaryRow, since } from "@/components/admin/CourseSummary";
import { cn, formatBDT } from "@/lib/utils";
import type { AdminOrderCourse } from "@/types/admin.types";
import { OrderStatusBar } from "./OrderStatusBar";

/** The amber "needs you" marker — only on a course with orders to settle. */
function AwaitingPill({ summary, className }: { summary: AdminOrderCourse; className?: string }) {
    if (summary.counts.PENDING === 0) return null;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm",
                className,
            )}
        >
            <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
                <span className="relative size-1.5 rounded-full bg-white" />
            </span>
            {summary.counts.PENDING} awaiting · {formatBDT(summary.awaiting)}
        </span>
    );
}

const lastOrder = (summary: AdminOrderCourse) => since("Last order", summary.lastOrderAt, "No orders yet");

/** A course on the Payments overview, card layout. */
export function OrderCourseCard({ summary, href }: { summary: AdminOrderCourse; href: string }) {
    const { counts } = summary;
    return (
        <CourseSummaryCard
            course={summary.course}
            href={href}
            badge={<AwaitingPill summary={summary} className="px-2 py-0.5 text-[0.6875rem]" />}
            figure={
                <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">Collected</p>
                        <p className="truncate text-xl font-bold tabular-nums tracking-tight">{formatBDT(summary.collected)}</p>
                    </div>
                    <p className="shrink-0 text-right text-[0.6875rem] leading-tight text-muted-foreground">
                        <span className="block text-base font-semibold tabular-nums text-foreground">{counts.total}</span>
                        {counts.total === 1 ? "order" : "orders"}
                    </p>
                </div>
            }
            bar={<OrderStatusBar counts={counts} short />}
            note={lastOrder(summary)}
        />
    );
}

/** The same course as one row, for the list layout. */
export function OrderCourseRow({ summary, href }: { summary: AdminOrderCourse; href: string }) {
    const { counts } = summary;
    return (
        <CourseSummaryRow
            course={summary.course}
            href={href}
            badge={<AwaitingPill summary={summary} />}
            figure={
                <>
                    <p className="font-bold tabular-nums">{formatBDT(summary.collected)}</p>
                    <p className="text-xs text-muted-foreground">
                        {counts.total} {counts.total === 1 ? "order" : "orders"}
                        {counts.PENDING > 0 && (
                            <span className="font-semibold text-amber-600 md:hidden dark:text-amber-400"> · {counts.PENDING} due</span>
                        )}
                    </p>
                </>
            }
            bar={<OrderStatusBar counts={counts} legend={false} />}
            note={lastOrder(summary)}
        />
    );
}
