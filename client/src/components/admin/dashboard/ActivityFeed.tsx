import { formatDistanceToNowStrict } from "date-fns";
import { CreditCard, GraduationCap, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import type { AdminDashboard } from "@/types/admin.types";

interface Event {
    id: string;
    at: string;
    icon: LucideIcon;
    text: ReactNode;
    href?: string;
    /** A short state, where one adds something — "Awaiting payment". */
    note?: { label: string; tone: "warning" | "danger" | "muted" };
}

const ROLE_WORD: Record<string, string> = { STUDENT: "a student", MENTOR: "a mentor", ADMIN: "an admin", SUPER_ADMIN: "a super admin" };

const orderLink = (order: AdminDashboard["recentOrders"][number]) =>
    `/admin/orders/${order.course.id}?q=${encodeURIComponent(order.orderNumber)}&open=${order.id}`;

/** Recent orders, enrolments and sign-ups as one timeline, newest first — each opening where it can be dealt with. */
function eventsOf(data: AdminDashboard): Event[] {
    const orders: Event[] = data.recentOrders.map((order) => ({
        id: `order-${order.id}`,
        at: order.createdAt,
        icon: CreditCard,
        href: orderLink(order),
        text: (
            <>
                <strong className="font-semibold">{order.student.name}</strong>{" "}
                {order.status === "PAID"
                    ? order.total > 0
                        ? `paid ${formatBDT(order.total)} for`
                        : "enrolled free in"
                    : order.status === "PENDING"
                      ? `started a ${formatBDT(order.total)} checkout for`
                      : order.status === "REFUNDED"
                        ? `was refunded ${formatBDT(order.total)} for`
                        : "had a payment fail for"}{" "}
                <strong className="font-semibold">{order.course.title}</strong>
            </>
        ),
        note:
            order.status === "PENDING"
                ? { label: "Awaiting payment", tone: "warning" }
                : order.status === "FAILED"
                  ? { label: "Failed", tone: "danger" }
                  : order.status === "REFUNDED"
                    ? { label: "Refunded", tone: "muted" }
                    : undefined,
    }));

    // An enrolment that came with a paid order is the same event as the
    // payment above — only the ones an admin added by hand are their own.
    const orderIds = new Set(data.recentOrders.map((order) => order.id));
    const enrolments: Event[] = data.recentEnrollments
        .filter((enrollment) => !enrollment.orderId || !orderIds.has(enrollment.orderId))
        .map((enrollment) => ({
            id: `enrolment-${enrollment.id}`,
            at: enrollment.createdAt,
            icon: GraduationCap,
            href: `/admin/students/${enrollment.student.id}`,
            text: (
                <>
                    <strong className="font-semibold">{enrollment.student.name}</strong>{" "}
                    {enrollment.orderId ? "enrolled in" : "was enrolled by an admin in"}{" "}
                    <strong className="font-semibold">{enrollment.course.title}</strong>
                </>
            ),
        }));

    const signUps: Event[] = data.recentUsers.map((person) => ({
        id: `user-${person.id}`,
        at: person.createdAt,
        icon: UserPlus,
        href:
            person.role === "STUDENT" ? `/admin/students/${person.id}` : person.role === "MENTOR" ? `/admin/mentors/${person.id}` : undefined,
        text: (
            <>
                <strong className="font-semibold">{person.name}</strong> joined Half Coders as {ROLE_WORD[person.role] ?? person.role.toLowerCase()}
            </>
        ),
    }));

    return [...orders, ...enrolments, ...signUps].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
}

/**
 * The latest on the platform, as sentences on a line: who paid, who joined,
 * who was enrolled — the three old "recent" lists read as one story.
 */
export default function ActivityFeed({ data }: { data: AdminDashboard }) {
    const events = eventsOf(data);

    return (
        <section aria-labelledby="activity-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="border-b border-border px-5 py-4 sm:px-6">
                <h2 id="activity-title" className="text-lg font-semibold tracking-tight">
                    Latest activity
                </h2>
            </header>

            {events.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                    Nothing yet — orders, enrolments and new learners show up here as they happen.
                </p>
            ) : (
                <ol className="relative px-5 py-4 sm:px-6">
                    {/* The timeline's spine, behind the icons. */}
                    <span className="absolute bottom-6 left-[2.35rem] top-6 w-px bg-border sm:left-[2.6rem]" aria-hidden />
                    {events.map((event) => {
                        const body = (
                            <>
                                <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
                                    <event.icon className="size-4" aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1 pt-1">
                                    <span className="block text-sm leading-snug text-muted-foreground [&_strong]:text-foreground">{event.text}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <time dateTime={event.at} title={formatDateTime(event.at)}>
                                            {formatDistanceToNowStrict(new Date(event.at), { addSuffix: true })}
                                        </time>
                                        {event.note && (
                                            <span
                                                className={cn(
                                                    "rounded-full px-2 py-px font-medium",
                                                    event.note.tone === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                                                    event.note.tone === "danger" && "bg-destructive/10 text-destructive",
                                                    event.note.tone === "muted" && "bg-secondary text-secondary-foreground",
                                                )}
                                            >
                                                {event.note.label}
                                            </span>
                                        )}
                                    </span>
                                </span>
                            </>
                        );

                        return (
                            <li key={event.id}>
                                {event.href ? (
                                    <Link href={event.href} className="-mx-2 flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/40">
                                        {body}
                                    </Link>
                                ) : (
                                    <div className="-mx-2 flex gap-3 px-2 py-2.5">{body}</div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
