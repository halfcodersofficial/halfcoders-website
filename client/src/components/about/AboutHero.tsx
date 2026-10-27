"use client";

import { BellRing, ImageOff } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import CtaButton from "@/components/site/CtaButton";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
import { HERO } from "./content";

const BADGE_TONE: Record<(typeof HERO.badges)[number]["tone"], string> = {
    string: "bg-syn-string/10 text-syn-string",
    keyword: "bg-syn-keyword/10 text-syn-keyword",
    func: "bg-syn-func/10 text-syn-func",
    number: "bg-syn-number/10 text-syn-number",
};

/** How long each update stays on the middle photo. */
const UPDATE_MS = 2800;

/** Played once as the page opens (CSS, so it starts before the page is interactive): a rise and fade, after `delay` ms. */
const rise = (delay: number): CSSProperties => ({ animationDelay: `${delay}ms`, animationDuration: "700ms", animationFillMode: "both" });

/**
 * The top of the About page, on dotted paper rather than in the editor: the
 * name as a README's `#` line, then the headline with a marker line drawing
 * itself under its last words, what Half Coders is, the badges and the two
 * ways in. Under it, three photos laid out like prints on a table — the
 * middle one larger, the others turned — that straighten and lift when
 * pointed at; the middle one shows a live class with updates arriving one
 * after another, and a mentor's sticky note is stuck beside them.
 */
export default function AboutHero() {
    const [left, middle, right] = HERO.photos;
    const [update, setUpdate] = useState(0);
    const [still, setStill] = useState(true);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setStill(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        if (still) return;
        const timer = window.setInterval(() => setUpdate((current) => (current + 1) % HERO.updates.length), UPDATE_MS);
        return () => window.clearInterval(timer);
    }, [still]);

    const enter = "animate-in fade-in slide-in-from-bottom-6 motion-reduce:animate-none";

    return (
        <header className="relative overflow-hidden border-b border-border">
            <div
                aria-hidden
                className="bg-dots pointer-events-none absolute inset-0 mask-[radial-gradient(ellipse_80%_70%_at_50%_30%,#000_35%,transparent_85%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -top-56 left-1/2 size-192 -translate-x-1/2 rounded-full bg-violet-400/15 blur-3xl"
            />

            <div className="container-page relative pb-16 pt-12 text-center sm:pb-24 sm:pt-16">
                <p lang="en" className={cn("font-mono text-sm text-syn-comment", enter)} style={rise(0)}>
                    <span aria-hidden># </span>
                    {HERO.title}
                </p>
                <h1 className={cn("mx-auto mt-4 max-w-4xl text-display text-balance", enter)} style={rise(80)}>
                    {HERO.headline.lead}{" "}
                    <span className="relative inline-block whitespace-nowrap text-primary">
                        {HERO.headline.mark}
                        <svg
                            aria-hidden
                            viewBox="0 0 300 20"
                            preserveAspectRatio="none"
                            className="absolute -bottom-2 left-0 h-3 w-full text-syn-number sm:-bottom-3 sm:h-4"
                        >
                            <path
                                d="M4 13 C 60 5, 120 3, 180 8 S 268 16, 296 6"
                                pathLength={1}
                                strokeDasharray={1}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={5}
                                strokeLinecap="round"
                                className="animate-[draw-line_0.9s_ease-out_0.6s_both] motion-reduce:animate-none"
                            />
                        </svg>
                    </span>
                </h1>
                <p className={cn("mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground", enter)} style={rise(160)}>
                    {HERO.body}
                </p>

                <ul className={cn("mt-7 flex flex-wrap justify-center gap-2", enter)} style={rise(240)} aria-label="At a glance">
                    {HERO.badges.map((badge) => (
                        <li key={badge.label} className="inline-flex overflow-hidden rounded-sm border border-border bg-card text-[0.72rem]">
                            <span className="bg-surface px-2 py-1 text-muted-foreground">{badge.label}</span>
                            <span className={cn("px-2 py-1 font-semibold", BADGE_TONE[badge.tone])}>{badge.value}</span>
                        </li>
                    ))}
                </ul>

                <div className={cn("mt-8 flex flex-wrap justify-center gap-3", enter)} style={rise(320)}>
                    <CtaButton kind="enroll" size="lg" />
                    <CtaButton kind="courses" size="lg" />
                </div>

                {/* The prints on the table. */}
                <div className="relative mx-auto mt-14 h-64 max-w-5xl xs:h-72 sm:mt-16 sm:h-96 lg:h-112">
                    <Print photo={left} delay={420} className="left-0 top-10 z-10 w-[40%] -rotate-6 sm:w-[30%]" />
                    <Print photo={right} delay={520} className="right-0 top-14 z-10 w-[40%] rotate-6 sm:w-[30%]" />
                    <Print photo={middle} delay={360} priority className="left-1/2 top-0 z-20 w-[64%] -translate-x-1/2 rotate-1 sm:w-[46%]">
                        <span className="absolute left-2.5 top-2.5 flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1 text-[0.7rem] font-semibold text-white backdrop-blur sm:left-3 sm:top-3 sm:text-xs">
                            <span className="relative flex size-2">
                                <span className="absolute inset-0 animate-ping rounded-full bg-syn-tag/80 motion-reduce:animate-none" />
                                <span className="relative size-2 rounded-full bg-syn-tag" />
                            </span>
                            {HERO.live}
                        </span>
                        <span className="absolute inset-x-2.5 bottom-2.5 hidden sm:inset-x-3 sm:bottom-3 sm:flex">
                            <span
                                key={update}
                                className="flex max-w-full items-center gap-2 rounded-md bg-card/90 px-3 py-2 text-left text-sm text-foreground shadow-card backdrop-blur animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none"
                            >
                                <BellRing className="size-4 shrink-0 text-primary" aria-hidden />
                                <span className="truncate">{HERO.updates[update]}</span>
                            </span>
                        </span>
                    </Print>

                    {/* The mentor's sticky note. */}
                    <div
                        aria-hidden
                        className="absolute -bottom-6 right-[3%] z-30 hidden w-56 rotate-3 bg-amber-100 px-4 pb-4 pt-5 text-left text-amber-950 shadow-[0_14px_30px_-14px_rgb(120_80_0/0.5)] animate-[float-y_5s_ease-in-out_infinite] motion-reduce:animate-none md:block"
                    >
                        <span className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-3 bg-white/70 ring-1 ring-black/5" />
                        <span className="block text-xs font-semibold text-amber-800">{HERO.note.label}</span>
                        <span className="mt-1 block font-heading text-base leading-snug">{HERO.note.text}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

/** A photo printed with a white border and its caption written on it, turned a little; straightening and lifting when pointed at. */
function Print({
    photo,
    delay,
    priority,
    className,
    children,
}: {
    photo: (typeof HERO.photos)[number];
    delay: number;
    priority?: boolean;
    className?: string;
    children?: ReactNode;
}) {
    return (
        <figure
            className={cn(
                "absolute rounded-[3px] bg-white p-1.5 pb-7 shadow-[0_22px_45px_-22px_rgb(21_17_42/0.5)] ring-1 ring-black/5 transition-[rotate,translate,scale,box-shadow] duration-500 ease-out hover:z-40 hover:-translate-y-2 hover:rotate-0 hover:scale-[1.03] hover:shadow-[0_30px_60px_-24px_rgb(21_17_42/0.55)] motion-reduce:hover:translate-y-0 sm:p-2 sm:pb-9",
                "animate-in fade-in slide-in-from-bottom-10 motion-reduce:animate-none",
                className,
            )}
            style={rise(delay)}
        >
            <div className="relative aspect-4/3 overflow-hidden rounded-[2px] bg-surface">
                <SafeImage
                    src={photo.image}
                    alt={photo.alt}
                    fill
                    priority={priority}
                    sizes="(min-width: 640px) 40vw, 60vw"
                    className="object-cover"
                    fallback={<ImageOff className="size-7 text-muted-foreground" aria-hidden />}
                />
                {children}
            </div>
            <figcaption className="absolute inset-x-2 bottom-1.5 truncate text-center text-xs text-muted-foreground sm:bottom-2.5 sm:text-sm">
                {photo.caption}
            </figcaption>
        </figure>
    );
}
