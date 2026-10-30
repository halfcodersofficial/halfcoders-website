import { ArrowRight, Bell, CheckCircle2, CreditCard, Headphones, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn, formatBDT } from "@/lib/utils";

interface Item {
    key: string;
    icon: LucideIcon;
    title: string;
    detail: string;
    href: string;
    action: string;
    /** Someone is held up until an admin acts — drawn in the warning tone. */
    urgent?: boolean;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

interface NeedsYouProps {
    pendingOrders: { count: number; total: number };
    waitingStudents: number;
    liveSessions: number;
    unread: number;
}

/** How many rows the list will show — for the hero's status bar. */
export const needsYouCount = ({ pendingOrders, waitingStudents, liveSessions, unread }: NeedsYouProps) =>
    Number(pendingOrders.count > 0) + Number(waitingStudents > 0 || liveSessions > 0) + Number(unread > 0);

/**
 * What's waiting on an admin right now, and nothing else — each a count, why
 * it matters, and the one place to deal with it. When it's all clear it says
 * so in a line, rather than leaving an admin to scan for zeros.
 *
 * Drawn for the dashboard hero's dark editor surface, under the greeting.
 */
export default function NeedsYou({ pendingOrders, waitingStudents, liveSessions, unread }: NeedsYouProps) {
    const items: Item[] = [];

    if (pendingOrders.count > 0) {
        items.push({
            key: "payments",
            icon: CreditCard,
            title: `${plural(pendingOrders.count, "order")} awaiting payment`,
            detail: `${formatBDT(pendingOrders.total)} in checkouts not completed — confirm any you've been paid for by hand.`,
            href: "/admin/orders?status=PENDING",
            action: "Review",
            urgent: true,
        });
    }
    if (waitingStudents > 0 || liveSessions > 0) {
        items.push({
            key: "support",
            icon: Headphones,
            title:
                waitingStudents > 0
                    ? `${plural(waitingStudents, "student")} waiting in support`
                    : `${plural(liveSessions, "support session")} live`,
            detail:
                waitingStudents > 0
                    ? liveSessions > 0
                        ? `${plural(liveSessions, "session")} live now.`
                        : "In a session's queue, waiting for a mentor."
                    : "Nobody's waiting in the queue right now.",
            href: "/admin/support",
            action: "Open support",
            urgent: waitingStudents > 0,
        });
    }
    if (unread > 0) {
        items.push({
            key: "notifications",
            icon: Bell,
            title: `${plural(unread, "unread notification")}`,
            detail: "Payments, enrolments and course requests from students.",
            href: "/admin/notifications",
            action: "Read",
        });
    }

    return (
        <section aria-labelledby="needs-you-title" className="border-t border-editor-line bg-editor/60">
            <h2 id="needs-you-title" className="px-6 pt-4 font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-editor-muted sm:px-8">
                Needs you
            </h2>
            {items.length === 0 ? (
                <p className="flex items-center gap-3 px-6 pb-5 pt-3 text-sm sm:px-8">
                    <CheckCircle2 className="size-5 shrink-0 text-syn-string" aria-hidden />
                    <span>
                        <span className="font-medium">Nothing needs you right now.</span>{" "}
                        <span className="text-editor-muted">Payments, support and notifications are all clear.</span>
                    </span>
                </p>
            ) : (
                <ul className="mt-2 divide-y divide-editor-line border-t border-editor-line">
                    {items.map((item) => (
                        <li key={item.key}>
                            <Link
                                href={item.href}
                                className="group relative flex items-center gap-4 px-6 py-4 transition-colors hover:bg-editor-panel sm:px-8"
                            >
                                {item.urgent && <span className="absolute inset-y-0 left-0 w-0.5 bg-syn-number" aria-hidden />}
                                <span
                                    className={cn(
                                        "grid size-10 shrink-0 place-items-center rounded-md border border-editor-line bg-editor-panel",
                                        item.urgent ? "text-syn-number" : "text-syn-func",
                                    )}
                                >
                                    <item.icon className="size-5" aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold">{item.title}</span>
                                    <span className="block text-sm text-editor-muted">{item.detail}</span>
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-syn-keyword">
                                    <span className="max-sm:sr-only">{item.action}</span>
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
