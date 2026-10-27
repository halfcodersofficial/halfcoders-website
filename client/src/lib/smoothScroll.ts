import type Lenis from "lenis";

/*
 * The visitor pages' smooth scroll (components/site/SmoothScroll.tsx), for
 * code that moves the page itself: it scrolls with the same easing when
 * smooth scrolling is on, and falls back to the browser when it isn't (signed-
 * in screens, reduced motion).
 */

let instance: Lenis | null = null;

export const setLenis = (lenis: Lenis | null) => {
    instance = lenis;
};

/** Scroll the page to `top` (px), eased, unless reduced motion is asked for. */
export function scrollPageTo(top: number) {
    if (instance) {
        instance.scrollTo(top);
        return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
}
