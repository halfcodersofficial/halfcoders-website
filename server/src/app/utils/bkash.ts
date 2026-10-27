import status from "http-status";
import z from "zod";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";

/**
 * Manual bKash payments. Students pay the merchant account themselves (scan
 * its QR, or "Payment" to its number in the bKash app), then send us the
 * transaction ID bKash gave them and the number they paid from. The order
 * stays PENDING until an admin matches that against the merchant statement
 * and marks it paid (`OrderService.markOrderPaid`) — nothing is granted on
 * the student's word alone.
 */

/** bKash transaction IDs: 10 letters and digits, e.g. "BFH4K9L2QX" (a little slack either side). */
const TRX_ID = /^[A-Z0-9]{8,12}$/;

/** A Bangladeshi mobile number in its local form, 01XXXXXXXXX. */
export const BD_MOBILE = /^01[3-9]\d{8}$/;

/** "+880 1712-345678" / "8801712345678" / "01712 345678" → "01712345678". */
export const normaliseBdMobile = (value: string) => value.replace(/[\s-]/g, "").replace(/^(?:\+?88)?(?=01)/, "");

export const bkashSubmissionZodSchema = z.object({
    transactionId: z
        .string()
        .trim()
        .transform((value) => value.toUpperCase())
        .pipe(z.string().regex(TRX_ID, "Enter the transaction ID from your bKash message (10 letters and numbers).")),
    senderNumber: z
        .string()
        .trim()
        .transform(normaliseBdMobile)
        .pipe(z.string().regex(BD_MOBILE, "Enter the bKash number you paid from, like 01XXXXXXXXX.")),
});

export type BkashSubmission = z.infer<typeof bkashSubmissionZodSchema>;

/** What a submission keeps for the admin who verifies it (`gatewayData`). */
export const bkashGatewayData = (submission: BkashSubmission) => ({
    method: "bkash-merchant",
    senderNumber: submission.senderNumber,
    submittedAt: new Date().toISOString(),
});

/**
 * One bKash transaction pays for one order. A transaction ID already sent in
 * for any other course or bundle order is refused before it can be claimed
 * twice (the unique columns would refuse it anyway, less helpfully).
 */
export const assertTransactionUnused = async (transactionId: string, own: { orderId?: string; bundleOrderId?: string }) => {
    const [payment, bundleOrder] = await Promise.all([
        prisma.payment.findUnique({ where: { transactionId }, select: { orderId: true } }),
        prisma.bundleOrder.findUnique({ where: { transactionId }, select: { id: true } }),
    ]);
    const usedElsewhere = (payment && payment.orderId !== own.orderId) || (bundleOrder && bundleOrder.id !== own.bundleOrderId);
    if (usedElsewhere) {
        throw new AppError(status.CONFLICT, "This transaction ID has already been submitted for another order.");
    }
};
