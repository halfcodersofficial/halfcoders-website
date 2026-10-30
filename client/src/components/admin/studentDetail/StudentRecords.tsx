"use client";

import { Headphones, ListChecks, Receipt } from "lucide-react";
import type { ReactNode } from "react";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { StatusPill } from "@/components/admin/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatBDT, formatDateTime, formatQueueNumber } from "@/lib/utils";
import type { StudentOverview, StudentQuizAttempt } from "@/types/admin.types";
import { GATEWAY_LABEL, percentLabel, percentTone, weekLabel } from "./format";

/** Every quiz attempt, newest first — each one kept, so retakes show. */
export function StudentQuizzes({ attempts }: { attempts: StudentQuizAttempt[] }) {
    if (attempts.length === 0) {
        return <EmptyTab icon={ListChecks} title="No quizzes taken yet." hint="Each attempt at a module quiz shows up here with its score." />;
    }

    const completed = attempts.filter((attempt) => attempt.status === "COMPLETED");
    const average = completed.length
        ? completed.reduce((sum, attempt) => sum + attempt.percentage, 0) / completed.length
        : null;
    const perfect = completed.filter((attempt) => attempt.percentage === 100).length;

    const columns: Column<StudentQuizAttempt>[] = [
        {
            id: "quiz",
            header: "Quiz",
            primary: true,
            sortable: true,
            sortValue: (attempt) => attempt.quiz.title,
            cell: (attempt) => (
                <div className="min-w-0">
                    <p className="truncate font-medium">{attempt.quiz.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {weekLabel(attempt.quiz.course.milestoneLabel, attempt.quiz.module.milestone.order)} ·{" "}
                        {attempt.quiz.course.moduleLabel} {attempt.quiz.module.order} · {attempt.quiz.course.title}
                    </p>
                </div>
            ),
        },
        {
            id: "score",
            header: "Score",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (attempt) => (attempt.status === "COMPLETED" ? attempt.percentage : -1),
            cell: (attempt) =>
                attempt.status === "COMPLETED" ? (
                    <span>
                        <span className={cn("font-semibold tabular-nums", percentTone(attempt.percentage))}>{attempt.percentage}%</span>
                        <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                            {attempt.correctCount}/{attempt.totalQuestions} correct
                        </span>
                    </span>
                ) : (
                    <Badge variant="secondary">Unfinished</Badge>
                ),
        },
        {
            id: "when",
            header: "When",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (attempt) => new Date(attempt.completedAt ?? attempt.startedAt),
            cell: (attempt) => formatDateTime(attempt.completedAt ?? attempt.startedAt),
        },
    ];

    return (
        <div className="space-y-4">
            <Summary
                items={[
                    ["Attempts", attempts.length],
                    ["Average", percentLabel(average)],
                    ["Full marks", perfect],
                ]}
            />
            <DataTable rows={attempts} columns={columns} rowKey={(attempt) => attempt.id} />
        </div>
    );
}

type Order = StudentOverview["orders"][number];

/** Every order they've placed, paid or not, with how it was paid. */
export function StudentPayments({ orders, paid }: { orders: Order[]; paid: number }) {
    if (orders.length === 0) {
        return <EmptyTab icon={Receipt} title="No orders." hint="Manual enrolments don't create an order, so a student can be on a course with none." />;
    }

    const columns: Column<Order>[] = [
        {
            id: "order",
            header: "Order",
            primary: true,
            cell: (order) => (
                <div className="min-w-0">
                    <p className="font-mono text-xs">{order.orderNumber}</p>
                    <p className="truncate text-sm font-medium">{order.course.title}</p>
                </div>
            ),
        },
        {
            id: "amount",
            header: "Amount",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (order) => order.total,
            cell: (order) => (
                <div>
                    <p className="font-semibold tabular-nums">{formatBDT(order.total)}</p>
                    {order.discount > 0 && (
                        <p className="text-xs text-muted-foreground">
                            <span className="line-through">{formatBDT(order.amount)}</span>
                            {order.couponCode && <span> · {order.couponCode}</span>}
                        </p>
                    )}
                </div>
            ),
        },
        {
            id: "method",
            header: "Paid with",
            cell: (order) =>
                order.payment ? (
                    <div className="min-w-0">
                        <p>{GATEWAY_LABEL[order.payment.gateway] ?? order.payment.gateway}</p>
                        {order.payment.transactionId && (
                            <p className="truncate font-mono text-xs text-muted-foreground">{order.payment.transactionId}</p>
                        )}
                        {order.payment.failureReason && (
                            <p className="truncate text-xs text-destructive">{order.payment.failureReason}</p>
                        )}
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            id: "status",
            header: "Status",
            cell: (order) => <StatusPill kind="order" value={order.status} />,
        },
        {
            id: "when",
            header: "Date",
            className: "whitespace-nowrap",
            sortable: true,
            sortValue: (order) => new Date(order.createdAt),
            cell: (order) => (
                <div>
                    <p>{formatDateTime(order.createdAt)}</p>
                    {order.payment?.paidAt && (
                        <p className="text-xs text-muted-foreground">Paid {formatDateTime(order.payment.paidAt)}</p>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <Summary
                items={[
                    ["Orders", orders.length],
                    ["Paid", orders.filter((order) => order.status === "PAID").length],
                    ["Total paid", formatBDT(paid)],
                ]}
            />
            <DataTable rows={orders} columns={columns} rowKey={(order) => order.id} />
        </div>
    );
}

type Visit = StudentOverview["support"][number];

/** Each time they joined a support queue: the session, their ticket, and what the mentor noted. */
export function StudentSupport({ visits }: { visits: Visit[] }) {
    if (visits.length === 0) {
        return <EmptyTab icon={Headphones} title="Hasn't joined a support session." hint="Each time they take a number in a support queue shows up here." />;
    }

    const columns: Column<Visit>[] = [
        {
            id: "session",
            header: "Session",
            primary: true,
            cell: (visit) => (
                <div className="min-w-0">
                    <p className="truncate font-medium">{visit.session.title || "Support session"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {visit.session.course.title} · {formatDateTime(visit.session.startTime)}
                    </p>
                </div>
            ),
        },
        {
            id: "mentor",
            header: "Mentor",
            cell: (visit) => (
                <span className="flex min-w-0 items-center gap-2">
                    <Avatar src={visit.session.mentor.image} name={visit.session.mentor.name} size={24} />
                    <span className="truncate">{visit.session.mentor.name}</span>
                </span>
            ),
        },
        {
            id: "ticket",
            header: "Ticket",
            className: "whitespace-nowrap",
            cell: (visit) => (
                <div>
                    <p className="font-mono font-semibold">{formatQueueNumber(visit.queueNumber)}</p>
                    <p className="text-xs text-muted-foreground">joined {formatDateTime(visit.joinedAt)}</p>
                </div>
            ),
        },
        {
            id: "topic",
            header: "Topic & note",
            cell: (visit) => (
                <div className="max-w-72 space-y-0.5 text-sm">
                    <p className={cn(!visit.topic && "text-muted-foreground")}>{visit.topic || "No topic given"}</p>
                    {visit.mentorNote && <p className="text-xs text-muted-foreground">Mentor: {visit.mentorNote}</p>}
                </div>
            ),
        },
        {
            id: "status",
            header: "Result",
            cell: (visit) => <StatusPill kind="supportQueue" value={visit.status} />,
        },
    ];

    return (
        <div className="space-y-4">
            <Summary
                items={[
                    ["Queues joined", visits.length],
                    ["Helped", visits.filter((visit) => visit.status === "COMPLETED").length],
                    ["Left or skipped", visits.filter((visit) => visit.status === "LEFT" || visit.status === "SKIPPED").length],
                ]}
            />
            <DataTable rows={visits} columns={columns} rowKey={(visit) => visit.id} />
        </div>
    );
}

/** A tab's few totals, as one quiet line of figures. */
function Summary({ items }: { items: [string, ReactNode][] }) {
    return (
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {items.map(([label, value]) => (
                <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function EmptyTab({ icon: Icon, title, hint }: { icon: typeof Receipt; title: string; hint: string }) {
    return (
        <div className="rounded-card border border-dashed border-border p-10 text-center">
            <Icon className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">{title}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>
        </div>
    );
}
