import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = NonNullable<BadgeProps["variant"]>;
/** `className` tints one entry beyond its variant — an order awaiting payment is amber, like the Payments screens mark it. */
type Entry = { label: string; variant: Variant; className?: string };

/**
 * Every status enum the console shows, with the word an admin should read
 * and the colour it should carry. One table so "PENDING" is "Awaiting
 * payment" on the dashboard, the orders screen and the student detail alike
 * — the raw enum never reaches the screen.
 */
const STATUS = {
    course: {
        PUBLISHED: { label: "Published", variant: "success" },
        DRAFT: { label: "Draft", variant: "secondary" },
        ARCHIVED: { label: "Archived", variant: "warning" },
    },
    user: {
        ACTIVE: { label: "Active", variant: "success" },
        BLOCKED: { label: "Blocked", variant: "destructive" },
        DELETED: { label: "Deleted", variant: "secondary" },
    },
    order: {
        PENDING: {
            label: "Awaiting payment",
            variant: "warning",
            className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        },
        PAID: { label: "Paid", variant: "success" },
        FAILED: { label: "Failed", variant: "destructive" },
        CANCELLED: { label: "Cancelled", variant: "secondary" },
        REFUNDED: { label: "Refunded", variant: "secondary" },
    },
    enrollment: {
        ACTIVE: { label: "Active", variant: "default" },
        COMPLETED: { label: "Completed", variant: "success" },
        CANCELLED: { label: "Cancelled", variant: "destructive" },
        EXPIRED: { label: "Expired", variant: "secondary" },
    },
    certificate: {
        ISSUED: { label: "Valid", variant: "success" },
        REVOKED: { label: "Revoked", variant: "destructive" },
    },
    supportSession: {
        SCHEDULED: { label: "Scheduled", variant: "default" },
        LIVE: { label: "Live", variant: "success" },
        ENDED: { label: "Ended", variant: "secondary" },
        CANCELLED: { label: "Cancelled", variant: "destructive" },
    },
    supportQueue: {
        WAITING: { label: "Waiting", variant: "secondary" },
        SERVING: { label: "Being helped", variant: "default" },
        COMPLETED: { label: "Helped", variant: "success" },
        SKIPPED: { label: "Skipped", variant: "warning" },
        LEFT: { label: "Left the queue", variant: "secondary" },
    },
    submission: {
        SUBMITTED: { label: "Submitted", variant: "default" },
        UNDER_REVIEW: { label: "Under review", variant: "warning" },
        ACCEPTED: { label: "Accepted", variant: "success" },
        NEEDS_REVISION: { label: "Needs revision", variant: "warning" },
        REJECTED: { label: "Rejected", variant: "destructive" },
    },
} satisfies Record<string, Record<string, Entry>>;

export type StatusKind = keyof typeof STATUS;

/** "SOME_STATUS" → "Some status", for a value the table doesn't know. */
const humanise = (value: string) =>
    value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

export const statusLabel = (kind: StatusKind, value: string): string =>
    (STATUS[kind] as Record<string, Entry>)[value]?.label ?? humanise(value);

export function StatusPill({
    kind,
    value,
    label,
    className,
}: {
    kind: StatusKind;
    value: string;
    /** Overrides the table's word — a translated screen passes its own. */
    label?: string;
    className?: string;
}) {
    const entry = (STATUS[kind] as Record<string, Entry>)[value];

    return (
        <Badge variant={entry?.variant ?? "outline"} className={cn("whitespace-nowrap", entry?.className, className)}>
            {label ?? entry?.label ?? humanise(value)}
        </Badge>
    );
}
