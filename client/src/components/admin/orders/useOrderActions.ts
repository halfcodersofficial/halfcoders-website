"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatBDT } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminOrder } from "@/types/admin.types";

/**
 * Failing and refunding an order, each behind its confirmation — shared by
 * the order rows and the order detail. Confirming a payment needs a form, so
 * it lives in `SettleForm` instead.
 */
export function useOrderActions({ onDone }: { onDone?: () => void } = {}) {
    const queryClient = useQueryClient();
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin"] });

    const failMutation = useMutation({
        mutationFn: (orderId: string) => adminService.markOrderFailed(orderId, "Payment not received."),
        onSuccess: () => {
            toast.success("Order marked as failed.");
            refresh();
            onDone?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update that order.")),
    });

    const refundMutation = useMutation({
        mutationFn: (orderId: string) => adminService.refundOrder(orderId, "Refunded by admin."),
        onSuccess: () => {
            toast.success("Order refunded and enrolment cancelled.");
            refresh();
            onDone?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't refund that order.")),
    });

    // Bulk-failing is the one safe batch action: confirming a payment needs a
    // gateway and transaction id per order, and refunding en masse is too easy
    // to fire by accident on real money, so both stay one order at a time.
    const bulkFailMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const results = await Promise.allSettled(
                ids.map((id) => adminService.markOrderFailed(id, "Payment not received.")),
            );
            return { total: ids.length, failed: results.filter((r) => r.status === "rejected").length };
        },
        onSuccess: ({ total, failed }) => {
            const succeeded = total - failed;
            if (failed === 0) {
                toast.success(`${succeeded} order${succeeded === 1 ? "" : "s"} marked as failed.`);
            } else {
                toast.error(`${succeeded} of ${total} marked as failed — ${failed} failed to update.`);
            }
            refresh();
            onDone?.();
        },
        onError: () => toast.error("Couldn't update those orders."),
    });

    return {
        fail: async (order: AdminOrder) => {
            if (
                await confirmAction({
                    title: `Mark ${order.orderNumber} as failed?`,
                    text: `${order.student.name} keeps no access. They can place a new order later.`,
                    confirmText: "Mark failed",
                })
            ) {
                failMutation.mutate(order.id);
            }
        },
        refund: async (order: AdminOrder) => {
            if (
                await confirmAction({
                    title: `Refund ${formatBDT(order.total)} to ${order.student.name}?`,
                    text: "Their enrolment is cancelled and they lose access to the course. Progress is kept.",
                    confirmText: "Refund order",
                })
            ) {
                refundMutation.mutate(order.id);
            }
        },
        /** `selected` may include orders in any status; only those awaiting payment are failed. */
        bulkFail: async (selected: AdminOrder[]) => {
            const pendingIds = selected.filter((order) => order.status === "PENDING").map((order) => order.id);
            const skipped = selected.length - pendingIds.length;

            if (pendingIds.length === 0) {
                toast.error("None of the selected orders are awaiting payment.");
                return;
            }

            if (
                await confirmAction({
                    title: `Mark ${pendingIds.length} order${pendingIds.length === 1 ? "" : "s"} as failed?`,
                    text:
                        (skipped > 0
                            ? `${skipped} selected order${skipped === 1 ? "" : "s"} aren't awaiting payment and will be skipped. `
                            : "") + "Those students keep no access. They can place a new order later.",
                    confirmText: "Mark failed",
                })
            ) {
                bulkFailMutation.mutate(pendingIds);
            }
        },
        isFailing: failMutation.isPending,
        isRefunding: refundMutation.isPending,
        isBulkFailing: bulkFailMutation.isPending,
    };
}
