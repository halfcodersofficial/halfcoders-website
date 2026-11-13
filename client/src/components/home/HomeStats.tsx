"use client";

import { MonitorPlay, TrendingUp, Trophy, Users, type LucideIcon } from "lucide-react";
import { Fragment, useRef } from "react";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import SpotlightCard from "@/components/site/SpotlightCard";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { STATS, type StatFigure, type StatIcon, type StatItem } from "./content";

const ICONS: Record<StatIcon, LucideIcon> = {
    students: Users,
    courses: MonitorPlay,
    success: Trophy,
};

/* Each stat in its own syntax colour: the glow, the bar, the icon tile (filling on hover), the suffix and the meter. */
const TONES: Record<StatIcon, { color: string; text: string; tile: string; bar: string; soft: string; card: string }> = {
    students: {
        color: "var(--syn-func)",
        text: "text-syn-func",
        tile: "border-syn-func/30 bg-syn-func/10 text-syn-func group-hover:border-syn-func group-hover:bg-syn-func group-hover:text-editor",
        bar: "bg-syn-func",
        soft: "bg-syn-func/20",
        card: "hover:border-syn-func/40",
    },
    courses: {
        color: "var(--syn-keyword)",
        text: "text-syn-keyword",
        tile: "border-syn-keyword/30 bg-syn-keyword/10 text-syn-keyword group-hover:border-syn-keyword group-hover:bg-syn-keyword group-hover:text-editor",
        bar: "bg-syn-keyword",
        soft: "bg-syn-keyword/20",
        card: "hover:border-syn-keyword/40",
    },
    success: {
        color: "var(--syn-string)",
        text: "text-syn-string",
        tile: "border-syn-string/30 bg-syn-string/10 text-syn-string group-hover:border-syn-string group-hover:bg-syn-string group-hover:text-editor",
        bar: "bg-syn-string",
        soft: "bg-syn-string/20",
        card: "hover:border-syn-string/40",
    },
};

/* How long a figure takes to count up; the success bar fills in step with it. */
const COUNT = { duration: 1.8, ease: "power3.out" } as const;

/** `.from` only where the card has the part — GSAP warns about empty targets. */
const fromSome = (timeline: gsap.core.Timeline, targets: NodeListOf<Element>, vars: gsap.TweenVars, at: number) => {
    if (targets.length > 0) timeline.from(targets, vars, at);
};

/**
 * The cards rise in one after another, their colour bars drawing across and
 * the icons popping. As each card lands its figures count up from zero, the
 * success bar fills alongside, and the course blocks light up one by one.
 */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-stat]"));
    timeline
        .from(cards, { autoAlpha: 0, y: 36, scale: 0.97, duration: 0.6, stagger: 0.12, ...SETTLE })
        .from(root.querySelectorAll("[data-stat-bar]"), { scaleX: 0, transformOrigin: "left center", duration: 0.6, stagger: 0.12, ...SETTLE }, 0.2)
        .from(root.querySelectorAll("[data-stat-icon]"), { scale: 0, rotate: -40, duration: 0.5, stagger: 0.12, ease: "back.out(2.2)", ...SETTLE }, 0.25);

    cards.forEach((card, index) => {
        const at = 0.3 + index * 0.12;

        card.querySelectorAll<HTMLElement>("[data-count]").forEach((node) => {
            const counter = { value: 0 };
            node.textContent = "0";
            timeline.to(
                counter,
                {
                    value: Number(node.dataset.count),
                    ...COUNT,
                    onUpdate: () => {
                        node.textContent = String(Math.round(counter.value));
                    },
                },
                at,
            );
        });

        fromSome(timeline, card.querySelectorAll("[data-stat-fill]"), { scaleX: 0, transformOrigin: "left center", ...COUNT, ...SETTLE }, at);
        fromSome(timeline, card.querySelectorAll("[data-stat-slot]"), { scaleX: 0, autoAlpha: 0, transformOrigin: "left center", duration: 0.35, stagger: 0.09, ...SETTLE }, at + 0.25);
        fromSome(timeline, card.querySelectorAll("[data-stat-foot]"), { autoAlpha: 0, y: 8, duration: 0.45, ...SETTLE }, at + 0.5);
    });
};

/** How a stat's figures read aloud: "2 লাইভ + 5 আসছে". */
const spoken = (figures: StatFigure[]) => figures.map((figure) => `${figure.value}${figure.suffix ?? ""}${figure.unit ? ` ${figure.unit}` : ""}`).join(" + ");

/**
 * Half Coders by the numbers, on the dark editor surface: three cards, each
 * in its own syntax colour with its icon, a big figure, what it counts and a
 * small meter along the foot. As the band scrolls into view the cards rise
 * in and the figures count up from zero (only once, and not at all with
 * reduced motion asked for — the real figures are what's rendered). Pointed
 * at, a card lifts, a glow in its colour follows the pointer and the icon
 * tile fills.
 */
export default function HomeStats() {
    const rootRef = useRef<HTMLUListElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    const odd = STATS.items.length % 2 === 1;

    return (
        <Section tone="dark" labelledBy="home-stats-title">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 size-160 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-3xl"
            />
            <SectionHeader
                id="home-stats-title"
                eyebrow={STATS.eyebrow}
                title={STATS.title}
                description={STATS.description}
                align="center"
                className="relative"
            />
            <ul ref={rootRef} className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {STATS.items.map((stat, index) => {
                    const Icon = ICONS[stat.icon];
                    const tone = TONES[stat.icon];
                    return (
                        <SpotlightCard
                            as="li"
                            key={stat.label}
                            data-stat
                            color={tone.color}
                            className={cn(
                                "group flex flex-col overflow-hidden rounded-card border border-editor-line bg-editor-panel p-6 transition-[translate,border-color] duration-300 ease-out hover:-translate-y-1.5 motion-reduce:hover:translate-y-0 sm:p-7",
                                tone.card,
                                // The last of an odd count takes the full row on tablets rather than leave a hole.
                                odd && index === STATS.items.length - 1 && "sm:col-span-2 lg:col-span-1",
                            )}
                        >
                            <span aria-hidden data-stat-bar className={cn("absolute inset-x-0 top-0 h-0.5 transition-[height] duration-300 group-hover:h-1", tone.bar)} />

                            <span
                                aria-hidden
                                data-stat-icon
                                className={cn(
                                    "order-1 grid size-12 place-items-center rounded-md border transition-[color,background-color,border-color,rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110",
                                    tone.tile,
                                )}
                            >
                                <Icon className="size-6" />
                            </span>

                            {/* The label comes first for screen readers ("কোর্স: 2 লাইভ + 5 আসছে"), the figure first to the eye. */}
                            <h3 className="order-3 mt-3 text-lg font-semibold text-editor-fg">{stat.label}</h3>

                            <p className="order-2 mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2 font-heading font-bold leading-none tracking-tight">
                                <span className="sr-only">{spoken(stat.figures)}</span>
                                {stat.figures.map((figure, figureIndex) => (
                                    <Fragment key={figureIndex}>
                                        {figureIndex > 0 && (
                                            <span aria-hidden className="text-3xl text-editor-gutter lg:text-4xl">
                                                +
                                            </span>
                                        )}
                                        <span aria-hidden className="inline-flex items-baseline gap-1.5">
                                            {/* Held at its final width, so the suffix doesn't shuffle along as the digits count up. */}
                                            <span
                                                data-count={figure.value}
                                                className="inline-block text-right text-5xl tabular-nums text-editor-fg lg:text-6xl"
                                                style={{ minWidth: `${String(figure.value).length}ch` }}
                                            >
                                                {figure.value}
                                            </span>
                                            {figure.suffix && <span className={cn("text-4xl lg:text-5xl", tone.text)}>{figure.suffix}</span>}
                                            {figure.unit && <span className={cn("text-lg font-semibold tracking-normal lg:text-xl", tone.text)}>{figure.unit}</span>}
                                        </span>
                                    </Fragment>
                                ))}
                            </p>

                            <p className="order-4 mt-2 flex-1 text-[0.95rem] leading-relaxed text-editor-muted">{stat.text}</p>

                            <div data-stat-foot className="order-5 mt-6 flex min-h-11 flex-col justify-end border-t border-editor-line pt-5">
                                <StatMeter stat={stat} tone={tone} />
                            </div>
                        </SpotlightCard>
                    );
                })}
            </ul>
        </Section>
    );
}

/**
 * The small picture along a card's foot: a block per course (live ones lit,
 * with a pulse in the key), a bar filled to the success figure, or for the
 * students a plain line that they keep coming.
 */
function StatMeter({ stat, tone }: { stat: StatItem; tone: (typeof TONES)[StatIcon] }) {
    if (stat.icon === "courses") {
        const [live, upcoming] = stat.figures;
        return (
            // The figure above already says it; this is the picture of it.
            <div aria-hidden>
                <div className="flex gap-1.5">
                    {Array.from({ length: live.value }, (_, index) => (
                        <span key={`live-${index}`} data-stat-slot className={cn("h-2 flex-1 rounded-full", tone.bar)} />
                    ))}
                    {Array.from({ length: upcoming?.value ?? 0 }, (_, index) => (
                        <span key={`upcoming-${index}`} data-stat-slot className={cn("h-2 flex-1 rounded-full", tone.soft)} />
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-editor-muted">
                    <span className="inline-flex items-center gap-2">
                        <span className="relative flex size-2">
                            <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:animate-none", tone.bar)} />
                            <span className={cn("relative inline-flex size-2 rounded-full", tone.bar)} />
                        </span>
                        {live.unit}
                    </span>
                    {upcoming && (
                        <span className="inline-flex items-center gap-2">
                            <span className={cn("size-2 rounded-full", tone.soft)} />
                            {upcoming.unit}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    if (stat.icon === "success") {
        const percent = Math.min(100, Math.max(0, stat.figures[0].value));
        return (
            <div>
                <div aria-hidden className="h-2 overflow-hidden rounded-full bg-editor-raised">
                    <span data-stat-fill className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${percent}%` }} />
                </div>
                {stat.note && <p className="mt-3 text-sm text-editor-muted">{stat.note}</p>}
            </div>
        );
    }

    return (
        stat.note && (
            <p className="flex items-center gap-2 text-sm text-editor-muted">
                <TrendingUp aria-hidden className={cn("size-4 shrink-0", tone.text)} />
                {stat.note}
            </p>
        )
    );
}
