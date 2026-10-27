"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CourseSection {
    id: string;
    label: string;
}

/** Room kept clear at either end for the arrow, when scrolling a tab into view. */
const EDGE_CLEARANCE = 48;

const scrollBehavior = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/**
 * Which section is being read. `IntersectionObserver` rather than a scroll
 * listener: the callback fires only when a boundary is actually crossed, so
 * there's no per-frame work on a page that already renders a long curriculum.
 * The `rootMargin` pulls the detection band up under the sticky bars and stops
 * it well short of the viewport bottom, so the section you're *reading* is the
 * one that lights up — without it the last short section could never win.
 */
function useActiveSection(sections: CourseSection[]) {
    const [active, setActive] = useState(sections[0]?.id ?? "");

    useEffect(() => {
        const elements = sections
            .map((section) => document.getElementById(section.id))
            .filter((element): element is HTMLElement => element !== null);
        if (elements.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
        );

        elements.forEach((element) => observer.observe(element));
        return () => observer.disconnect();
    }, [sections]);

    return active;
}

/**
 * The course page's sections as editor tabs, sticky under the bar, the one
 * being read underlined in violet — for screens narrower than the outline
 * panel (`CourseOutline`). More tabs than fit scroll sideways with no
 * scrollbar: an end with tabs hidden past it fades out under an arrow that
 * pages the rail along, and the active tab is scrolled into view as the
 * reader moves down the page.
 */
export default function CourseSectionNav({ sections, className }: { sections: CourseSection[]; className?: string }) {
    const active = useActiveSection(sections);
    const [hidden, setHidden] = useState({ start: false, end: false });
    const navRef = useRef<HTMLElement>(null);

    const measure = useCallback(() => {
        const nav = navRef.current;
        if (!nav) return;
        // A pixel of slack: fractional widths leave `scrollLeft` just shy of the end.
        const start = nav.scrollLeft > 1;
        const end = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
        setHidden((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    }, []);

    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return;
        measure();
        nav.addEventListener("scroll", measure, { passive: true });
        const resize = new ResizeObserver(measure);
        resize.observe(nav);
        return () => {
            nav.removeEventListener("scroll", measure);
            resize.disconnect();
        };
    }, [measure, sections]);

    useEffect(() => {
        const nav = navRef.current;
        const tab = nav?.querySelector<HTMLElement>(`[data-section="${CSS.escape(active)}"]`);
        if (!nav || !tab) return;
        const rail = nav.getBoundingClientRect();
        const box = tab.getBoundingClientRect();
        if (box.left < rail.left + EDGE_CLEARANCE) {
            nav.scrollBy({ left: box.left - rail.left - EDGE_CLEARANCE, behavior: scrollBehavior() });
        } else if (box.right > rail.right - EDGE_CLEARANCE) {
            nav.scrollBy({ left: box.right - rail.right + EDGE_CLEARANCE, behavior: scrollBehavior() });
        }
    }, [active]);

    const page = (direction: -1 | 1) => {
        const nav = navRef.current;
        if (nav) nav.scrollBy({ left: direction * nav.clientWidth * 0.7, behavior: scrollBehavior() });
    };

    return (
        <div className={cn("sticky top-16 z-30 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0", className)}>
            <div className="relative">
                <nav ref={navRef} aria-label="কোর্স সেকশন" className="no-scrollbar flex overflow-x-auto">
                    {sections.map((section) => {
                        const current = active === section.id;
                        return (
                            <a
                                key={section.id}
                                href={`#${section.id}`}
                                data-section={section.id}
                                aria-current={current ? "true" : undefined}
                                className={cn(
                                    "relative shrink-0 border-b-2 px-3.5 py-3 text-sm transition-colors",
                                    current ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {section.label}
                            </a>
                        );
                    })}
                </nav>

                {/* Pointer-only: from the keyboard, tabbing to a tab scrolls it into view. */}
                {hidden.start && <ScrollArrow side="start" onClick={() => page(-1)} />}
                {hidden.end && <ScrollArrow side="end" onClick={() => page(1)} />}
            </div>
        </div>
    );
}

/**
 * The same sections as an editor's outline panel: a sticky column on wide
 * screens, the one being read marked by a violet bar down its edge.
 */
export function CourseOutline({ sections, className }: { sections: CourseSection[]; className?: string }) {
    const active = useActiveSection(sections);

    return (
        <nav aria-label="কোর্স সেকশন" className={cn("sticky top-24", className)}>
            <p className="flex items-center gap-1.5 px-3 pb-2 text-xs font-semibold text-muted-foreground">
                <ChevronDown className="size-3.5" aria-hidden />
                এই পেজে
            </p>
            <ol className="border-l border-border">
                {sections.map((section) => {
                    const current = active === section.id;
                    return (
                        <li key={section.id}>
                            <a
                                href={`#${section.id}`}
                                aria-current={current ? "true" : undefined}
                                className={cn(
                                    "-ml-px flex items-baseline gap-2.5 border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors",
                                    current
                                        ? "border-primary bg-primary/5 font-semibold text-foreground"
                                        : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
                                )}
                            >
                                <span className="min-w-0">{section.label}</span>
                            </a>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

function ScrollArrow({ side, onClick }: { side: "start" | "end"; onClick: () => void }) {
    const Icon = side === "start" ? ChevronLeft : ChevronRight;

    return (
        <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={onClick}
            className={cn(
                "absolute inset-y-0 flex w-14 items-center from-background from-45% to-transparent",
                side === "start" ? "left-0 justify-start bg-linear-to-r" : "right-0 justify-end bg-linear-to-l",
            )}
        >
            <span className="grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
                <Icon className="size-4" />
            </span>
        </button>
    );
}
