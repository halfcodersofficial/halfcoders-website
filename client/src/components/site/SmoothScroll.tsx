"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";
import { setLenis } from "@/lib/smoothScroll";

/** True while a dialog has locked the page (Radix's scroll lock, or a SweetAlert). */
const pageLocked = () => document.body.hasAttribute("data-scroll-locked") || document.body.classList.contains("swal2-shown");

/**
 * Smooth, eased scrolling for the visitor pages (Lenis): the wheel glides
 * rather than jumping, and anchor links ease to their place. It rides the
 * browser's own scroll — the page still scrolls natively underneath — so the
 * sticky navbar, ScrollTrigger entrances and the browser's back/forward
 * positions all keep working; Lenis is driven from GSAP's ticker and tells
 * ScrollTrigger on every frame, so the two never disagree.
 *
 * Left alone: touch (phones keep their own native scrolling), any inner
 * scroller (the FAQ chat, a menu's list — they scroll as they always did),
 * and the page while a dialog has it locked. Off entirely with reduced motion
 * asked for. Renders nothing.
 */
export default function SmoothScroll() {
    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        gsap.registerPlugin(ScrollTrigger);

        const lenis = new Lenis({
            lerp: 0.1,
            anchors: true,
            allowNestedScroll: true,
            stopInertiaOnNavigate: true,
            // Under an open dialog the event is left to the browser, where the dialog's own lock handles it.
            virtualScroll: () => !pageLocked(),
        });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        // Lenis does its own catching-up; GSAP's lag smoothing would make it stutter after a hiccup.
        gsap.ticker.lagSmoothing(0);
        setLenis(lenis);

        return () => {
            setLenis(null);
            gsap.ticker.remove(tick);
            gsap.ticker.lagSmoothing(500, 33);
            lenis.destroy();
        };
    }, []);

    return null;
}
