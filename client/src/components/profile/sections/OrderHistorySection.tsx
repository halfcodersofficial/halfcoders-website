"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBDT, formatDateTime } from "@/lib/utils";
import { orderService, refundService } from "@/services";
import type { OrderStatus } from "@/types/api.types";
import { ProfileEmptyState } from "../ProfileEmptyState";

const FILTERS: { value: OrderStatus | ""; label: string }[] = [
    { value: "", label: "All" },
    { value: "PENDING", label: "Awaiting payment" },
    { value: "PAID", label: "Paid" },
    { value: "FAILED", label: "Failed" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "REFUNDED", label: "Refunded" },
];

/** Each status in words, coloured by whether it needs the student. */
const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
    PAID: { label: "Paid", className: "bg-success/10 text-success" },
    PENDING: { label: "Awaiting payment", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    FAILED: { label: "Failed", className: "bg-destructive/10 text-destructive" },
    CANCELLED: { label: "Cancelled", className: "bg-secondary text-muted-foreground" },
    REFUNDED: { label: "Refunded", className: "bg-secondary text-muted-foreground" },
};

const LIMIT = 10;

/**
 * Every order this student has ever placed — paid, pending, failed or
 * refunded — with a link through to `/checkout/[orderId]` for the full
 * breakdown and, for a still-pending order, the button to finish paying.
 *
 * Extracted from the old standalone `/orders` page (now a redirect here) so
 * this "Order History" sidebar section and any future reuse share one copy.
 */
export function OrderHistorySection() {
    const [status, setStatus] = useState<OrderStatus | "">("");
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ["orders", "mine", status, page],
        queryFn: () =>
            orderService.mine({
                page,
                limit: LIMIT,
                ...(status ? { status } : {}),
            }),
    });

    const orders = data?.data ?? [];
    const meta = data?.meta;
    // Where each order's refund request stands, if it has one.
    const refunds = useQuery({ queryKey: ["refunds", "mine"], queryFn: refundService.mine });
    const refundOf = (orderId: string) => refunds.data?.find((request) => request.orderId === orderId && request.status !== "WITHDRAWN");

    const setFilter = (next: OrderStatus | "") => {
        setStatus(next);
        setPage(1);
    };

    return (
        <div className="space-y-5">
            <div role="group" aria-label="Filter orders" className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-secondary p-1 sm:w-fit">
                {FILTERS.map((filter) => (
                    <button
                        key={filter.value}
                        type="button"
                        aria-pressed={status === filter.value}
                        onClick={() => setFilter(filter.value)}
                        className={cn(
                            "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                            status === filter.value
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 rounded-card" />
                    <Skeleton className="h-24 rounded-card" />
                    <Skeleton className="h-24 rounded-card" />
                </div>
            ) : orders.length === 0 ? (
                <ProfileEmptyState
                    icon={Receipt}
                    title={status ? "No orders with this status" : "No orders yet"}
                    description={status ? "Try another filter." : "Once you enrol in a paid course, the order shows up here."}
                    action={
                        !status && (
                            <Button asChild variant="brand-outline" className="px-5">
                                <Link href="/courses">Browse courses</Link>
                            </Button>
                        )
                    }
                />
            ) : (
                <ul className="space-y-3">
                    {orders.map((order) => {
                        const statusMeta = STATUS_META[order.status];
                        return (
                            <li key={order.id}>
                                <Link
                                    href={`/checkout/${order.id}`}
                                    className="group flex items-center gap-4 rounded-card border border-border bg-card p-3 pr-5 shadow-card transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-panel"
                                >
                                    <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-secondary">
                                        <SafeImage
                                            src={order.course.thumbnail}
                                            alt=""
                                            fill
                                            sizes="112px"
                                            className="object-cover"
                                            fallback={<Receipt className="size-5 text-muted-foreground" />}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold transition-colors group-hover:text-primary">
                                            {order.course.title}
                                        </p>
                                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                            <span className="font-mono font-semibold">{order.orderNumber}</span>
                                            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                                            <span>{formatDateTime(order.createdAt)}</span>
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                                        <p className="text-lg font-bold tabular-nums">{formatBDT(order.total)}</p>
                                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", statusMeta.className)}>
                                            {statusMeta.label}
                                        </span>
                                        {order.status === "PAID" && refundOf(order.id) && (
                                            <span className="text-xs text-muted-foreground">
                                                {refundOf(order.id)?.status === "PENDING" ? "Refund requested" : "Refund declined"}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}

            {meta && meta.totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        Page {meta.page} of {meta.totalPages} · {meta.total} orders
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                           
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="size-4" /> Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                           
                            disabled={page >= meta.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
