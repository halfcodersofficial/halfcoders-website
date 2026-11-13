"use client";

import { ArrowRight, Check, Target, Telescope, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import Section from "@/components/site/Section";
import SpotlightCard from "@/components/site/SpotlightCard";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { AIMS, type AimIcon } from "./content";
import { DocHeading } from "./paper";

const ICONS: Record<AimIcon, LucideIcon> = { mission: Target, vision: Telescope };

/* The mission in violet, the vision in green: the glow, the top edge, the wash, the icon tile (filling on hover), the rule and the ticks. */
const TONES: Record<AimIcon, { color: string; text: string; tile: string; bar: string; wash: string; tick: string }> = {
    mission: {
        color: "var(--syn-keyword)",
        text: "text-syn-keyword",
        tile: "bg-syn-keyword/10 text-syn-keyword group-hover:bg-syn-keyword group-hover:text-background",
        bar: "bg-syn-keyword",
        wash: "from-syn-keyword/[0.06]",
        tick: "bg-syn-keyword/10 text-syn-keyword",
    },
    vision: {
        color: "var(--syn-string)",
        text: "text-syn-string",
        tile: "bg-syn-string/10 text-syn-string group-hover:bg-syn-string group-hover:text-background",
        bar: "bg-syn-string",
        wash: "from-syn-string/[0.06]",
        tick: "bg-syn-string/10 text-syn-string",
    },
};

/**
 * The halves slide in from either side, the icons pop, the rule beside each
 * statement draws down, the arrow between them spins in, and the points
 * follow one by one.
 */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root.querySelectorAll("[data-aim]"), { autoAlpha: 0, x: (index: number) => (index ? 32 : -32), duration: 0.7, stagger: 0.15, ...SETTLE })
        .from(root.querySelectorAll("[data-aim-icon]"), { scale: 0, rotate: -45, duration: 0.5, stagger: 0.15, ease: "back.out(2.2)", ...SETTLE }, 0.25)
        .from(root.querySelectorAll("[data-aim-rule]"), { scaleY: 0, transformOrigin: "center top", duration: 0.7, stagger: 0.15, ...SETTLE }, 0.4)
        .from(root.querySelectorAll("[data-aim-bridge]"), { scale: 0, rotate: -180, duration: 0.6, ease: "back.out(1.8)", ...SETTLE }, 0.5)
        .from(root.querySelectorAll("[data-aim-point]"), { autoAlpha: 0, x: -10, duration: 0.35, stagger: 0.07, ...SETTLE }, 0.65);
};

/**
 * The mission and the vision, as one sheet split down the middle (stacked on
 * a phone): what we do every day on the left in violet, where it should lead
 * on the right in green, an arrow on the fold carrying one into the other.
 * Each half has its icon, a plain-words hint under its name, the statement
 * set large against a coloured rule, and three points along the foot.
 * Pointed at, a half's glow follows the pointer and its icon tile fills.
 */
export default function AboutAims() {
    const rootRef = useRef<HTMLDivElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    return (
        <Section labelledBy="about-aims-title">
            <DocHeading id="about-aims-title" title={AIMS.title} lead={AIMS.description} align="center" />
            <div ref={rootRef} className="grid grid-cols-1 overflow-hidden rounded-panel border border-border bg-card shadow-card lg:grid-cols-2">
                {AIMS.items.map((item, index) => {
                    const Icon = ICONS[item.icon];
                    const tone = TONES[item.icon];
                    const titleId = `about-aim-${item.icon}`;
                    return (
                        <SpotlightCard
                            as="article"
                            key={item.icon}
                            data-aim
                            color={tone.color}
                            aria-labelledby={titleId}
                            className={cn(
                                "group flex flex-col bg-linear-to-b to-transparent to-60% p-6 sm:p-10",
                                tone.wash,
                                index > 0 && "border-t border-border lg:border-l lg:border-t-0",
                            )}
                        >
                            <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", tone.bar)} />
                            {/* A big faint copy of the icon in the corner, turning as the half is pointed at. */}
                            <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                                <Icon
                                    className={cn(
                                        "absolute -bottom-10 -right-10 size-48 opacity-[0.05] transition-[rotate,scale,opacity] duration-500 ease-out group-hover:-rotate-12 group-hover:scale-110 group-hover:opacity-[0.09]",
                                        tone.text,
                                    )}
                                    strokeWidth={1.25}
                                />
                            </span>

                            {/* On the fold: from the mission to the vision. Pointing down on a phone, across from `lg`. */}
                            {index > 0 && (
                                <span
                                    aria-hidden
                                    className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 lg:left-0 lg:top-1/2"
                                >
                                    <span
                                        data-aim-bridge
                                        className="grid size-11 place-items-center rounded-full bg-linear-to-br from-syn-keyword to-syn-string text-background shadow-card ring-4 ring-card"
                                    >
                                        <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
                                    </span>
                                </span>
                            )}

                            <div className="flex items-center gap-4">
                                <span
                                    aria-hidden
                                    data-aim-icon
                                    className={cn(
                                        "grid size-14 shrink-0 place-items-center rounded-lg transition-[color,background-color,rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110",
                                        tone.tile,
                                    )}
                                >
                                    <Icon className="size-7" />
                                </span>
                                <div>
                                    <h3 id={titleId} className="text-h3">
                                        {item.label}
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
                                </div>
                            </div>

                            <div className="relative mt-7 pl-5">
                                <span aria-hidden data-aim-rule className={cn("absolute inset-y-0 left-0 w-1 rounded-full", tone.bar)} />
                                <p className="font-heading text-xl font-medium leading-relaxed text-pretty sm:text-[1.4rem]">{item.statement}</p>
                            </div>

                            {/* Pushed to the foot, so the two lists line up side by side. */}
                            <div className="mt-auto pt-8">
                                <ul className="space-y-3 border-t border-dashed border-border pt-6">
                                    {item.points.map((point) => (
                                        <li key={point} data-aim-point className="flex items-start gap-3 text-[0.95rem] leading-relaxed">
                                            <span aria-hidden className={cn("mt-1 grid size-5 shrink-0 place-items-center rounded-full", tone.tick)}>
                                                <Check className="size-3" strokeWidth={3} />
                                            </span>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </SpotlightCard>
                    );
                })}
            </div>
        </Section>
    );
}
