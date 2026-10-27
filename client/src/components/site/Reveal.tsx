"use client";

import { useRef, type ReactNode } from "react";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";

/** A short fade and rise; the block's `data-reveal` parts follow it in, one after another. */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    const parts = root.querySelectorAll("[data-reveal]");
    timeline.from(root, { autoAlpha: 0, y: 16, duration: 0.6, ...SETTLE });
    if (parts.length > 0) {
        timeline.from(parts, { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.08, ...SETTLE }, 0.15);
    }
};

/**
 * The public site's one entrance: a section fades up into place as it first
 * scrolls into view. No scale, no slide-ins, nothing that loops. Plays once,
 * skips anything already on screen at load, and does nothing at all with
 * reduced motion asked for (see `useScrollEntrance`).
 */
export default function Reveal({ children, className }: { children: ReactNode; className?: string }) {
    const rootRef = useRef<HTMLDivElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    return (
        <div ref={rootRef} className={className}>
            {children}
        </div>
    );
}
