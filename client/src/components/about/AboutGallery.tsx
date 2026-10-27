"use client";

import { ArrowDown, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import Section from "@/components/site/Section";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { scrollPageTo } from "@/lib/smoothScroll";
import { cn } from "@/lib/utils";
import { GALLERY } from "./content";
import { DocHeading } from "./paper";

/** How long each stage stays on show: long enough to read its paragraph. */
const SLIDE_MS = 9000;

const SLIDES = GALLERY.slides;
const bnTwo = (value: number) => value.toLocaleString("bn-BD", { minimumIntegerDigits: 2 });

/**
 * The journey, as a slideshow: a stage per photo, each slowly pushing in
 * while it's on show, then crossfading to the next. Bars across the top fill
 * as each stage's time runs (the bar's end is what moves it on, so they
 * never drift apart); the stage's heading and a count sit at the foot, with
 * arrows to step through. Beside it on wide screens, every stage's heading,
 * the current one opened to its paragraph and any of them pickable, and a way
 * down to the team; on narrow ones the paragraph sits under the photo. It
 * rests while pointed at, and with reduced motion asked for it changes only
 * when asked.
 */
export default function AboutGallery() {
    const [index, setIndex] = useState(0);
    const [previous, setPrevious] = useState<number | null>(null);
    const [paused, setPaused] = useState(false);
    const [still, setStill] = useState(true);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setStill(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    const go = (to: number) => {
        setPrevious(index);
        setIndex((to + SLIDES.length) % SLIDES.length);
    };

    const toTeam = (event: MouseEvent<HTMLAnchorElement>) => {
        const team = document.getElementById("team");
        if (!team) return;
        event.preventDefault();
        scrollPageTo(team.getBoundingClientRect().top + window.scrollY - 96);
    };

    return (
        <Section labelledBy="about-gallery-title">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-center lg:gap-14">
                <div>
                    <DocHeading id="about-gallery-title" title={GALLERY.title} lead={GALLERY.description} className="mb-7 sm:mb-7" />
                    <ol className="hidden space-y-1.5 lg:block">
                        {SLIDES.map((slide, slideIndex) => {
                            const current = slideIndex === index;
                            return (
                                <li key={slide.image}>
                                    <button
                                        type="button"
                                        onClick={() => go(slideIndex)}
                                        aria-current={current || undefined}
                                        className={cn(
                                            "grid w-full cursor-pointer grid-cols-[auto_1fr] items-baseline gap-x-3 rounded-md border px-3.5 py-2.5 text-left transition-[color,background-color,border-color] duration-200",
                                            current
                                                ? "border-primary/30 bg-primary/5"
                                                : "border-transparent text-muted-foreground hover:bg-surface hover:text-foreground",
                                        )}
                                    >
                                        <span className="font-mono text-xs opacity-70">{bnTwo(slideIndex + 1)}</span>
                                        <span className={cn("text-sm", current && "font-semibold text-primary")}>{slide.title}</span>
                                        {current && (
                                            <span className="col-start-2 mt-1.5 block text-sm leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none">
                                                {slide.text}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                    <Button asChild variant="brand" size="lg" className="lg:mt-7">
                        <a href="#team" onClick={toTeam} lang="en">
                            {GALLERY.cta} <ArrowDown aria-hidden />
                        </a>
                    </Button>
                </div>

                <div>
                    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
                        {/* A sheet behind, a little turned, so the slideshow sits on a stack. */}
                        <div
                            aria-hidden
                            className="absolute inset-0 translate-x-2 translate-y-3 rotate-2 rounded-panel bg-primary/10 sm:translate-x-4 sm:rotate-3"
                        />

                        <div className="relative aspect-4/3 overflow-hidden rounded-panel border border-border bg-surface shadow-panel">
                            {SLIDES.map((slide, slideIndex) => {
                                const current = slideIndex === index;
                                return (
                                    <div
                                        key={slide.image}
                                        aria-hidden={!current}
                                        className={cn(
                                            "absolute inset-0 transition-opacity duration-700 ease-out",
                                            current ? "opacity-100" : "opacity-0",
                                            // A screenshot cropped to fill would lose its edges; it sits whole on the editor's dark ground.
                                            slide.whole && "bg-editor",
                                        )}
                                    >
                                        <SafeImage
                                            src={slide.image}
                                            alt={slide.title}
                                            fill
                                            sizes="(min-width: 1024px) 55vw, 100vw"
                                            // The push-in stays on the photo fading out, so it doesn't snap back as it goes.
                                            className={cn(
                                                slide.whole ? "object-contain" : "object-cover",
                                                !still && (current || slideIndex === previous) && "animate-[ken-burns_7s_ease-out_both]",
                                            )}
                                            fallback={<ImageOff className="size-8 text-muted-foreground" aria-hidden />}
                                        />
                                    </div>
                                );
                            })}
                            <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/5 to-black/35" />

                            {/* How far through the slideshow, a bar per photo. */}
                            <div aria-hidden className="absolute inset-x-3 top-3 flex gap-1.5">
                                {SLIDES.map((slide, slideIndex) => (
                                    <span key={slide.image} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                                        {slideIndex < index && <span className="block h-full bg-white" />}
                                        {slideIndex === index &&
                                            (still ? (
                                                <span className="block h-full bg-white" />
                                            ) : (
                                                <span
                                                    key={`bar-${index}`}
                                                    onAnimationEnd={() => go(index + 1)}
                                                    className="block h-full origin-left bg-white"
                                                    style={{
                                                        animation: `fill-x ${SLIDE_MS}ms linear both`,
                                                        animationPlayState: paused ? "paused" : "running",
                                                    }}
                                                />
                                            ))}
                                    </span>
                                ))}
                            </div>

                            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 sm:inset-x-5 sm:bottom-5">
                                <p aria-live="polite" className="min-w-0">
                                    <span className="block font-mono text-xs text-white/70">
                                        {bnTwo(index + 1)} / {bnTwo(SLIDES.length)}
                                    </span>
                                    <span
                                        key={index}
                                        className="mt-1 block text-lg font-semibold text-white animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none sm:text-xl"
                                    >
                                        {SLIDES[index].title}
                                    </span>
                                </p>
                                <span className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => go(index - 1)}
                                        aria-label="Previous photo"
                                        className="grid size-10 cursor-pointer place-items-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur transition-colors hover:bg-white hover:text-black"
                                    >
                                        <ChevronLeft className="size-5" aria-hidden />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => go(index + 1)}
                                        aria-label="Next photo"
                                        className="grid size-10 cursor-pointer place-items-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur transition-colors hover:bg-white hover:text-black"
                                    >
                                        <ChevronRight className="size-5" aria-hidden />
                                    </button>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Without the list beside it, the stage's paragraph goes under the photo. */}
                    <p key={index} className="mt-8 leading-relaxed text-muted-foreground animate-in fade-in duration-500 motion-reduce:animate-none lg:hidden">
                        {SLIDES[index].text}
                    </p>
                </div>
            </div>
        </Section>
    );
}
