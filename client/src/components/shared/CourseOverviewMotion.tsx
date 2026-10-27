"use client";

import { gsap } from "gsap";
import { useRef, type ReactNode } from "react";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { graphemesOf } from "@/lib/lang";

/** Longest the lead takes to write out, however long it is. */
const MAX_WRITING_SECONDS = 3.2;

/**
 * When each grapheme lands, in seconds, and how far into the text it reaches:
 * an even pace, with a beat after a comma and a longer one at the end of a
 * sentence, the way a hand writes.
 */
const scheduleOf = (graphemes: string[]) => {
    const step = Math.min(0.022, MAX_WRITING_SECONDS / Math.max(graphemes.length, 1));
    const times: number[] = [];
    const ends: number[] = [];
    let time = 0;
    let end = 0;

    for (const grapheme of graphemes) {
        time += step;
        end += grapheme.length;
        times.push(time);
        ends.push(end);
        if (/[,;:]/.test(grapheme)) time += 0.12;
        else if (/[।.!?]/.test(grapheme)) time += 0.28;
    }
    return { times, ends, total: time };
};

/**
 * The lead is written out as if typed, behind a caret; the body paragraphs
 * follow.
 *
 * The lead's own text stays in place, transparent, the whole time, so the
 * page never reflows. The writing is an overlay laid exactly on top of it:
 * the typed part in ink, then the caret, then the rest of the text still
 * there but transparent — the same string, so it wraps exactly as the real
 * text does and a half-typed word never jumps lines. Once written, the caret
 * blinks, and the overlay is removed.
 */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    const lead = root.querySelector<HTMLElement>("[data-overview-lead]");
    const body = root.querySelectorAll("[data-overview-body]");
    let overlay: HTMLElement | null = null;
    let blink: gsap.core.Tween | null = null;

    const settle = () => {
        blink?.kill();
        blink = null;
        overlay?.remove();
        overlay = null;
        if (!lead) return;
        lead.style.removeProperty("position");
        lead.style.removeProperty("color");
        gsap.set(lead, { clearProps: "opacity,visibility" });
    };

    let bodyAt = 0;

    if (lead) {
        const text = lead.textContent ?? "";
        const { times, ends, total } = scheduleOf(graphemesOf(text));
        const pen = { time: 0 };
        let written = 0;
        let typed: Text | null = null;
        let rest: Text | null = null;
        let caret: HTMLElement | null = null;

        gsap.set(lead, { autoAlpha: 0 });

        const begin = () => {
            if (overlay) return;
            const ink = getComputedStyle(lead).color;

            typed = document.createTextNode("");
            rest = document.createTextNode(text);
            caret = document.createElement("span");
            // No advance of its own, so the lines break exactly where the real text's do.
            Object.assign(caret.style, { borderRight: "2px solid var(--primary)", marginRight: "-2px" });
            const unwritten = document.createElement("span");
            unwritten.style.color = "transparent";
            unwritten.append(rest);

            overlay = document.createElement("span");
            overlay.setAttribute("aria-hidden", "true");
            Object.assign(overlay.style, { position: "absolute", inset: "0", color: ink, pointerEvents: "none" });
            overlay.append(typed, caret, unwritten);

            lead.style.position = "relative";
            lead.style.color = "transparent";
            lead.append(overlay);
            gsap.set(lead, { autoAlpha: 1 });
        };

        const write = () => {
            if (!typed || !rest) return;
            let count = written;
            while (count < times.length && times[count] <= pen.time) count++;
            if (count === written) return;
            written = count;
            const end = ends[count - 1];
            typed.nodeValue = text.slice(0, end);
            rest.nodeValue = text.slice(end);
        };

        const finish = () => {
            if (!caret) return settle();
            blink = gsap.to(caret, { opacity: 0, duration: 0.35, repeat: 2, yoyo: true, ease: "steps(1)", onComplete: settle });
        };

        timeline.to(
            pen,
            { time: total, duration: total, ease: "none", onStart: begin, onUpdate: write, onComplete: finish },
            0,
        );
        // Under way before the lead is finished, so the page isn't left blank below it.
        bodyAt = Math.min(total * 0.6, 1.4);
    }

    timeline.from(body, { autoAlpha: 0, y: 16, duration: 0.7, stagger: 0.12, ...SETTLE }, bodyAt);

    return settle;
};

/** The overview's entrance — see `useScrollEntrance` for when it plays. */
export default function CourseOverviewMotion({ children }: { children: ReactNode }) {
    const rootRef = useRef<HTMLDivElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    return <div ref={rootRef}>{children}</div>;
}
