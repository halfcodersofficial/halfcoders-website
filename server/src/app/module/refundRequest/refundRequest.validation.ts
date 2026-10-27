import z from "zod";

export const requestRefundZodSchema = z.object({
    orderId: z.string().trim().min(1),
    reason: z.string().trim().min(10, "Tell us a little more — at least a sentence").max(2000),
});

export const decideRefundZodSchema = z
    .object({
        decision: z.enum(["APPROVE", "DECLINE"]),
        note: z.string().trim().max(2000).optional(),
    })
    .refine((data) => data.decision === "APPROVE" || Boolean(data.note), {
        path: ["note"],
        message: "Say why it's declined — the student reads this",
    });
