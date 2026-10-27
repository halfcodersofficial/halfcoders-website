"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flag, ImageOff } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { scrollPageTo } from "@/lib/smoothScroll";
import { cn } from "@/lib/utils";
import { TIMELINE } from "./content";
import { DocHeading } from "./paper";

const ITEMS = TIMELINE.items;
const LAST = ITEMS.length - 1;

/* How each print lies on the stack once it has landed: a turn and a nudge of its own. */
const LIE = [
    { rotate: -6, x: -18, y: 10 },
    { rotate: 5, x: 16, y: -6 },
    { rotate: -3, x: -8, y: -12 },
    { rotate: 4, x: 12, y: 8 },
    { rotate: -1.5, x: 0, y: 0 },
];

/** How far to scroll, in screen heights, to move from one stop to the next while the band is held. */
const SCREENS_PER_STOP = 0.7;

const bn = (value: number) => value.toLocaleString("bn-BD", { minimumIntegerDigits: 2 });

/** Where print `index` sits while stop `active` is showing: under it (landed), on top (current) or still in the air (to come). */
function printStyle(index: number, active: number): CSSProperties {
    const lie = LIE[index % LIE.length];
    const centre = "translate(-50%, -50%)";
    if (index === active) {
        return { transform: `${centre} rotate(${lie.rotate / 3}deg) scale(1)`, opacity: 1, zIndex: 20 };
    }
    if (index < active) {
        return { transform: `${centre} translate(${lie.x}px, ${lie.y}px) rotate(${lie.rotate}deg) scale(0.93)`, opacity: 1, zIndex: index };
    }
    return { transform: `${centre} translate(60px, -70px) rotate(${lie.rotate * 2.5}deg) scale(1.06)`, opacity: 0, zIndex: index };
}

const buildList: EntranceBuilder = (root, timeline) => {
    timeline.from(root.querySelectorAll("[data-entry]"), { autoAlpha: 0, y: 30, duration: 0.55, stagger: 0.1, ...SETTLE });
};

/**
 * The road so far and the next stretch, told one stop at a time. On wide
 * screens: a stack of photos like prints on a table beside the story of the
 * current stop and a list of all the stops. Scrolling holds the band in
 * place and walks through the stops — each new photo drops onto the stack,
 * the story changes, and the list lights up to where you are; picking a stop
 * jumps there. (With reduced motion asked for, nothing is held: the list is
 * simply picked from.) On a phone, the stops are a plain list down the page,
 * each with its photo. The stop still ahead is drawn dashed.
 */
export default function AboutTimeline() {
    const sectionRef = useRef<HTMLElement>(null);
    const listRef = useRef<HTMLOListElement>(null);
    const triggerRef = useRef<ScrollTrigger | null>(null);
    const [active, setActive] = useState(0);
    useScrollEntrance(listRef, buildList);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();

        media.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
            triggerRef.current = ScrollTrigger.create({
                trigger: section,
                start: "top top",
                end: () => `+=${window.innerHeight * SCREENS_PER_STOP * LAST}`,
                pin: true,
                invalidateOnRefresh: true,
                onUpdate: (self) => setActive(Math.min(LAST, Math.round(self.progress * LAST))),
            });
            // The pin adds room to the page; everything below needs to know where it now sits.
            ScrollTrigger.refresh();

            return () => {
                triggerRef.current = null;
            };
        });

        return () => media.revert();
    }, []);

    /** Go to a stop: while the band is held, by scrolling to its place; otherwise straight there. */
    const show = (index: number) => {
        const trigger = triggerRef.current;
        if (!trigger) {
            setActive(index);
            return;
        }
        scrollPageTo(trigger.start + ((trigger.end - trigger.start) * index) / LAST + 1);
    };

    const current = ITEMS[active];

    return (
        <section
            ref={sectionRef}
            aria-labelledby="about-timeline-title"
            className="section relative overflow-hidden border-y border-border bg-surface"
        >
            <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-60" />
            <div className="container-page relative">
                <DocHeading id="about-timeline-title" title={TIMELINE.title} lead={TIMELINE.description} className="mb-10 lg:mb-8" />

                {/* Wide screens: the stack, the story, the stops. */}
                <div className="hidden grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-14 lg:grid">
                    <div aria-hidden className="relative h-[min(30rem,58vh)]">
                        {ITEMS.map((item, index) => (
                            <figure
                                key={item.title}
                                className={cn(
                                    "absolute left-1/2 top-1/2 w-[min(100%,27rem)] bg-white p-2.5 pb-11 shadow-[0_24px_50px_-26px_rgb(21_17_42/0.55)] ring-1 ring-black/5 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.2,0.9,0.3,1.15)] motion-reduce:transition-none",
                                    item.upcoming && "outline-2 -outline-offset-8 outline-dashed outline-primary/40",
                                )}
                                style={printStyle(index, active)}
                            >
                                <div className={cn("relative aspect-4/3 overflow-hidden", item.whole ? "bg-editor" : "bg-surface")}>
                                    <SafeImage
                                        src={item.image}
                                        alt=""
                                        fill
                                        sizes="27rem"
                                        className={cn(item.whole ? "object-contain" : "object-cover", item.upcoming && "grayscale-[0.7]")}
                                        fallback={<ImageOff className="size-7 text-muted-foreground" />}
                                    />
                                </div>
                                <figcaption className="absolute inset-x-4 bottom-2.5 flex items-center justify-between font-heading text-lg text-foreground/80">
                                    <span>{item.tag}</span>
                                    <span className="font-mono text-xs text-muted-foreground">{bn(index + 1)}</span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>

                    <div>
                        <div aria-live="polite" className="min-h-52">
                            <div key={active} className="animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none">
                                <p className="flex items-center gap-3">
                                    <span
                                        className={cn(
                                            "rounded-full px-3 py-1 text-sm font-semibold",
                                            current.upcoming
                                                ? "border border-dashed border-primary/60 text-primary"
                                                : "bg-primary text-primary-foreground",
                                        )}
                                    >
                                        {current.tag}
                                    </span>
                                    <span className="font-mono text-sm text-muted-foreground">
                                        {bn(active + 1)} / {bn(ITEMS.length)}
                                    </span>
                                </p>
                                <h3 className="mt-5 text-h2 text-balance">{current.title}</h3>
                                <p className="mt-4 max-w-xl text-lg leading-relaxed text-foreground/80">{current.text}</p>
                            </div>
                        </div>

                        {/* All the stops, lit up to where you are. */}
                        <ol className="relative mt-8 space-y-1 border-l-2 border-border">
                            <span
                                aria-hidden
                                className="absolute -left-0.5 top-0 h-full w-0.5 origin-top bg-primary transition-transform duration-500 ease-out"
                                style={{ transform: `scaleY(${active / LAST})` }}
                            />
                            {ITEMS.map((item, index) => {
                                const here = index === active;
                                const passed = index < active;
                                return (
                                    <li key={item.title}>
                                        <button
                                            type="button"
                                            onClick={() => show(index)}
                                            aria-current={here ? "step" : undefined}
                                            className={cn(
                                                "group relative flex w-full cursor-pointer items-center gap-3 py-2 pl-6 pr-3 text-left transition-colors duration-200",
                                                here
                                                    ? "text-primary"
                                                    : passed
                                                      ? "text-foreground/80 hover:text-primary"
                                                      : "text-muted-foreground hover:text-foreground",
                                            )}
                                        >
                                            <span
                                                aria-hidden
                                                className={cn(
                                                    "absolute -left-1.75 grid size-3 place-items-center rounded-full border-2 bg-surface transition-[background-color,border-color,scale] duration-300",
                                                    here
                                                        ? "scale-125 border-primary bg-primary"
                                                        : passed
                                                          ? "border-primary bg-primary"
                                                          : "border-border-strong",
                                                    item.upcoming && !here && "border-dashed",
                                                )}
                                            />
                                            <span className="w-24 shrink-0 text-sm font-semibold">{item.tag}</span>
                                            <span className={cn("truncate text-sm", here && "font-semibold")}>{item.title}</span>
                                            {item.upcoming && <Flag className="ml-auto size-3.5 shrink-0 opacity-60" aria-hidden />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </div>

                {/* Phones: the stops as a list down the page. */}
                <ol ref={listRef} className="relative space-y-12 lg:hidden">
                    <span aria-hidden className="absolute bottom-2 left-4 top-2 w-0.5 -translate-x-1/2 rounded-full bg-primary/30" />
                    {ITEMS.map((item, index) => (
                        <li key={item.title} data-entry className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4">
                            <span
                                aria-hidden
                                className={cn(
                                    "relative z-10 grid size-8 place-items-center rounded-full border-2 font-mono text-xs font-bold",
                                    item.upcoming
                                        ? "border-dashed border-primary bg-surface text-primary"
                                        : "border-primary bg-primary text-primary-foreground",
                                )}
                            >
                                {item.upcoming ? <Flag className="size-3.5" /> : (index + 1).toLocaleString("bn-BD")}
                            </span>
                            <div>
                                <span
                                    className={cn(
                                        "inline-flex rounded-full px-3 py-0.5 text-xs font-semibold",
                                        item.upcoming ? "border border-dashed border-primary/60 text-primary" : "bg-primary/10 text-primary",
                                    )}
                                >
                                    {item.tag}
                                </span>
                                <h3 className="mt-2 text-xl font-semibold">{item.title}</h3>
                                <p className="mt-1.5 leading-relaxed text-muted-foreground">{item.text}</p>
                                <figure
                                    className={cn(
                                        "mt-4 bg-white p-2 pb-2.5 shadow-[0_16px_34px_-20px_rgb(21_17_42/0.5)] ring-1 ring-black/5",
                                        index % 2 ? "rotate-1" : "-rotate-1",
                                    )}
                                >
                                    <div className={cn("relative aspect-16/10 overflow-hidden", item.whole ? "bg-editor" : "bg-surface")}>
                                        <SafeImage
                                            src={item.image}
                                            alt=""
                                            fill
                                            sizes="90vw"
                                            className={cn(item.whole ? "object-contain" : "object-cover", item.upcoming && "grayscale-[0.7]")}
                                            fallback={<ImageOff className="size-7 text-muted-foreground" aria-hidden />}
                                        />
                                    </div>
                                </figure>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
