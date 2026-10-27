"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import CouponCapture from "@/components/shared/CouponCapture";
import LoginPopupListener from "@/components/shared/LoginPopupListener";
import NotificationListener from "@/components/shared/NotificationListener";

/**
 * The root layout's always-on listeners: live notifications, login pop-ups and
 * `?coupon=` share links. None of them run on the maintenance page. There's
 * nothing to be signed in to there, and a coupon link keeps its code in the
 * address bar for when the site is back. The segment is the route actually
 * shown, so it's "maintenance" under the middleware's rewrite too.
 */
export default function SiteListeners() {
    if (useSelectedLayoutSegment() === "maintenance") return null;

    return (
        <>
            <NotificationListener />
            <LoginPopupListener />
            <CouponCapture />
        </>
    );
}
