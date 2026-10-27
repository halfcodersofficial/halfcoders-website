"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn, formatBDT } from "@/lib/utils";

/** When the count starts, and how long it runs — after the strike (`.price-strike`), before the tag lands. */
const COUNT_DELAY_MS = 500;
const COUNT_MS = 900;
const STICKER_DELAY = "1.35s";
/** A page that took longer than this to hydrate has had its price read already: leave it be. */
const LATE_HYDRATION_MS = 1500;

const noop = () => () => {};

/**
 * The price on the purchase panel, in mono, with the discount made visible as
 * the panel arrives: the old price is struck through, the new one counts down
 * to its figure from the old, and a `-51%` tag lands beside it, with what you
 * save under the price.
 *
 * The server renders the real price, so it's right without script. The count
 * runs when the component mounts on a client navigation (it starts from the
 * old price before the first paint, so nothing jumps) or hydrates within
 * `LATE_HYDRATION_MS` of the page first painting — any later, the reader has
 * already seen the figure and it isn't moved under them. Never with reduced
 * motion.
 */
export default function CoursePriceTag({
    price,
    original,
    off,
    still = false,
}: {
    price: number;
    original: number;
    off: number | null;
    /** Already struck and stickered, no count — for a copy further down the page, out of view on load. */
    still?: boolean;
}) {
    // False only while hydrating server HTML; true when mounting fresh on the client.
    const freshMount = useSyncExternalStore(noop, () => true, () => false);
    const counts = !still && off !== null && original > price;
    const [shown, setShown] = useState(() => (freshMount && counts && !prefersReducedMotion() ? original : price));

    useEffect(() => {
        if (!counts || prefersReducedMotion()) return setShown(price);
        if (!freshMount && shownForMs() > LATE_HYDRATION_MS) return;

        setShown(original);
        let frame = 0;
        const started = performance.now() + COUNT_DELAY_MS;
        const tick = (now: number) => {
            const progress = Math.min(Math.max((now - started) / COUNT_MS, 0), 1);
            const eased = 1 - (1 - progress) ** 3;
            setShown(Math.round(original - (original - price) * eased));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
        // Runs once per price: a count is the card arriving, not a re-render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [price, original]);

    if (price === 0) return <p className="font-mono text-4xl font-semibold leading-none tracking-tight text-success">ফ্রি কোর্স</p>;

    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <p className="font-mono text-4xl font-semibold leading-none tracking-tight tabular-nums">
                    <span className="sr-only">{formatBDT(price)}</span>
                    <span aria-hidden>{formatBDT(shown)}</span>
                </p>
                {off !== null && (
                    <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                        <span className="relative font-mono text-muted-foreground">
                            <span className="sr-only">আগের দাম </span>
                            {formatBDT(original)}
                            <span
                                aria-hidden
                                className={cn("absolute -inset-x-0.5 top-1/2 h-px -translate-y-1/2 bg-destructive", !still && "price-strike")}
                            />
                        </span>
                        <span className="font-semibold text-success-ink">{formatBDT(original - price)} বাঁচবে</span>
                    </p>
                )}
            </div>

            {off !== null && (
                <span
                    className={cn(
                        "shrink-0 rounded-sm border border-syn-tag/30 bg-syn-tag/10 px-2 py-1 text-center font-mono text-syn-tag",
                        !still && "animate-in fade-in zoom-in-90 fill-mode-both duration-300 motion-reduce:animate-none",
                    )}
                    style={still ? undefined : { animationDelay: STICKER_DELAY }}
                >
                    <span className="block text-lg font-bold leading-none tabular-nums">-{off}%</span>
                    <span className="mt-1 block text-[0.68rem] leading-none">ছাড়</span>
                </span>
            )}
        </div>
    );
}

/** How long the server's HTML has been on screen: since the first paint, so a slow response doesn't count. */
function shownForMs() {
    const paint = performance.getEntriesByName("first-contentful-paint")[0];
    return paint ? performance.now() - paint.startTime : 0;
}

function prefersReducedMotion() {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
