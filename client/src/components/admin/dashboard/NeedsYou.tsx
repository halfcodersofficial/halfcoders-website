import { ArrowRight, Bell, CheckCircle2, CreditCard, Headphones, Star, Undo2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn, formatBDT } from "@/lib/utils";

interface Item {
    key: string;
    icon: LucideIcon;
    /** Where it's from, above the count — "Payments". */
    label: string;
    count: number;
    /** What the count is of, beside it — "orders awaiting payment". */
    what: string;
    detail: string;
    href: string;
    action: string;
    /** Someone is held up until an admin acts — drawn in the warning tone. */
    urgent?: boolean;
}

const word = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

export interface NeedsYouProps {
    pendingOrders: { count: number; total: number };
    refunds: number;
    waitingStudents: number;
    liveSessions: number;
    reviews: number;
    unread: number;
}

const itemsOf = ({ pendingOrders, refunds, waitingStudents, liveSessions, reviews, unread }: NeedsYouProps): Item[] => {
    const items: Item[] = [];

    if (pendingOrders.count > 0) {
        items.push({
            key: "payments",
            icon: CreditCard,
            label: "Payments",
            count: pendingOrders.count,
            what: `${word(pendingOrders.count, "order")} awaiting payment`,
            detail: `${formatBDT(pendingOrders.total)} in checkouts not finished. Confirm any you've been paid for by hand.`,
            href: "/admin/orders?status=PENDING",
            action: "Review payments",
            urgent: true,
        });
    }
    if (refunds > 0) {
        items.push({
            key: "refunds",
            icon: Undo2,
            label: "Refunds",
            count: refunds,
            what: `refund ${word(refunds, "request")}`,
            detail: "A student is waiting for your answer. Approve or decline with a reason.",
            href: "/admin/refunds",
            action: "Decide",
            urgent: true,
        });
    }
    if (waitingStudents > 0 || liveSessions > 0) {
        items.push({
            key: "support",
            icon: Headphones,
            label: "Support",
            count: waitingStudents > 0 ? waitingStudents : liveSessions,
            what: waitingStudents > 0 ? `${word(waitingStudents, "student")} waiting` : `${word(liveSessions, "session")} live now`,
            detail:
                waitingStudents > 0
                    ? liveSessions > 0
                        ? `In a session's queue · ${liveSessions} ${word(liveSessions, "session")} live now.`
                        : "In a session's queue, waiting for a mentor."
                    : "Nobody is waiting in the queue right now.",
            href: "/admin/support",
            action: "Open support",
            urgent: waitingStudents > 0,
        });
    }
    if (reviews > 0) {
        items.push({
            key: "reviews",
            icon: Star,
            label: "Course reviews",
            count: reviews,
            what: `${word(reviews, "review")} to check`,
            detail: "Publish one to show it on its course page, or hide it.",
            href: "/admin/reviews",
            action: "Check reviews",
        });
    }
    if (unread > 0) {
        items.push({
            key: "notifications",
            icon: Bell,
            label: "Notifications",
            count: unread,
            what: "unread",
            detail: "Payments, enrolments and course requests from students.",
            href: "/admin/notifications",
            action: "Read",
        });
    }
    return items;
};

/** How many tiles the section will show — for the hero's status bar. */
export const needsYouCount = (props: NeedsYouProps) => itemsOf(props).length;

/**
 * What's waiting on an admin right now, and nothing else — each a tile with
 * its count, why it matters, and the one place to deal with it; the ones that
 * hold a student up come first, marked in the warning tone. When it's all
 * clear it says so in a line, rather than leaving an admin to scan for zeros.
 *
 * Drawn for the dashboard hero's dark editor surface, under the greeting.
 */
export default function NeedsYou(props: NeedsYouProps) {
    const items = itemsOf(props);

    return (
        <section aria-labelledby="needs-you-title" className="border-t border-editor-line bg-editor/60 px-6 pb-6 pt-4 sm:px-8">
            <h2 id="needs-you-title" className="flex items-center gap-2 font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-editor-muted">
                Needs you
                {items.length > 0 && <span className="rounded-sm bg-editor-raised px-1.5 py-px tabular-nums text-editor-fg">{items.length}</span>}
            </h2>

            {items.length === 0 ? (
                <p className="mt-3 flex items-center gap-3 text-sm">
                    <CheckCircle2 className="size-5 shrink-0 text-syn-string" aria-hidden />
                    <span>
                        <span className="font-medium">Nothing needs you right now.</span>{" "}
                        <span className="text-editor-muted">Payments, refunds, support, reviews and notifications are all clear.</span>
                    </span>
                </p>
            ) : (
                // One tile fills the row; more share it, wrapping once they'd get too narrow.
                <ul className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
                    {items.map((item) => (
                        <li key={item.key} className="flex">
                            <Link
                                href={item.href}
                                className="group relative flex w-full flex-col overflow-hidden rounded-md border border-editor-line bg-editor-panel/80 p-4 transition-colors hover:border-editor-gutter hover:bg-editor-raised"
                            >
                                {item.urgent && <span className="absolute inset-y-0 left-0 w-0.5 bg-syn-number" aria-hidden />}
                                <span className={cn("flex items-center gap-2 text-xs font-semibold", item.urgent ? "text-syn-number" : "text-syn-func")}>
                                    <item.icon className="size-4" aria-hidden />
                                    {item.label}
                                </span>
                                <span className="mt-3 flex flex-wrap items-baseline gap-x-2">
                                    <span className="font-mono text-3xl font-bold leading-none tracking-tight tabular-nums">{item.count}</span>
                                    <span className="text-sm font-medium">{item.what}</span>
                                </span>
                                <span className="mt-2 text-sm leading-snug text-editor-muted">{item.detail}</span>
                                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-syn-keyword">
                                    {item.action}
                                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
