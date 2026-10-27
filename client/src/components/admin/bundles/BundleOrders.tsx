"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalBody } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatBDT, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminBundle, AdminBundleOrder } from "@/types/admin.types";
import type { OrderStatus } from "@/types/api.types";

const ORDER_TONE: Record<OrderStatus, "success" | "warning" | "destructive" | "secondary"> = {
    PAID: "success",
    PENDING: "warning",
    FAILED: "destructive",
    CANCELLED: "secondary",
    REFUNDED: "secondary",
};

/** A bundle's checkouts: who, how much, and what each became — with a hand to confirm one paid elsewhere, or refund it. */
export default function BundleOrders({ bundle, onChanged }: { bundle: AdminBundle; onChanged: () => void }) {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "bundle-orders", bundle.id],
        queryFn: () => adminService.bundleOrders(bundle.id),
    });
    const changed = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "bundle-orders", bundle.id] });
        onChanged();
    };
    const confirmPaid = useMutation({
        mutationFn: (order: AdminBundleOrder) => adminService.markBundleOrderPaid(order.id),
        onSuccess: () => {
            toast.success("Payment confirmed — the courses are open.");
            changed();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't confirm that payment.")),
    });
    const refund = useMutation({
        mutationFn: (order: AdminBundleOrder) => adminService.refundBundleOrder(order.id, "Refunded by an admin"),
        onSuccess: () => {
            toast.success("Refunded — the courses are closed again.");
            changed();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't refund that order.")),
    });

    const orders = data ?? [];
    const paid = orders.filter((order) => order.status === "PAID");
    const waiting = orders.filter((order) => order.status === "PENDING").length;

    return (
        <ModalBody className="space-y-4">
            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 rounded-xl" />
                    ))}
                </div>
            ) : orders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
                    <Layers className="mx-auto size-7 text-muted-foreground" aria-hidden />
                    <p className="mt-3 font-medium">No orders yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">They show here as soon as a student starts a checkout.</p>
                </div>
            ) : (
                <>
                    <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-surface/70 text-center">
                        <div className="px-3 py-2.5">
                            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Paid</dt>
                            <dd className="text-lg font-bold tabular-nums">{paid.length}</dd>
                        </div>
                        <div className="px-3 py-2.5">
                            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Earned</dt>
                            <dd className="text-lg font-bold tabular-nums">{formatBDT(paid.reduce((sum, order) => sum + order.total, 0))}</dd>
                        </div>
                        <div className="px-3 py-2.5">
                            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Awaiting</dt>
                            <dd className={waiting > 0 ? "text-lg font-bold tabular-nums text-warning-ink" : "text-lg font-bold tabular-nums"}>{waiting}</dd>
                        </div>
                    </dl>

                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                        {orders.map((order) => (
                            <li key={order.id} className="p-3.5">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                    <Avatar src={order.student.image} name={order.student.name} size={36} />
                                    <div className="min-w-0 flex-1 basis-40">
                                        <p className="truncate text-sm font-semibold">{order.student.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            <span className="font-mono">{order.orderNumber}</span> · {formatDateTime(order.paidAt ?? order.createdAt)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold tabular-nums">{formatBDT(order.total)}</span>
                                        <Badge variant={ORDER_TONE[order.status]} className="capitalize">
                                            {order.status.toLowerCase()}
                                        </Badge>
                                    </div>
                                    {order.status === "PENDING" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            isLoading={confirmPaid.isPending && confirmPaid.variables?.id === order.id}
                                            onClick={async () => {
                                                if (
                                                    await confirmAction({
                                                        title: "Confirm this payment?",
                                                        text: `Only when ${formatBDT(order.total)} has really been paid some other way. Every course in it opens at once.`,
                                                        confirmText: "Confirm payment",
                                                        tone: "default",
                                                    })
                                                ) {
                                                    confirmPaid.mutate(order);
                                                }
                                            }}
                                        >
                                            Confirm paid
                                        </Button>
                                    )}
                                    {order.status === "PAID" && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            isLoading={refund.isPending && refund.variables?.id === order.id}
                                            onClick={async () => {
                                                if (
                                                    await confirmAction({
                                                        title: "Refund the whole bundle?",
                                                        text: "Each course order in it is refunded and the student loses those courses. Send the money back yourself.",
                                                        confirmText: "Refund",
                                                    })
                                                ) {
                                                    refund.mutate(order);
                                                }
                                            }}
                                        >
                                            Refund
                                        </Button>
                                    )}
                                </div>
                                {order.orders.length > 0 && (
                                    <ul className="mt-2.5 flex flex-wrap gap-1.5 sm:pl-12">
                                        {order.orders.map((child) => (
                                            <li key={child.id} className="max-w-full truncate rounded-full bg-secondary px-2.5 py-0.5 text-xs" title={child.course.title}>
                                                {child.course.title} · <span className="tabular-nums">{formatBDT(child.total)}</span>
                                                {child.status !== "PAID" && <span className="text-muted-foreground"> ({child.status.toLowerCase()})</span>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {order.failureReason && order.status !== "PAID" && (
                                    <p className="mt-2 text-xs text-muted-foreground sm:pl-12">{order.failureReason}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </ModalBody>
    );
}
