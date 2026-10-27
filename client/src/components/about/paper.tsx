"use client";

import { Link2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * The About page's own kit. The rest of the site is dressed as a code editor;
 * About reads like the project's README, set on paper: `##` headings ruled
 * underneath with a link that shows on hover, cards that tilt like a sheet
 * picked up, and notes called out the way a README does.
 */

/**
 * A README heading: `##`, the title, a hairline rule under it, and a link to
 * the heading that shows when pointed at. Optionally a line of lead text.
 * Inherits its colour, so it reads on paper and on the dark band alike.
 */
export function DocHeading({
    id,
    title,
    lead,
    align = "start",
    className,
}: {
    id: string;
    title: ReactNode;
    lead?: ReactNode;
    align?: "start" | "center";
    className?: string;
}) {
    const centred = align === "center";
    return (
        <div className={cn("mb-10 sm:mb-12", centred && "mx-auto max-w-3xl text-center", className)}>
            <h2 id={id} className="group/heading scroll-mt-28 border-b border-current/10 pb-4 text-h2 text-balance">
                <span aria-hidden className="mr-3 font-mono font-normal text-syn-comment">
                    ##
                </span>
                {title}
                <a
                    href={`#${id}`}
                    aria-hidden
                    tabIndex={-1}
                    className="ml-2 inline-grid size-7 translate-y-[-0.15em] place-items-center rounded-md align-middle text-current/40 opacity-0 transition-opacity duration-200 hover:text-primary group-hover/heading:opacity-100"
                >
                    <Link2 className="size-4" />
                </a>
            </h2>
            {lead && <p className={cn("mt-4 text-lead text-current/70", centred && "mx-auto max-w-2xl")}>{lead}</p>}
        </div>
    );
}

interface TiltCardProps extends HTMLAttributes<HTMLDivElement> {
    /** How far it leans at the edges, in degrees. */
    max?: number;
}

/**
 * A card that leans toward the pointer like a sheet of paper picked up, a
 * soft light following the pointer across it. Mouse only, and not at all
 * with reduced motion asked for. Put entrance animations on a wrapper, not
 * on this: its own transform is the tilt.
 */
export function TiltCard({ max = 7, className, style, children, onPointerMove, onPointerLeave, ...rest }: TiltCardProps) {
    const still = useRef(true);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => void (still.current = media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    const lean = (event: PointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        if (still.current || event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        event.currentTarget.style.setProperty("--tilt-x", `${(0.5 - y) * max}deg`);
        event.currentTarget.style.setProperty("--tilt-y", `${(x - 0.5) * max}deg`);
        event.currentTarget.style.setProperty("--light-x", `${x * 100}%`);
        event.currentTarget.style.setProperty("--light-y", `${y * 100}%`);
    };

    const settle = (event: PointerEvent<HTMLDivElement>) => {
        onPointerLeave?.(event);
        event.currentTarget.style.setProperty("--tilt-x", "0deg");
        event.currentTarget.style.setProperty("--tilt-y", "0deg");
    };

    return (
        <div
            {...rest}
            onPointerMove={lean}
            onPointerLeave={settle}
            className={cn("group relative transition-[transform,box-shadow] duration-300 ease-out", className)}
            style={{ transform: "perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))", ...style } as CSSProperties}
        >
            {children}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background: "radial-gradient(20rem circle at var(--light-x, 50%) var(--light-y, 0%), rgb(255 255 255 / 0.55), transparent 55%)",
                }}
            />
        </div>
    );
}

const CALLOUT_TONE = {
    keyword: { box: "border-syn-keyword bg-syn-keyword/5", label: "text-syn-keyword" },
    string: { box: "border-syn-string bg-syn-string/5", label: "text-syn-string" },
    func: { box: "border-syn-func bg-syn-func/5", label: "text-syn-func" },
} as const;

/** A note called out the way a README does: a coloured edge, a labelled first line, the text. */
export function Callout({
    label,
    icon: Icon,
    tone = "keyword",
    children,
}: {
    label: string;
    icon: LucideIcon;
    tone?: keyof typeof CALLOUT_TONE;
    children: ReactNode;
}) {
    const colours = CALLOUT_TONE[tone];
    return (
        <div className={cn("rounded-r-md border-l-4 px-5 py-4", colours.box)}>
            <p className={cn("flex items-center gap-2 text-sm font-semibold", colours.label)}>
                <Icon className="size-4" aria-hidden />
                {label}
            </p>
            <p className="mt-1.5 leading-relaxed text-foreground/85">{children}</p>
        </div>
    );
}
