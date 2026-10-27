import Image from "next/image";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The Half Coders logo, from the brand kit in public/brand/: the round badge
 * (the HC mark on a dark disk in a violet ring) and the HALF CODERS wordmark.
 * These use the tightly cropped copies in public/brand/trimmed/ and size by
 * height — the artwork's real height, not a canvas around it.
 *
 * - `horizontal` — badge + "HALF CODERS" on one line (the navbar)
 * - `tagline`    — the same with the brand line beneath, as real text
 * - `compact`    — badge + the wordmark drawn as separate pieces, a touch
 *                  larger beside a small badge (the phone menu, the console)
 * - `icon`       — the badge alone
 *
 * `onDark` draws the horizontal lockup for a dark ground: a white "HALF", so
 * it sits on any dark colour or glass. Without it, the lockup and the compact
 * wordmark follow the theme: both versions are in the page and the `dark:`
 * variant shows one, so the right one is there from the first paint. (The
 * badge carries its own dark disk, so it needs no dark version.)
 */
export type LogoVariant = "horizontal" | "tagline" | "compact" | "icon";

const ART = {
    horizontal: { src: "/brand/trimmed/lockup-horizontal.png", width: 825, height: 160 },
    horizontalOnDark: { src: "/brand/trimmed/lockup-on-dark.png", width: 825, height: 160 },
    wordmark: { src: "/brand/trimmed/wordmark-compact.png", width: 668, height: 72 },
    wordmarkOnDark: { src: "/brand/trimmed/wordmark-compact-on-dark.png", width: 668, height: 72 },
    icon: { src: "/brand/trimmed/icon.png", width: 384, height: 384 },
} as const;

/** Where "HALF CODERS" begins in the horizontal lockup, as a share of its width. */
const WORDMARK_START = 202 / 825;

/** Height in px each variant is drawn at unless told otherwise. */
const DEFAULT_HEIGHT: Record<LogoVariant, number> = {
    horizontal: 36,
    tagline: 40,
    compact: 30,
    icon: 30,
};

interface LogoProps {
    variant?: LogoVariant;
    /** Height in px of the artwork itself. */
    height?: number;
    className?: string;
    /** Load eagerly — for a logo that is the first thing on screen. */
    priority?: boolean;
    /** The horizontal lockup's light-on-dark colours, for a dark ground. */
    onDark?: boolean;
}

function Art({
    art,
    height,
    alt,
    priority,
    className,
}: {
    art: (typeof ART)[keyof typeof ART];
    height: number;
    alt: string;
    priority?: boolean;
    className?: string;
}) {
    const width = Math.round((height * art.width) / art.height);
    return (
        <Image
            src={art.src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            // SVGs aren't run through the optimiser; the PNGs get a 1x/2x srcset.
            unoptimized={art.src.endsWith(".svg")}
            // Full size where it fits; scales down (never squashes) in a
            // narrower box — a 320px phone's footer, say.
            className={cn("block h-auto max-w-full select-none", className)}
            style={{ width, height: "auto" }}
            draggable={false}
        />
    );
}

export default function Logo({ variant = "horizontal", height, className, priority, onDark }: LogoProps) {
    const h = height ?? DEFAULT_HEIGHT[variant];

    if (variant === "compact") {
        // The wordmark shares the badge's centre line, a little larger than
        // in the full lockup so it still reads at console sizes.
        return (
            <span className={cn("inline-flex items-center", className)} style={{ gap: Math.round(h * 0.28) }}>
                <Art art={ART.icon} height={h} alt="" priority={priority} className="shrink-0" />
                <Art art={ART.wordmark} height={Math.round(h * 0.46)} alt={BRAND_NAME} priority={priority} className="shrink-0 dark:hidden" />
                <Art
                    art={ART.wordmarkOnDark}
                    height={Math.round(h * 0.46)}
                    alt={BRAND_NAME}
                    priority={priority}
                    className="hidden shrink-0 dark:block"
                />
            </span>
        );
    }

    if (variant === "tagline") {
        // The line sits under the wordmark, not the badge.
        const width = (h * ART.horizontal.width) / ART.horizontal.height;
        return (
            <span className={cn("inline-flex max-w-full flex-col", className)}>
                <ThemedLockup height={h} priority={priority} />
                <span
                    className="mt-1 text-xs font-medium text-muted-foreground"
                    style={{ paddingLeft: Math.round(width * WORDMARK_START) }}
                >
                    {BRAND_TAGLINE}
                </span>
            </span>
        );
    }

    if (variant === "icon" || onDark) {
        const art = variant === "icon" ? ART.icon : ART.horizontalOnDark;
        return <Art art={art} height={h} alt={BRAND_NAME} priority={priority} className={className} />;
    }

    // A wrapper carries the caller's classes (a `hidden xs:block`, say), so
    // they can't collide with the pair's own `dark:` switch.
    return (
        <span className={cn("block max-w-full", className)}>
            <ThemedLockup height={h} priority={priority} />
        </span>
    );
}

/** The horizontal lockup in the theme's colours: dark "HALF" on light, white "HALF" on dark. */
function ThemedLockup({ height, priority }: { height: number; priority?: boolean }) {
    return (
        <>
            <Art art={ART.horizontal} height={height} alt={BRAND_NAME} priority={priority} className="dark:hidden" />
            <Art art={ART.horizontalOnDark} height={height} alt={BRAND_NAME} priority={priority} className="hidden dark:block" />
        </>
    );
}
