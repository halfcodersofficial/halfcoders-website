"use client";

import { useRef, type ReactNode } from "react";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "4", "20+", "৪" → a number to count up to; "1:1" is a ratio, not a count. */
const parseCount = (text: string) => {
    const match = /^([0-9০-৯]+)(\+?)$/.exec(text);
    if (!match) return null;
    const bangla = /[০-৯]/.test(match[1]);
    const value = Number(match[1].replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit))));
    return { value, suffix: match[2], bangla };
};

const formatCount = (value: number, bangla: boolean) =>
    bangla ? String(value).replace(/\d/g, (digit) => BANGLA_DIGITS[Number(digit)]) : String(value);

/**
 * The panel rises in, each highlight's text follows in reading order, its
 * number or icon pops in beside it, and the counts ("4 Exams") tick up from
 * zero.
 */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    const panel = root.querySelector<HTMLElement>("[data-hl-panel]");
    const markers = Array.from(root.querySelectorAll<HTMLElement>("[data-hl-marker]"));
    if (!panel) return;

    timeline
        .from(panel, { autoAlpha: 0, y: 28, duration: 0.7, ...SETTLE })
        .from(root.querySelectorAll("[data-hl-text]"), { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.07, ...SETTLE }, 0.2)
        .from(markers, { autoAlpha: 0, scale: 0.4, duration: 0.55, ease: "back.out(2.2)", stagger: 0.07, ...SETTLE }, 0.2);

    markers.forEach((marker, index) => {
        // The number's own text node, changed in place — React rendered it.
        const node = marker.querySelector("[data-hl-count]")?.firstChild;
        if (!(node instanceof Text)) return;
        const count = parseCount(node.nodeValue?.trim() ?? "");
        if (!count) return;

        const tally = { value: 0 };
        const show = () => {
            node.nodeValue = formatCount(Math.round(tally.value), count.bangla) + count.suffix;
        };

        timeline.to(tally, { value: count.value, duration: 0.9, ease: "power2.out", onUpdate: show }, 0.3 + index * 0.07);
        // Zero until its turn, not the final figure waiting to be counted to.
        show();
    });
};

/** The highlights panel's entrance — see `useScrollEntrance` for when it plays. */
export default function CourseHighlightsMotion({ children }: { children: ReactNode }) {
    const rootRef = useRef<HTMLDivElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    return <div ref={rootRef}>{children}</div>;
}
