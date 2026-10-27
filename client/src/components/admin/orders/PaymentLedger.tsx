"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type KeyboardEvent } from "react";
import { StatStrip, type StatCell } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import { OrderDetailModal } from "@/components/admin/orders/OrderDetailModal";
import { gatewayLabel, ORDER_TONE } from "@/components/admin/orders/orderMeta";
import PaymentsHeader from "@/components/admin/orders/PaymentsHeader";
import { clock, DAY_MS, dayMonthOf, dhakaDayKey, weekdayOf } from "@/components/mentor/dashboard/time";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBDT } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminOrder, AdminOrderCourse } from "@/types/admin.types";

export type LedgerKind = "PAID" | "FAILED";

type Period = "" | "today" | "7d" | "30d";

const PERIODS: { value: Period; label: string; days?: number }[] = [
    { value: "", label: "All time" },
    { value: "today", label: "Today", days: 1 },
    { value: "7d", label: "7 days", days: 7 },
    { value: "30d", label: "30 days", days: 30 },
];

/** Dhaka midnight at the start of the period — "7 days" is today and the six before it. */
const periodStart = (period: Period) => {
    const days = PERIODS.find((option) => option.value === period)?.days;
    return days ? new Date(`${dhakaDayKey(Date.now() - (days - 1) * DAY_MS)}T00:00:00+06:00`).toISOString() : undefined;
};

/** Time · student · course · amount · how it was paid (or why it failed) · chevron. */
const COLUMNS =
    "md:grid md:grid-cols-[4.5rem_minmax(0,1.5fr)_minmax(0,1.6fr)_6.5rem_minmax(0,1.5fr)_1rem] md:items-center md:gap-4";

/** Lines under the student's name start past the avatar (34px) and the gap (12px). */
const UNDER_NAME = "pl-[2.875rem] md:pl-0";

const KIND = {
    PAID: {
        /** When the money landed — the list's order, its days and its period filter. */
        timeField: "payment.paidAt",
        at: (order: AdminOrder) => order.payment?.paidAt ?? order.updatedAt,
        description: "Every payment that went through, across all courses, newest first.",
        detailHeading: "Paid via",
    },
    FAILED: {
        /** A failed payment's row is last written when it fails. */
        timeField: "payment.updatedAt",
        at: (order: AdminOrder) => order.payment?.updatedAt ?? order.updatedAt,
        description: "Every payment that didn't go through, newest first — and whether the student paid later.",
        detailHeading: "Why it failed",
    },
} as const;

/**
 * All-time figures from the course roll-up. Awaiting payment is on both
 * screens because it is the one thing here an admin can act on, and it opens
 * the course view filtered to it.
 */
function figures(kind: LedgerKind, courses: AdminOrderCourse[], openAwaiting: () => void): StatCell[] {
    const sum = (pick: (summary: AdminOrderCourse) => number) => courses.reduce((total, summary) => total + pick(summary), 0);
    const paid = sum((s) => s.counts.PAID);
    const failed = sum((s) => s.counts.FAILED);
    const refunded = sum((s) => s.counts.REFUNDED);
    const pending = sum((s) => s.counts.PENDING);
    const collected = sum((s) => s.collected);

    const awaiting: StatCell = {
        label: "Awaiting payment",
        value: String(pending),
        hint: pending > 0 ? `${formatBDT(sum((s) => s.awaiting))} to confirm` : "Nothing to confirm",
        alert: pending > 0,
        onClick: pending > 0 ? openAwaiting : undefined,
    };

    if (kind === "PAID") {
        return [
            { label: "Collected", value: formatBDT(collected), hint: `${paid} paid ${paid === 1 ? "order" : "orders"}, all time` },
            { label: "Courses earning", value: String(courses.filter((s) => s.counts.PAID > 0).length), hint: `of ${courses.length} courses` },
            awaiting,
            { label: "Refunded", value: String(refunded), hint: "Paid, then access withdrawn" },
        ];
    }

    const settled = paid + failed + refunded;
    return [
        { label: "Failed", value: String(failed), hint: "All time" },
        { label: "Failure rate", value: settled ? `${Math.round((failed / settled) * 100)}%` : "—", hint: "Of orders that were settled" },
        awaiting,
        { label: "Paid", value: String(paid), hint: `${formatBDT(collected)} collected` },
    ];
}

/** "Today", "Yesterday", or the weekday — the date beside it, with the year once it isn't this one. */
function dayLabel(key: string) {
    const today = dhakaDayKey(Date.now());
    const date = `${weekdayOf(key, true)}, ${dayMonthOf(key)}${key.slice(0, 4) === today.slice(0, 4) ? "" : ` ${key.slice(0, 4)}`}`;
    if (key === today) return { lead: "Today", date };
    if (key === dhakaDayKey(Date.now() - DAY_MS)) return { lead: "Yesterday", date };
    return { lead: date, date: null };
}

/** The list arrives newest first, so each Dhaka day is one run of rows. */
function byDay(orders: AdminOrder[], at: (order: AdminOrder) => string) {
    const days: { key: string; orders: AdminOrder[] }[] = [];
    for (const order of orders) {
        const key = dhakaDayKey(at(order));
        const last = days.at(-1);
        if (last?.key === key) last.orders.push(order);
        else days.push({ key, orders: [order] });
    }
    return days;
}

function PaidDetail({ order }: { order: AdminOrder }) {
    const payment = order.payment;
    if (payment?.gateway === "FREE") {
        return (
            <>
                <p className="truncate text-sm">Free</p>
                <p className="truncate text-xs text-muted-foreground">{order.couponCode ? `Coupon ${order.couponCode}` : "No payment needed"}</p>
            </>
        );
    }
    return (
        <>
            <p className="truncate text-sm">{payment ? gatewayLabel(payment.gateway) : "—"}</p>
            {payment?.transactionId && <p className="truncate font-mono text-xs text-muted-foreground">{payment.transactionId}</p>}
        </>
    );
}

function FailedDetail({ order }: { order: AdminOrder }) {
    return (
        <>
            <p className="truncate text-sm">{order.payment?.failureReason ?? "No reason recorded"}</p>
            {order.paidLater ? (
                <p className="flex min-w-0 items-center gap-1 text-xs font-medium text-success">
                    <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                        Paid later · <span className="font-mono">{order.paidLater.orderNumber}</span>
                    </span>
                </p>
            ) : (
                <p className="text-xs text-muted-foreground">Hasn&apos;t paid since</p>
            )}
        </>
    );
}

function LedgerRow({ kind, order, onOpen }: { kind: LedgerKind; order: AdminOrder; onOpen: () => void }) {
    const at = KIND[kind].at(order);
    // A failure the student has since paid past needs nothing from anyone.
    const settled = kind === "FAILED" && order.paidLater !== null;
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`${order.student.name}, ${order.course.title}, ${order.orderNumber}`}
            onClick={onOpen}
            onKeyDown={onKeyDown}
            className={cn(
                "group relative flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none sm:px-5",
                COLUMNS,
            )}
        >
            <span
                aria-hidden
                className={cn("absolute inset-y-2 left-0 w-0.5 rounded-r-full", settled ? "bg-muted-foreground/30" : ORDER_TONE[order.status].fill)}
            />

            <time dateTime={at} className="hidden text-xs tabular-nums text-muted-foreground md:block">
                {clock(at)}
            </time>

            <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
                <Avatar src={order.student.image} name={order.student.name} size={34} />
                <div className="min-w-0">
                    <p className="truncate font-semibold">{order.student.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{order.student.phone ?? order.student.email}</p>
                </div>
            </div>

            <div className={cn("order-1 w-full min-w-0 md:order-none md:w-auto", UNDER_NAME)}>
                <p className="truncate text-sm font-medium">{order.course.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{order.orderNumber}</span>
                    <span className="md:hidden"> · {clock(at)}</span>
                </p>
            </div>

            <div className="text-right">
                <p className={cn("font-bold tabular-nums", kind === "FAILED" && "text-muted-foreground")}>{formatBDT(order.total)}</p>
                {order.discount > 0 && <p className="text-xs text-muted-foreground">{formatBDT(order.discount)} off</p>}
            </div>

            <div className={cn("order-2 w-full min-w-0 md:order-none md:w-auto", UNDER_NAME)}>
                {kind === "PAID" ? <PaidDetail order={order} /> : <FailedDetail order={order} />}
            </div>

            <ChevronRight
                aria-hidden
                className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary md:block"
            />
        </div>
    );
}

function Ledger({ kind }: { kind: LedgerKind }) {
    const config = KIND[kind];
    const router = useRouter();
    const searchParams = useSearchParams();
    const [period, setPeriod] = useState<Period>(() => {
        const asked = searchParams.get("period");
        return PERIODS.some((option) => option.value === asked) ? (asked as Period) : "";
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<{ id: string; mode: "detail" | "settle" } | null>(null);

    const summaryQuery = useQuery({
        queryKey: ["admin", "order-courses"],
        queryFn: () => adminService.orderCourses(),
    });

    const from = periodStart(period);
    const filters = {
        status: kind,
        searchTerm: searchTerm || undefined,
        ...(from ? { [config.timeField]: { gte: from } } : {}),
        sortBy: config.timeField,
    };

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "orders", { ledger: kind, period, searchTerm, page }],
        queryFn: () => adminService.orders({ ...filters, page, limit: 25 }),
    });

    const orders = data?.data ?? [];
    const openOrder = open ? (orders.find((order) => order.id === open.id) ?? null) : null;
    const periodLabel = PERIODS.find((option) => option.value === period)?.label.toLowerCase();

    return (
        <>
            <DataShell
                header={
                    <div className="space-y-5">
                        <PaymentsHeader description={config.description} />
                        {summaryQuery.data ? (
                            <StatStrip cells={figures(kind, summaryQuery.data, () => router.push("/admin/orders?status=PENDING"))} />
                        ) : (
                            <Skeleton className="h-24 rounded-xl" />
                        )}
                    </div>
                }
                searchPlaceholder="Search by student, phone, email, course or order number…"
                onSearch={(term) => {
                    setSearchTerm(term);
                    setPage(1);
                }}
                filters={PERIODS}
                activeFilter={period}
                onFilter={(value) => {
                    setPeriod(value as Period);
                    setPage(1);
                }}
                exportCsv={{ path: "/orders/manage/export", params: filters }}
                isLoading={isLoading}
                isEmpty={orders.length === 0}
                emptyMessage={
                    searchTerm
                        ? "No payments match."
                        : kind === "PAID"
                          ? period
                              ? `No payments in the last ${periodLabel}.`
                              : "No successful payments yet."
                          : period
                            ? `Nothing failed in the last ${periodLabel}.`
                            : "No failed payments."
                }
                emptyHint={
                    searchTerm
                        ? "Try a different name, phone number, course or order number."
                        : period
                          ? "Try a longer period."
                          : kind === "PAID"
                            ? "Payments show up here as students buy courses."
                            : "Payments that don't go through at the gateway, or that a student cancels, show up here."
                }
                meta={data?.meta}
                onPage={setPage}
            >
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div
                        className={cn(
                            "hidden border-b border-border bg-secondary/40 px-5 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground",
                            COLUMNS,
                        )}
                    >
                        <span>Time</span>
                        <span>Student</span>
                        <span>Course</span>
                        <span className="text-right">Amount</span>
                        <span>{config.detailHeading}</span>
                        <span className="sr-only">Details</span>
                    </div>
                    <div className="divide-y divide-border">
                        {byDay(orders, config.at).map((day) => {
                            const { lead, date } = dayLabel(day.key);
                            return (
                                <section key={day.key} aria-label={date ? `${lead}, ${date}` : lead}>
                                    <h2 className="flex items-baseline gap-2 border-b border-border bg-secondary/20 px-4 py-2 text-xs sm:px-5">
                                        <span className="font-semibold">{lead}</span>
                                        {date && <span className="text-muted-foreground">{date}</span>}
                                    </h2>
                                    <ul className="divide-y divide-border">
                                        {day.orders.map((order) => (
                                            <li key={order.id}>
                                                <LedgerRow kind={kind} order={order} onOpen={() => setOpen({ id: order.id, mode: "detail" })} />
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            );
                        })}
                    </div>
                </div>
            </DataShell>

            <OrderDetailModal
                order={openOrder}
                mode={open?.mode ?? "detail"}
                onModeChange={(mode) => setOpen((current) => (current ? { ...current, mode } : current))}
                onClose={() => setOpen(null)}
            />
        </>
    );
}

/**
 * Every course's successful or failed payments as one list, a day at a time
 * in Dhaka time. The course view is for working through one course; this is
 * for "what came in today" and "who do we need to call".
 */
export default function PaymentLedger({ kind }: { kind: LedgerKind }) {
    return (
        <Suspense fallback={<Skeleton className="h-96" />}>
            <Ledger kind={kind} />
        </Suspense>
    );
}
