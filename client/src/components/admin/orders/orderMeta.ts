import type { OrderStatus } from "@/types/api.types";

export const GATEWAYS = [
    { value: "BKASH", label: "bKash" },
    { value: "MANUAL", label: "Cash / bank transfer" },
];

/**
 * What a student sent in after paying the bKash merchant account, if this
 * order has it: from the bKash app (TrxID and the number paid from), or by
 * Bangla QR from a bank or another app (that app's reference and its name, `paidWith`).
 */
export const bkashSentIn = (payment: { gateway: string | null; transactionId: string | null; gatewayData: unknown } | null) => {
    if (payment?.gateway !== "BKASH" || !payment.transactionId) return null;
    const data = (payment.gatewayData ?? {}) as { senderNumber?: string; paidWith?: string; submittedAt?: string };
    return {
        transactionId: payment.transactionId,
        senderNumber: data.senderNumber ?? null,
        paidWith: data.paidWith ?? null,
        submittedAt: data.submittedAt ?? null,
    };
};

/** One line for what was sent in: "TrxID X, from 017…" or "Reference X, by Bangla QR from City Bank". */
export const sentInSummary = (sentIn: NonNullable<ReturnType<typeof bkashSentIn>>) =>
    sentIn.paidWith
        ? `Reference ${sentIn.transactionId}, by Bangla QR from ${sentIn.paidWith}`
        : `TrxID ${sentIn.transactionId}${sentIn.senderNumber ? `, from ${sentIn.senderNumber}` : ""}`;

export const gatewayLabel = (value: string) => GATEWAYS.find((gateway) => gateway.value === value)?.label ?? value;

/**
 * How each status is drawn on the Payments screens — the bar segment, the
 * legend dot and the row's edge. Labels come from `StatusPill` so the words
 * match the rest of the console.
 */
export const ORDER_TONE: Record<OrderStatus, { fill: string; text: string }> = {
    PAID: { fill: "bg-success", text: "text-success" },
    PENDING: { fill: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
    FAILED: { fill: "bg-destructive", text: "text-destructive" },
    REFUNDED: { fill: "bg-muted-foreground/50", text: "text-muted-foreground" },
    CANCELLED: { fill: "bg-muted-foreground/25", text: "text-muted-foreground" },
};

/** Bar and legend order: money in, money waiting, then what didn't happen. */
export const ORDER_STATUS_ORDER: OrderStatus[] = ["PAID", "PENDING", "FAILED", "REFUNDED", "CANCELLED"];
