"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, type RefObject } from "react";

/**
 * Adds a section's entrance to `timeline`. It may return a cleanup, run if the
 * section unmounts — after the timeline has been jumped to its end.
 */
export type EntranceBuilder = (root: HTMLElement, timeline: gsap.core.Timeline) => void | (() => void);

/**
 * Plays a section's entrance once, when it first scrolls into view.
 *
 * The section is server-rendered visible, so one already on screen when the
 * page loads (a reload halfway down, a link to a later section) is left alone
 * rather than hidden and replayed — and with reduced motion asked for, or no
 * JavaScript, it simply stays as rendered.
 *
 * `build` must be stable: a module-level function, not an inline closure.
 * `null` plays nothing — for a component that animates only where asked to.
 */
export function useScrollEntrance(ref: RefObject<HTMLElement | null>, build: EntranceBuilder | null) {
    useEffect(() => {
        const root = ref.current;
        if (!root || !build) return;

        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();

        media.add("(prefers-reduced-motion: no-preference)", () => {
            if (root.getBoundingClientRect().top < window.innerHeight * 0.85) return;

            const timeline = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
            const cleanup = build(root, timeline);

            ScrollTrigger.create({
                trigger: root,
                start: "top 85%",
                once: true,
                onEnter: () => void timeline.play(),
            });

            return () => {
                timeline.progress(1);
                cleanup?.();
            };
        });

        return () => media.revert();
    }, [ref, build]);
}

/** Spread into a `from` tween: once played, the element is left exactly as rendered. */
export const SETTLE = { clearProps: "opacity,visibility,transform" } as const;
