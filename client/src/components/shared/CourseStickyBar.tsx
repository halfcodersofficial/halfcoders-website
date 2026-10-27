"use client";

import { useEffect, useState } from "react";
import EnrollButton from "@/components/shared/EnrollButton";
import type { BatchSchedule } from "@/lib/courseBatch";
import { cn, discountPercent, effectivePrice, formatBDT } from "@/lib/utils";

interface CourseStickyBarProps {
    courseId: string;
    courseSlug: string;
    courseTitle: string;
    isEnrolled: boolean;
    price: number;
    discountPrice: number | null;
    schedule?: BatchSchedule;
    renderedAt?: number;
}

/**
 * The mobile purchase bar.
 *
 * On desktop the price card is sticky in the sidebar and always in view. On a
 * phone that card sits at the very top of a page several thousand pixels long,
 * so by the time someone has read the curriculum and decided to buy, the only
 * way to act on it is to scroll all the way back up. This bar is the fix:
 * an editor's status bar along the foot of the screen, a violet line on top.
 *
 * It appears only after the reader has left the hero — showing it immediately
 * would double up with the price card that is still on screen. The title and
 * price share the top row; the button takes the whole width below.
 */
export default function CourseStickyBar({
    courseId,
    courseSlug,
    courseTitle,
    isEnrolled,
    price,
    discountPrice,
    schedule,
    renderedAt,
}: CourseStickyBarProps) {
    const [visible, setVisible] = useState(false);
    const payable = effectivePrice(price, discountPrice);
    const off = discountPercent(price, discountPrice);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 560);
        onScroll();

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div
            className={cn(
                "fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary bg-background/95 backdrop-blur-md transition-transform duration-300 lg:hidden",
                visible ? "translate-y-0" : "translate-y-full",
            )}
            // Taken out of the keyboard order while off-screen, or tabbing lands
            // on a button nobody can see. `inert` is a first-class boolean prop
            // in React 19 and handles aria-hidden for us.
            inert={!visible}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            {/* Two rows: what and how much, then the button the full width — a phone's whole thumb's reach. */}
            <div className="container-page space-y-2 py-2.5">
                <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs text-muted-foreground">{courseTitle}</p>
                    <p className="flex shrink-0 items-baseline gap-1.5">
                        {payable === 0 ? (
                            <span className="font-mono text-lg font-semibold text-success">ফ্রি</span>
                        ) : (
                            <>
                                <span className="font-mono text-xl font-semibold tracking-tight tabular-nums">{formatBDT(payable)}</span>
                                {off !== null && (
                                    <>
                                        <span className="font-mono text-xs text-muted-foreground line-through">
                                            {formatBDT(price)}
                                        </span>
                                        <span className="rounded-sm bg-syn-tag/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold text-syn-tag">
                                            -{off}%
                                        </span>
                                    </>
                                )}
                            </>
                        )}
                    </p>
                </div>

                <div>
                    <EnrollButton
                        courseId={courseId}
                        courseSlug={courseSlug}
                        isEnrolled={isEnrolled}
                        price={payable}
                        schedule={schedule}
                        renderedAt={renderedAt}
                    />
                </div>
            </div>
        </div>
    );
}
