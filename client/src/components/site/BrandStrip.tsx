import { Sparkle } from "lucide-react";
import type { ReactNode } from "react";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** What the strip says, once: the name and what it is, then the tagline. */
const LEAD = "Learning in Bangla";

/**
 * Copies of the line in each half of the track. One copy is about 560px
 * wide, so six keep a half wider than any screen (ultra-wide included) and
 * the strip never shows a gap before the loop comes round.
 */
const COPIES_PER_HALF = 6;

/** One copy of the line: ● Half Coders — Learning in Bangla ✦ Learn. Build. Grow Together. ✦ */
function Line() {
    return (
        <span className="flex shrink-0 items-center">
            <span className="inline-flex items-center gap-2.5 px-6">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-green-300 shadow-[0_0_0_3px_rgb(134_239_172/0.22)]" />
                <span className="font-semibold">{BRAND_NAME}</span>
                <span className="text-primary-foreground/55">—</span>
                <span>{LEAD}</span>
            </span>
            <Sparkle aria-hidden className="size-3 shrink-0 fill-current text-primary-foreground/55" />
            <span className="px-6 font-semibold tracking-wide">{BRAND_TAGLINE}</span>
            <Sparkle aria-hidden className="size-3 shrink-0 fill-current text-primary-foreground/55" />
        </span>
    );
}

/**
 * A full-width violet strip that carries the brand line — the name, "Learning
 * in Bangla" and the tagline — gliding from left to right, like a long status
 * message rolling along an editor's status bar.
 *
 * The track is two identical halves, each wider than the screen, moved by
 * exactly one half (`ticker-right` in globals.css), so where the loop starts
 * again looks the same as where it ended: no jump, no gap. Pure CSS. It
 * pauses under the pointer.
 *
 * With reduced motion asked for, the moving track is swapped for the same
 * words standing still — the name on the left, the tagline on the right.
 * Screen readers get the line once, not the repeats.
 *
 * `end` is pinned at the right edge, outside the moving part (the footer puts
 * the time in Dhaka there).
 */
export default function BrandStrip({ end, className }: { end?: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "relative flex h-10 items-stretch overflow-hidden bg-primary font-mono text-xs text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]",
                className,
            )}
        >
            <p className="sr-only">
                {BRAND_NAME} — {LEAD}. {BRAND_TAGLINE}
            </p>

            <div className="relative min-w-0 flex-1 overflow-hidden">
                {/* Moving: two halves, faded in and out at the edges. */}
                <div
                    aria-hidden
                    className="hidden h-full items-center [mask-image:linear-gradient(90deg,transparent,#000_5%,#000_95%,transparent)] motion-safe:flex"
                >
                    <div className="flex w-max animate-ticker-right whitespace-nowrap will-change-transform hover:[animation-play-state:paused]">
                        {Array.from({ length: COPIES_PER_HALF * 2 }, (_, index) => (
                            <Line key={index} />
                        ))}
                    </div>
                </div>

                {/* Standing still (reduced motion): the line laid out once, end to end. */}
                <div aria-hidden className="container-page flex h-full items-center justify-between gap-4 whitespace-nowrap motion-safe:hidden">
                    <span className="inline-flex min-w-0 items-center gap-2.5">
                        <span className="size-1.5 shrink-0 rounded-full bg-green-300" />
                        <span className="font-semibold">{BRAND_NAME}</span>
                        <span className="text-primary-foreground/55">—</span>
                        <span className="truncate">{LEAD}</span>
                    </span>
                    <span className="hidden font-semibold tracking-wide sm:inline">{BRAND_TAGLINE}</span>
                </div>
            </div>

            {end && (
                <div className="relative flex shrink-0 items-center border-l border-primary-foreground/20 px-4 text-[0.68rem] sm:px-5">
                    {end}
                </div>
            )}
        </div>
    );
}
