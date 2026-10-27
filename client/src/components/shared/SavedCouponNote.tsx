"use client";

import { useQuery } from "@tanstack/react-query";
import { TicketPercent, X } from "lucide-react";
import { clearCoupon, useSavedCoupon } from "@/lib/savedCoupon";
import { cn, formatBDT } from "@/lib/utils";
import { couponService } from "@/services";

/**
 * On the course page's purchase card, under the price: what this course
 * costs with the code the visitor came in with — only when the code works
 * on it. Nothing at all otherwise, so a code for other courses never clutters
 * this one. The × forgets the code.
 */
export default function SavedCouponNote({ courseId, price, isEnrolled, className }: { courseId: string; price: number; isEnrolled?: boolean; className?: string }) {
    const code = useSavedCoupon();
    const { data } = useQuery({
        queryKey: ["coupon-check", code, courseId],
        queryFn: () => couponService.check(code as string, courseId),
        enabled: Boolean(code) && price > 0 && !isEnrolled,
        staleTime: 60_000,
    });
    if (!code || !data?.usable || !data.preview || isEnrolled || price <= 0) return null;

    return (
        <div lang="bn" className={cn("flex items-center gap-3 rounded-md border border-dashed border-success/50 bg-success/5 px-3 py-2.5", className)}>
            <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-success/10 text-success-ink">
                <TicketPercent className="size-4" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug">
                <span className="font-mono font-semibold" lang="en">
                    {data.code}
                </span>{" "}
                কোডে আপনি দেবেন <span className="font-semibold tabular-nums">{formatBDT(data.preview.total)}</span>
                <span className="block text-xs text-muted-foreground">
                    {formatBDT(data.preview.off)} ছাড় — চেকআউটে নিজে থেকেই যোগ হবে{data.label ? ` · ${data.label}` : ""}
                </span>
            </p>
            <button
                type="button"
                onClick={clearCoupon}
                aria-label="কোডটি সরিয়ে দিন"
                className="grid size-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
                <X className="size-3.5" aria-hidden />
            </button>
        </div>
    );
}
