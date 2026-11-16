import { cn } from "@/lib/utils";
import { BADGE_OUTLINE, LOGO_OUTLINE_VIEWBOX, LOGO_OUTLINE_WIDTH, WORDMARK_OUTLINE } from "./logoOutline";

/* One footer per page, so fixed ids are safe; prefixed so nothing else collides. */
const MARK_ID = "hc-showcase-mark";
const LIGHT_ID = "hc-showcase-light";

/**
 * The logo, large, across the top of the footer: the official badge and
 * wordmark drawn as thin outlines (traced from the brand artwork — see
 * `logoOutline.ts`), dim at rest, with a band of violet light passing over
 * them from left to right. Where the light is, the outline lights up in the
 * brand's violet-to-lavender gradient with a soft neon glow; the badge lights
 * first, then each letter in turn.
 *
 * Two copies of the same outline, stacked: the dim one, and the lit one
 * seen only through a moving soft-edged window (`.showcase-light` in
 * globals.css — a CSS mask sliding across, then a rest before the next
 * pass). The window starts and ends fully off the art, so the loop has no
 * visible seam. With reduced motion asked for, the light stands still and the
 * whole logo glows softly instead.
 *
 * Decoration: the footer's logo just under it already names the site.
 */
export default function FooterShowcase({ className }: { className?: string }) {
    return (
        <div aria-hidden className={cn("relative mx-auto w-full max-w-5xl select-none", className)}>
            {/* A faint violet haze behind the logo, so the glow has somewhere to come from. */}
            <div className="pointer-events-none absolute inset-x-[12%] -inset-y-1/2 bg-[radial-gradient(closest-side,rgb(116_50_240/0.16),transparent)]" />

            {/* At rest: the outline, dim. Also holds the shapes and the gradient the lit copy reuses. */}
            <svg viewBox={LOGO_OUTLINE_VIEWBOX} fill="none" className="relative block h-auto w-full">
                <defs>
                    <g id={MARK_ID}>
                        <path d={BADGE_OUTLINE} vectorEffect="non-scaling-stroke" />
                        <path d={WORDMARK_OUTLINE} vectorEffect="non-scaling-stroke" />
                    </g>
                    <linearGradient id={LIGHT_ID} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={LOGO_OUTLINE_WIDTH} y2="0">
                        {/* As styles, not attributes: an attribute can't read a CSS variable. */}
                        <stop offset="0" style={{ stopColor: "var(--violet-500)" }} />
                        <stop offset="0.25" style={{ stopColor: "var(--violet-400)" }} />
                        <stop offset="0.5" style={{ stopColor: "var(--violet-200)" }} />
                        <stop offset="0.75" style={{ stopColor: "var(--violet-400)" }} />
                        <stop offset="1" style={{ stopColor: "var(--violet-500)" }} />
                    </linearGradient>
                </defs>
                <use href={`#${MARK_ID}`} className="showcase-rest" />
            </svg>

            {/* Lit: the same outline in the gradient, glowing, seen through the moving light. */}
            <div className="showcase-light pointer-events-none absolute inset-0">
                <svg viewBox={LOGO_OUTLINE_VIEWBOX} fill="none" className="showcase-glow block h-full w-full overflow-visible">
                    <use href={`#${MARK_ID}`} stroke={`url(#${LIGHT_ID})`} className="showcase-lit" />
                </svg>
            </div>
        </div>
    );
}
