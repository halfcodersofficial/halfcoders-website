"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { saveCoupon } from "@/lib/savedCoupon";
import { formatBDT } from "@/lib/utils";
import { couponService } from "@/services";

/**
 * Picks up `?coupon=CODE` from a share link on any page: checks the code,
 * keeps it for checkout (which applies it by itself) and says what it does —
 * or why it won't — then takes the code out of the address bar so a shared
 * screenshot or a refresh doesn't carry it on. Mounted once, in the root layout.
 */
export default function CouponCapture() {
    useEffect(() => {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("coupon")?.trim();
        if (!code) return;

        url.searchParams.delete("coupon");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

        couponService
            .check(code)
            .then((result) => {
                if (!result.usable) {
                    toast.error(`${result.code}: ${result.reason ?? "এই কোডটি এখন ব্যবহার করা যাবে না।"}`);
                    return;
                }
                saveCoupon(result.code);
                const off =
                    result.kind === "PERCENT"
                        ? `${result.value}% ছাড়${result.maxDiscount ? ` (সর্বোচ্চ ${formatBDT(result.maxDiscount)})` : ""}`
                        : `${formatBDT(result.value ?? 0)} ছাড়`;
                const where = result.allCourses ? "যেকোনো কোর্সে" : result.courses?.length === 1 ? `“${result.courses[0].title}” কোর্সে` : "নির্দিষ্ট কোর্সগুলোতে";
                toast.success(`${result.code} কোড সেভ হয়েছে${result.label ? ` · ${result.label}` : ""}`, {
                    description: `${where} ${off}। চেকআউটে কোডটি নিজে থেকেই যোগ হয়ে যাবে।`,
                    duration: 8000,
                });
            })
            .catch(() => toast.error("কোডটি যাচাই করা গেল না। চেকআউটে নিজে লিখে দেখুন।"));
    }, []);

    return null;
}
