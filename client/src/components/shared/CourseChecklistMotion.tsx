"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type ReactNode } from "react";

/** Where on the screen a row starts its entrance. */
const START = "top 88%";

/**
 * A checklist's entrance, row by row as each scrolls into view — so a long
 * "What you'll learn" arrives while it's being read, not all at once above
 * the fold. Each row slides in a little, one after another.
 *
 * The same rules as `useScrollEntrance`: rows already on screen when the page
 * loads are left as rendered, nothing moves with reduced motion asked for,
 * and every row ends exactly as the server drew it.
 */
export default function CourseChecklistMotion({ children }: { children: ReactNode }) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();

        media.add("(prefers-reduced-motion: no-preference)", () => {
            const fold = window.innerHeight * 0.88;
            const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-check-item]")).filter(
                (row) => row.getBoundingClientRect().top > fold,
            );
            if (rows.length === 0) return;

            // Hidden until their turn.
            gsap.set(rows, { autoAlpha: 0, x: -18 });

            const triggers = ScrollTrigger.batch(rows, {
                start: START,
                once: true,
                onEnter: (entered) => {
                    entered.forEach((row, index) => {
                        gsap.to(row, { autoAlpha: 1, x: 0, duration: 0.5, delay: index * 0.09, ease: "power3.out", clearProps: "opacity,visibility,transform" });
                    });
                },
            });

            return () => triggers.forEach((trigger) => trigger.kill());
        });

        return () => media.revert();
    }, []);

    return <div ref={rootRef}>{children}</div>;
}
