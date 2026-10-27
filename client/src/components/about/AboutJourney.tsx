"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BookOpen, Check, CheckCircle2, ChevronRight, Hammer, Rocket, Sparkles, Target, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Reveal from "@/components/site/Reveal";
import Section from "@/components/site/Section";
import { scrollPageTo } from "@/lib/smoothScroll";
import { cn } from "@/lib/utils";
import { JOURNEY } from "./content";
import { Callout, DocHeading } from "./paper";

/* The mission, then the vision, each called out. */
const AIM_LOOK = [
    { icon: Target, tone: "keyword" },
    { icon: Sparkles, tone: "string" },
] as const;

const { why, who, beyond, path, inside } = JOURNEY;
const BLOCKS = [why, who, beyond, path, inside];

const STEP_ICONS: LucideIcon[] = [BookOpen, Hammer, Rocket];
/** How long the path rests on each step before moving on. */
const STEP_MS = 2600;
/** Room left above a part when the contents jump to it, for the sticky navbar. */
const JUMP_OFFSET = 104;

/**
 * The story, as one long read with its contents beside it (on wide
 * screens): why Half Coders started, who it's for, why code is only the
 * start, the path (learn, build, get ready) and everything you get. The
 * contents follow along — the part being read is lit, and a violet rail
 * fills as you go — and jump to a part when picked. Each part fades up as it
 * arrives; the path plays through its three steps on its own.
 */
export default function AboutJourney() {
    const rootRef = useRef<HTMLDivElement>(null);
    const railRef = useRef<HTMLSpanElement>(null);
    const [active, setActive] = useState<string>(why.id);

    // The part being read: whichever is crossing the upper middle of the screen.
    useEffect(() => {
        const parts = BLOCKS.map((block) => document.getElementById(block.id)).filter((node): node is HTMLElement => node !== null);
        const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.id)), {
            rootMargin: "-35% 0px -60% 0px",
        });
        parts.forEach((part) => observer.observe(part));
        return () => observer.disconnect();
    }, []);

    // How far through the read, as the rail beside the contents.
    useEffect(() => {
        const root = rootRef.current;
        const rail = railRef.current;
        if (!root || !rail) return;
        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.context(() => {
            gsap.fromTo(
                rail,
                { scaleY: 0 },
                { scaleY: 1, ease: "none", scrollTrigger: { trigger: root, start: "top 35%", end: "bottom 65%", scrub: true } },
            );
        });
        return () => context.revert();
    }, []);

    const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        scrollPageTo(target.getBoundingClientRect().top + window.scrollY - JUMP_OFFSET);
    };

    return (
        <Section labelledBy={`${why.id}-title`}>
            <div ref={rootRef} className="grid grid-cols-1 gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
                <nav aria-label={JOURNEY.contents} className="hidden lg:block">
                    <div className="sticky top-28">
                        <p className="font-mono text-xs text-syn-comment">
                            <span aria-hidden>{"// "}</span>
                            {JOURNEY.contents}
                        </p>
                        <div className="relative mt-4 pl-4">
                            <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-border" />
                            <span ref={railRef} aria-hidden className="absolute inset-y-0 left-0 w-0.5 origin-top rounded-full bg-primary" />
                            <ul className="space-y-1">
                                {BLOCKS.map((block) => {
                                    const current = active === block.id;
                                    return (
                                        <li key={block.id}>
                                            <a
                                                href={`#${block.id}`}
                                                onClick={(event) => jump(event, block.id)}
                                                aria-current={current ? "location" : undefined}
                                                className={cn(
                                                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-[color,background-color,translate] duration-200",
                                                    current
                                                        ? "translate-x-1 bg-primary/10 font-semibold text-primary"
                                                        : "text-muted-foreground hover:bg-surface hover:text-foreground",
                                                )}
                                            >
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        "size-1.5 shrink-0 rounded-full transition-colors",
                                                        current ? "bg-primary" : "bg-border-strong",
                                                    )}
                                                />
                                                {block.nav}
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </nav>

                <div className="min-w-0 space-y-20 sm:space-y-24">
                    <Part id={why.id} title={why.title}>
                        <div className="space-y-5 text-lg leading-relaxed text-foreground/85">
                            {why.paragraphs.map((paragraph) => (
                                <p key={paragraph.slice(0, 24)} data-reveal>
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                        {/* The line it all started from, set large between quote marks. */}
                        <figure data-reveal className="my-12 border-y border-dashed border-border py-10 text-center">
                            <blockquote className="font-heading text-h2 text-balance">
                                <span aria-hidden className="mr-1 font-mono text-primary/40">
                                    “
                                </span>
                                {why.quote}
                                <span aria-hidden className="ml-1 font-mono text-primary/40">
                                    ”
                                </span>
                            </blockquote>
                        </figure>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {why.aims.map((aim, index) => (
                                <div key={aim.key} data-reveal>
                                    <Callout
                                        label={aim.key}
                                        icon={AIM_LOOK[index % AIM_LOOK.length].icon}
                                        tone={AIM_LOOK[index % AIM_LOOK.length].tone}
                                    >
                                        {aim.value}
                                    </Callout>
                                </div>
                            ))}
                        </div>
                    </Part>

                    <Part id={who.id} title={who.title}>
                        <p data-reveal className="max-w-2xl text-lg leading-relaxed text-foreground/85">
                            {who.text}
                        </p>
                        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {who.items.map((item, index) => (
                                <li
                                    key={item.title}
                                    data-reveal
                                    className={cn(
                                        "group flex gap-4 rounded-card border border-border bg-card p-5 shadow-card transition-[translate,rotate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_-22px_rgb(21_17_42/0.45)] motion-reduce:hover:translate-y-0 motion-reduce:hover:rotate-0",
                                        index % 2 ? "hover:rotate-[0.6deg]" : "hover:rotate-[-0.6deg]",
                                    )}
                                >
                                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/10 text-success transition-[color,background-color,scale] duration-300 group-hover:scale-110 group-hover:bg-success group-hover:text-white">
                                        <Check className="size-4.5" strokeWidth={2.5} aria-hidden />
                                    </span>
                                    <div>
                                        <h3 className="font-semibold">{item.title}</h3>
                                        <p className="mt-1 leading-relaxed text-muted-foreground">{item.text}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Part>

                    <Part id={beyond.id} title={beyond.title}>
                        <div className="space-y-5 text-lg leading-relaxed text-foreground/85">
                            {beyond.paragraphs.map((paragraph) => (
                                <p key={paragraph.slice(0, 24)} data-reveal>
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                        <ul className="mt-7 flex flex-wrap gap-2.5">
                            {beyond.skills.map((skill, index) => (
                                <li
                                    key={skill}
                                    data-reveal
                                    className={cn(
                                        "cursor-default rounded-full border px-4 py-2 text-sm font-medium transition-[translate,background-color,color,border-color] duration-200 hover:-translate-y-0.5",
                                        [
                                            "border-syn-func/30 bg-syn-func/5 text-syn-func hover:bg-syn-func hover:text-white",
                                            "border-syn-keyword/30 bg-syn-keyword/5 text-syn-keyword hover:bg-syn-keyword hover:text-white",
                                            "border-syn-string/30 bg-syn-string/5 text-syn-string hover:bg-syn-string hover:text-white",
                                            "border-syn-number/30 bg-syn-number/5 text-syn-number hover:bg-syn-number hover:text-white",
                                            "border-syn-tag/30 bg-syn-tag/5 text-syn-tag hover:bg-syn-tag hover:text-white",
                                        ][index % 5],
                                    )}
                                >
                                    {skill}
                                </li>
                            ))}
                        </ul>
                    </Part>

                    <Part id={path.id} title={path.title}>
                        <div data-reveal>
                            <PathSteps />
                        </div>
                    </Part>

                    <Part id={inside.id} title={inside.title}>
                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {inside.items.map((item) => (
                                <li
                                    key={item}
                                    data-reveal
                                    className="group flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3.5 transition-[border-color,background-color] duration-200 hover:border-primary/40 hover:bg-primary/5"
                                >
                                    <CheckCircle2
                                        className="size-5 shrink-0 text-primary transition-[scale] duration-200 group-hover:scale-125"
                                        aria-hidden
                                    />
                                    <span className="text-[0.95rem]">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </Part>
                </div>
            </div>
        </Section>
    );
}

/** One part of the read: its README heading, then its content fading up. */
function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
            <Reveal>
                <DocHeading id={`${id}-title`} title={title} className="mb-7 sm:mb-8" />
                {children}
            </Reveal>
        </section>
    );
}

/**
 * Learn, build, get ready: three steps that play through on their own, a
 * bar under the current one counting down to the next (its end is what moves
 * it on), and the step's line below. Any step can be picked; it rests while
 * pointed at, and with reduced motion asked for it stays where it's put.
 */
function PathSteps() {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const [still, setStill] = useState(true);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setStill(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    const next = () => setActive((index) => (index + 1) % path.steps.length);

    return (
        <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="overflow-hidden rounded-panel border border-border bg-card shadow-card"
        >
            <div className="relative grid grid-cols-3">
                {path.steps.map((step, index) => {
                    const Icon = STEP_ICONS[index] ?? Check;
                    const current = index === active;
                    const passed = index < active;
                    return (
                        <button
                            key={step.title}
                            type="button"
                            onClick={() => setActive(index)}
                            aria-pressed={current}
                            className={cn(
                                "relative flex cursor-pointer flex-col items-center gap-2.5 border-b px-2 py-6 transition-colors duration-300",
                                current ? "border-primary/20 bg-primary/5" : "border-border hover:bg-surface",
                            )}
                        >
                            {index > 0 && (
                                <ChevronRight
                                    aria-hidden
                                    className={cn(
                                        "absolute -left-2.5 top-10 size-5 transition-colors duration-300",
                                        passed || current ? "text-primary" : "text-border-strong",
                                    )}
                                />
                            )}
                            <span
                                className={cn(
                                    "grid size-12 place-items-center rounded-full border-2 transition-[background-color,border-color,color,box-shadow,scale] duration-300 sm:size-14",
                                    current
                                        ? "scale-110 border-primary bg-primary text-primary-foreground shadow-[0_0_0_6px_color-mix(in_oklch,var(--primary)_15%,transparent)]"
                                        : passed
                                          ? "border-primary/50 bg-primary/10 text-primary"
                                          : "border-border bg-surface text-muted-foreground",
                                )}
                            >
                                <Icon className="size-5 sm:size-6" aria-hidden />
                            </span>
                            <span className={cn("text-base font-semibold sm:text-lg", current ? "text-primary" : "text-foreground")}>
                                {step.title}
                            </span>
                            {current && !still && (
                                <span
                                    key={`bar-${active}`}
                                    aria-hidden
                                    onAnimationEnd={next}
                                    className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-primary"
                                    style={{ animation: `fill-x ${STEP_MS}ms linear both`, animationPlayState: paused ? "paused" : "running" }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
            <p aria-live="polite" className="min-h-28 px-6 py-6 text-lg leading-relaxed text-foreground/85 sm:min-h-0">
                <span key={active} className="block animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
                    {path.steps[active].text}
                </span>
            </p>
        </div>
    );
}
