import { SegmentBar } from "@/components/admin/CourseSummary";
import { statusLabel } from "@/components/admin/StatusPill";
import type { AdminOrderCourse } from "@/types/admin.types";
import { ORDER_STATUS_ORDER, ORDER_TONE } from "./orderMeta";

/** A course's orders as one bar split by status, with a legend of the statuses it has. */
export function OrderStatusBar({
    counts,
    legend = true,
    short = false,
    className,
}: {
    counts: AdminOrderCourse["counts"];
    legend?: boolean;
    /** "awaiting" rather than "awaiting payment" — for a card in a tight grid. */
    short?: boolean;
    className?: string;
}) {
    return (
        <SegmentBar
            segments={ORDER_STATUS_ORDER.map((status) => ({
                key: status,
                count: counts[status],
                label: statusLabel("order", status).toLowerCase(),
                shortLabel: status === "PENDING" ? "awaiting" : undefined,
                fill: ORDER_TONE[status].fill,
            }))}
            legend={legend}
            short={short}
            emptyLabel="No orders yet"
            className={className}
        />
    );
}
