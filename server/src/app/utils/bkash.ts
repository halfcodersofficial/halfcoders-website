import status from "http-status";
import z from "zod";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";

/**
 * Manual payments to the bKash merchant account. Students pay it themselves,
 * one of two ways, then send us what their receipt says:
 *
 * - `bkash` — from the bKash app (scan its QR, or "Payment" to its number):
 *   the transaction ID bKash gave them and the number they paid from.
 * - `bank` — from a bank's app or another wallet, by scanning the same QR
 *   (it's a Bangla QR, so any app that takes Bangla QR can pay it): the
 *   transaction / reference number on that app's receipt, and which bank or
 *   app it was.
 *
 * Either way the money lands in the bKash merchant account, so the gateway
 * stays BKASH. The order stays PENDING until an admin matches the payment
 * against the merchant statement and marks it paid
 * (`OrderService.markOrderPaid`) — nothing is granted on the student's word alone.
 */

/** bKash transaction IDs: 10 letters and digits, e.g. "BFH4K9L2QX" (a little slack either side). */
const TRX_ID = /^[A-Z0-9]{8,12}$/;

/** A bank's or another app's reference: every app writes its own, so letters, digits and - / _ . up to 40. */
const BANK_REF = /^[A-Za-z0-9][A-Za-z0-9\-/_.]{3,39}$/;

/** A Bangladeshi mobile number in its local form, 01XXXXXXXXX. */
export const BD_MOBILE = /^01[3-9]\d{8}$/;

/** "+880 1712-345678" / "8801712345678" / "01712 345678" → "01712345678". */
export const normaliseBdMobile = (value: string) => value.replace(/[\s-]/g, "").replace(/^(?:\+?88)?(?=01)/, "");

const bkashAppSubmission = z.object({
    method: z.literal("bkash"),
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

const bankAppSubmission = z.object({
    method: z.literal("bank"),
    transactionId: z
        .string()
        .transform((value) => value.replace(/\s+/g, ""))
        .pipe(z.string().regex(BANK_REF, "Enter the transaction or reference number from your bank or app's receipt.")),
    paidWith: z
        .string()
        .trim()
        .min(2, "Write which bank or app you paid from.")
        .max(60, "Keep the bank or app name under 60 characters."),
});

/** A submission without `method` comes from the bKash-only form, still open in someone's tab. */
export const bkashSubmissionZodSchema = z.preprocess(
    (body) => (body && typeof body === "object" && !("method" in body) ? { ...body, method: "bkash" } : body),
    z.discriminatedUnion("method", [bkashAppSubmission, bankAppSubmission]),
);

export type BkashSubmission = z.infer<typeof bkashSubmissionZodSchema>;

/** What a submission keeps for the admin who verifies it (`gatewayData`). */
export const bkashGatewayData = (submission: BkashSubmission) => {
    const submittedAt = new Date().toISOString();
    return submission.method === "bank"
        ? { method: "bangla-qr", paidWith: submission.paidWith, submittedAt }
        : { method: "bkash-merchant", senderNumber: submission.senderNumber, submittedAt };
};

/** How the notifications name a submission: "bKash" or "Bangla QR", its number, and where it was paid from. */
export const describeSubmission = (submission: BkashSubmission) =>
    submission.method === "bank"
        ? { via: "Bangla QR", number: `reference ${submission.transactionId}`, from: `paid from ${submission.paidWith}` }
        : { via: "bKash", number: `TrxID ${submission.transactionId}`, from: `from ${submission.senderNumber}` };

/**
 * One transaction pays for one order. A transaction ID already sent in
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
