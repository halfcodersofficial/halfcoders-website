"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, CreditCard, GraduationCap, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import type { AdminDashboard } from "@/types/admin.types";
import Panel from "./Panel";

type Tone = "success" | "warning" | "danger" | "primary" | "muted";
type Kind = "payments" | "enrolments" | "people";

interface Event {
    id: string;
    kind: Kind;
    at: string;
    icon: LucideIcon;
    /** Colours the icon, so money and admin actions stand out from sign-ups at a glance. */
    tone: Tone;
    /** Who did what — kept to one short line. */
    text: ReactNode;
    /** The course it was about, on the quieter second line beside the time. */
    course?: string;
    href?: string;
    /** A short state, where one adds something — "Awaiting payment". */
    note?: { label: string; tone: "warning" | "danger" | "muted" };
}

const ICON_TONE: Record<Tone, string> = {
    success: "bg-success/10 text-success",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-destructive/10 text-destructive",
    primary: "bg-primary/10 text-primary",
    muted: "text-muted-foreground",
};

const ROLE_WORD: Record<string, string> = { STUDENT: "a student", MENTOR: "a mentor", ADMIN: "an admin", SUPER_ADMIN: "a super admin" };

/** The filter tabs, and where each one's "see all" goes. */
const FILTERS: { key: Kind | "all"; label: string; more?: { href: string; label: string } }[] = [
    { key: "all", label: "All" },
    { key: "payments", label: "Payments", more: { href: "/admin/orders", label: "All payments" } },
    { key: "enrolments", label: "Enrolments", more: { href: "/admin/enrollments", label: "All enrolments" } },
    { key: "people", label: "New people", more: { href: "/admin/students", label: "All students" } },
];

/** How many lines the feed shows — about as tall as the courses beside it. */
const SHOWN = 8;

const orderLink = (order: AdminDashboard["recentOrders"][number]) =>
    `/admin/orders/${order.course.id}?q=${encodeURIComponent(order.orderNumber)}&open=${order.id}`;

/** Recent orders, enrolments and sign-ups as one timeline, newest first — each opening where it can be dealt with. */
function eventsOf(data: AdminDashboard): Event[] {
    const orders: Event[] = data.recentOrders.map((order) => {
        const name = <strong className="font-semibold">{order.student.name}</strong>;
        const amount = <strong className="font-semibold">{formatBDT(order.total)}</strong>;
        return {
            id: `order-${order.id}`,
            kind: "payments",
            at: order.createdAt,
            icon: CreditCard,
            tone: order.status === "PAID" ? "success" : order.status === "PENDING" ? "warning" : order.status === "FAILED" ? "danger" : "muted",
            href: orderLink(order),
            course: order.course.title,
            text:
                order.status === "PAID" ? (
                    order.total > 0 ? (
                        <>
                            {name} paid {amount}
                        </>
                    ) : (
                        <>{name} enrolled free</>
                    )
                ) : order.status === "PENDING" ? (
                    <>
                        {name} started a {amount} checkout
                    </>
                ) : order.status === "REFUNDED" ? (
                    <>
                        {name} was refunded {amount}
                    </>
                ) : (
                    <>
                        {name}&apos;s {amount} payment failed
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
        };
    });

    // An enrolment that came with a paid order is the same event as the
    // payment above — only the ones an admin added by hand are their own.
    const orderIds = new Set(data.recentOrders.map((order) => order.id));
    const enrolments: Event[] = data.recentEnrollments
        .filter((enrollment) => !enrollment.orderId || !orderIds.has(enrollment.orderId))
        .map((enrollment) => ({
            id: `enrolment-${enrollment.id}`,
            kind: "enrolments",
            at: enrollment.createdAt,
            icon: GraduationCap,
            tone: "primary",
            href: `/admin/students/${enrollment.student.id}`,
            course: enrollment.course.title,
            text: (
                <>
                    <strong className="font-semibold">{enrollment.student.name}</strong> {enrollment.orderId ? "enrolled" : "was enrolled by an admin"}
                </>
            ),
        }));

    const signUps: Event[] = data.recentUsers.map((person) => ({
        id: `user-${person.id}`,
        kind: "people",
        at: person.createdAt,
        icon: UserPlus,
        tone: "muted",
        href: person.role === "STUDENT" ? `/admin/students/${person.id}` : person.role === "MENTOR" ? `/admin/mentors/${person.id}` : undefined,
        text: (
            <>
                <strong className="font-semibold">{person.name}</strong> joined as {ROLE_WORD[person.role] ?? person.role.toLowerCase()}
            </>
        ),
    }));

    return [...orders, ...enrolments, ...signUps].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * The latest on the platform, as short lines on a timeline: who paid, who
 * joined, who was enrolled — the three "recent" lists read as one story, or
 * one kind at a time from the tabs. Each is two lines at most (what happened;
 * the course and when), so the feed stays about as tall as the courses beside it.
 */
export default function ActivityFeed({ data, className }: { data: AdminDashboard; className?: string }) {
    const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
    const current = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0];
    const all = eventsOf(data);
    const events = (filter === "all" ? all : all.filter((event) => event.kind === filter)).slice(0, SHOWN);

    return (
        <Panel
            id="activity-title"
            title="Latest activity"
            file="activity.log"
            className={className}
            footer={
                current.more ? (
                    <Link href={current.more.href} className="inline-flex items-center gap-1 font-sans text-xs font-medium text-primary hover:underline">
                        {current.more.label} <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                ) : (
                    <span>Newest first · pick a tab to see one kind</span>
                )
            }
        >
            <div role="group" aria-label="Show" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-4 py-2 sm:px-5">
                {FILTERS.map((entry) => {
                    const selected = entry.key === filter;
                    return (
                        <button
                            key={entry.key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setFilter(entry.key)}
                            className={cn(
                                "shrink-0 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                                selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )}
                        >
                            {entry.label}
                        </button>
                    );
                })}
            </div>

            {events.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                    {filter === "all"
                        ? "Nothing yet — orders, enrolments and new learners show up here as they happen."
                        : `No recent ${current.label.toLowerCase()}.`}
                </p>
            ) : (
                <ol className="relative px-5 py-3 sm:px-6">
                    {/* The timeline's spine, behind the icons. */}
                    <span className="absolute bottom-6 left-[2.35rem] top-6 w-px bg-border sm:left-[2.6rem]" aria-hidden />
                    {events.map((event) => {
                        const body = (
                            <>
                                {/* The card-coloured disc hides the spine behind the tinted icon. */}
                                <span className="relative size-8 shrink-0 rounded-full bg-card ring-1 ring-border">
                                    <span className={cn("grid size-full place-items-center rounded-full", ICON_TONE[event.tone])}>
                                        <event.icon className="size-4" aria-hidden />
                                    </span>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm leading-snug text-muted-foreground [&_strong]:text-foreground">{event.text}</span>
                                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                        {event.course && (
                                            <>
                                                <span className="truncate" title={event.course}>
                                                    {event.course}
                                                </span>
                                                <span aria-hidden>·</span>
                                            </>
                                        )}
                                        <time dateTime={event.at} title={formatDateTime(event.at)} className="shrink-0 font-mono text-[0.7rem]">
                                            {formatDistanceToNowStrict(new Date(event.at), { addSuffix: true })}
                                        </time>
                                        {event.note && (
                                            <span
                                                className={cn(
                                                    "shrink-0 rounded-sm px-2 py-px font-medium",
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
                                    <Link
                                        href={event.href}
                                        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-secondary/40"
                                    >
                                        {body}
                                    </Link>
                                ) : (
                                    <div className="-mx-2 flex items-center gap-3 px-2 py-2">{body}</div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
        </Panel>
    );
}
