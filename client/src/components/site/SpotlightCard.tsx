"use client";

import type { CSSProperties, HTMLAttributes, PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps extends HTMLAttributes<HTMLElement> {
    as?: "div" | "li" | "article";
    /** The glow's colour: any CSS colour, usually a syntax token (`var(--syn-func)`). */
    color?: string;
}

/**
 * A card with a soft glow that follows the pointer, its edge lighting up
 * nearest the pointer (`.spotlight` in globals.css). Only on devices that
 * hover; elsewhere it is a plain card. Lay it out like any other element.
 */
export default function SpotlightCard({ as: Tag = "div", color, className, style, onPointerMove, children, ...rest }: SpotlightCardProps) {
    const follow = (event: PointerEvent<HTMLElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
        event.currentTarget.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
        onPointerMove?.(event);
    };

    return (
        <Tag {...rest} onPointerMove={follow} className={cn("spotlight relative", className)} style={{ ...style, ...(color && { "--spot": color }) } as CSSProperties}>
            {children}
        </Tag>
    );
}
