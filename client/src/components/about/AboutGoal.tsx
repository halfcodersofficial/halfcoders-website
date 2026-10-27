"use client";

import { Bot, CheckCircle2, Hammer, Layers, Sparkles, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import Section from "@/components/site/Section";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { GOAL, type GoalIcon } from "./content";
import { DocHeading, TiltCard } from "./paper";

const ICONS: Record<GoalIcon, LucideIcon> = { foundation: Layers, practice: Hammer, ai: Bot };

const TONES: Record<GoalIcon, { tile: string; text: string }> = {
    foundation: { tile: "bg-syn-func/10 text-syn-func group-hover:bg-syn-func group-hover:text-white", text: "text-syn-func" },
    practice: { tile: "bg-syn-number/10 text-syn-number group-hover:bg-syn-number group-hover:text-white", text: "text-syn-number" },
    ai: { tile: "bg-syn-keyword/10 text-syn-keyword group-hover:bg-syn-keyword group-hover:text-white", text: "text-syn-keyword" },
};

const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root.querySelectorAll("[data-goal]"), { autoAlpha: 0, y: 40, duration: 0.65, stagger: 0.12, ...SETTLE })
        .from(root.querySelectorAll("[data-goal-art]"), { autoAlpha: 0, scale: 0.9, duration: 0.5, stagger: 0.12, ...SETTLE }, 0.25);
};

/**
 * What we want every learner to leave with: a firm foundation, work of their
 * own, and a working sense of AI. Three cards, each opening on a small
 * picture of its idea that comes alive when pointed at — layers lifting
 * apart, lines of code writing themselves out, a prompt getting its answer —
 * and the card itself leaning toward the pointer like a sheet picked up.
 */
export default function AboutGoal() {
    const rootRef = useRef<HTMLUListElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    return (
        <Section tone="surface" labelledBy="about-goal-title">
            <DocHeading id="about-goal-title" title={GOAL.title} lead={GOAL.description} align="center" />
            <ul ref={rootRef} className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {GOAL.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const tone = TONES[item.icon];
                    return (
                        <li key={item.title} data-goal className="flex">
                            <TiltCard className="flex w-full flex-col overflow-hidden rounded-panel border border-border bg-card shadow-card hover:shadow-[0_26px_50px_-28px_rgb(21_17_42/0.45)]">
                                <div data-goal-art aria-hidden className="relative h-36 overflow-hidden border-b border-border bg-surface/70">
                                    <div className="bg-dots absolute inset-0" />
                                    <Art kind={item.icon} />
                                </div>
                                <div className="flex flex-1 flex-col p-6">
                                    <span
                                        className={cn(
                                            "grid size-11 place-items-center rounded-md transition-[color,background-color,rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110",
                                            tone.tile,
                                        )}
                                    >
                                        <Icon className="size-5" aria-hidden />
                                    </span>
                                    <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                                    <p className="mt-2 leading-relaxed text-muted-foreground">{item.text}</p>
                                    <ul className="mt-5 space-y-2 border-t border-dashed border-border pt-4">
                                        {item.points.map((point, index) => (
                                            <li
                                                key={point}
                                                className="flex items-center gap-2.5 text-sm transition-[translate] duration-300 group-hover:translate-x-1"
                                                style={{ transitionDelay: `${index * 50}ms` }}
                                            >
                                                <CheckCircle2 className={cn("size-4 shrink-0", tone.text)} aria-hidden />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </TiltCard>
                        </li>
                    );
                })}
            </ul>
        </Section>
    );
}

/** Each goal's little picture, drawn in CSS; it comes alive on the card's hover. */
function Art({ kind }: { kind: GoalIcon }) {
    if (kind === "foundation") {
        // Three layers stacked like a foundation, lifting apart.
        return (
            <div className="absolute inset-0 grid place-items-center">
                <div className="relative h-20 w-40">
                    {[
                        { bar: "bg-syn-func/25 border-syn-func/40", lift: "" },
                        { bar: "bg-syn-func/40 border-syn-func/60", lift: "group-hover:-translate-y-3" },
                        { bar: "bg-syn-func/70 border-syn-func", lift: "group-hover:-translate-y-6" },
                    ].map((layer, index) => (
                        <span
                            key={index}
                            className={cn(
                                "absolute inset-x-0 h-7 skew-x-[-24deg] rounded-md border transition-[translate] duration-500 ease-out",
                                layer.bar,
                                layer.lift,
                            )}
                            style={{ bottom: `${index * 18}px` }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (kind === "practice") {
        // A few lines of code, writing themselves out further.
        return (
            <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-md border border-border bg-card p-3 shadow-card">
                {[
                    ["w-10 bg-syn-keyword/60", "w-16 bg-syn-func/60"],
                    ["w-6 bg-transparent", "w-20 bg-syn-string/60", "w-8 bg-syn-number/60"],
                    ["w-6 bg-transparent", "w-12 bg-syn-tag/50", "w-14 bg-syn-func/50"],
                    ["w-8 bg-syn-keyword/60"],
                ].map((line, row) => (
                    <div key={row} className="mt-1.5 flex gap-1.5 first:mt-0">
                        {line.map((bar, index) => (
                            <span
                                key={index}
                                className={cn("h-2 origin-left rounded-full transition-[scale] duration-500 ease-out group-hover:scale-x-125", bar)}
                                style={{ transitionDelay: `${row * 80}ms` }}
                            />
                        ))}
                    </div>
                ))}
                <span className="mt-2 block h-3 w-1.5 animate-blink bg-syn-number motion-reduce:animate-none" />
            </div>
        );
    }

    // A prompt, and an answer arriving with a spark.
    return (
        <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col gap-2">
            <span className="ml-auto rounded-lg rounded-br-sm bg-syn-keyword px-3 py-1.5 text-[0.7rem] font-medium text-white">
                <span className="block h-1.5 w-20 rounded-full bg-white/70" />
            </span>
            <span className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-syn-keyword/15 text-syn-keyword transition-[rotate,scale] duration-500 group-hover:rotate-180 group-hover:scale-110">
                    <Sparkles className="size-3.5" />
                </span>
                <span className="flex-1 space-y-1.5 rounded-lg rounded-tl-sm border border-border bg-card px-3 py-2 shadow-card">
                    <span className="block h-1.5 w-full origin-left scale-x-75 rounded-full bg-syn-keyword/30 transition-[scale] duration-500 group-hover:scale-x-100" />
                    <span className="block h-1.5 w-3/4 origin-left scale-x-50 rounded-full bg-syn-keyword/30 transition-[scale] delay-100 duration-500 group-hover:scale-x-100" />
                </span>
            </span>
        </div>
    );
}
