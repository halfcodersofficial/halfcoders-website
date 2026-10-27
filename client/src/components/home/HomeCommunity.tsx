"use client";

import { MousePointerClick } from "lucide-react";
import { useRef, useState } from "react";
import { Cmt, Fn, Kw } from "@/components/site/code";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import SpotlightCard from "@/components/site/SpotlightCard";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { COMMUNITY } from "./content";

/* Each part of the sum in its own syntax colour: on the line, on its card, and lit up when picked. */
const TONE: Record<string, { color: string; text: string; tile: string; lit: string; card: string }> = {
    you: {
        color: "var(--syn-func)",
        text: "text-syn-func",
        tile: "border-syn-func/30 bg-syn-func/5 text-syn-func",
        lit: "bg-syn-func/15 ring-syn-func/50",
        card: "border-syn-func/50",
    },
    mentor: {
        color: "var(--syn-keyword)",
        text: "text-syn-keyword",
        tile: "border-syn-keyword/30 bg-syn-keyword/5 text-syn-keyword",
        lit: "bg-syn-keyword/15 ring-syn-keyword/50",
        card: "border-syn-keyword/50",
    },
    batch: {
        color: "var(--syn-string)",
        text: "text-syn-string",
        tile: "border-syn-string/30 bg-syn-string/5 text-syn-string",
        lit: "bg-syn-string/15 ring-syn-string/50",
        card: "border-syn-string/50",
    },
};

/**
 * The line types itself out, and as each part of the sum appears, its card
 * slides in beside it.
 */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    const parts = root.querySelectorAll("[data-eq-part]");
    const cards = root.querySelectorAll("[data-eq-card]");
    timeline
        .from(root.querySelectorAll("[data-eq-comment]"), { autoAlpha: 0, duration: 0.4, ...SETTLE })
        .from(root.querySelectorAll("[data-eq-head]"), { clipPath: "inset(0 100% 0 0)", duration: 0.6, ease: "steps(16)", clearProps: "clipPath" });
    parts.forEach((part, index) => {
        timeline
            .from(part, { autoAlpha: 0, y: -6, duration: 0.3, ...SETTLE }, ">-0.05")
            .from(cards[index], { autoAlpha: 0, x: 40, duration: 0.55, ...SETTLE }, "<");
    });
    timeline.from(root.querySelectorAll("[data-eq-hint]"), { autoAlpha: 0, duration: 0.4, ...SETTLE });
};

/**
 * What the name means. Nobody is a whole coder on their own: a line of code
 * adds you, a mentor and the batch into one, and a card for each says what
 * that part does. Pick a part — on the line or its card, by pointing or
 * tapping — and the two light up together while the others step back.
 */
export default function HomeCommunity() {
    const { equation } = COMMUNITY;
    const rootRef = useRef<HTMLDivElement>(null);
    const [focus, setFocus] = useState<string | null>(null);
    useScrollEntrance(rootRef, buildEntrance);

    const pick = (name: string) => ({
        onMouseEnter: () => setFocus(name),
        onMouseLeave: () => setFocus(null),
        onClick: () => setFocus((current) => (current === name ? null : name)),
    });

    return (
        <Section labelledBy="home-community-title">
            <div ref={rootRef} className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-16">
                <div>
                    <SectionHeader
                        id="home-community-title"
                        eyebrow={COMMUNITY.eyebrow}
                        title={COMMUNITY.title}
                        description={COMMUNITY.description}
                        className="mb-8 sm:mb-8"
                    />
                    <div aria-hidden className="overflow-hidden rounded-panel border border-border bg-card">
                        <div lang="en" className="px-5 py-5 font-mono text-[0.95rem] sm:text-xl">
                            <p data-eq-comment className="flex gap-4 text-[0.8em]">
                                <span className="w-3 shrink-0 text-right text-xs leading-[inherit] text-muted-foreground/60">1</span>
                                <Cmt>
                                    {"// "}
                                    <span lang="bn">{COMMUNITY.comment}</span>
                                </Cmt>
                            </p>
                            <p className="mt-2 flex items-baseline gap-4">
                                <span className="w-3 shrink-0 text-right text-xs text-muted-foreground/60">2</span>
                                {/* On a phone the sum wraps between its parts rather than running off the card. */}
                                <span className="leading-relaxed sm:whitespace-nowrap">
                                    {/* Non-breaking spaces at the parts' edges: an inline-block drops a plain trailing space. */}
                                    <span data-eq-head className="inline-block">
                                        <Kw>const</Kw> <Fn>{equation.left}</Fn> =&nbsp;
                                    </span>
                                    {equation.parts.map((part, index) => (
                                        <span key={part} data-eq-part className="inline-block">
                                            <span
                                                {...pick(part)}
                                                className={cn(
                                                    "cursor-pointer rounded-sm px-1 ring-0 transition-[background-color,box-shadow,opacity] duration-200",
                                                    TONE[part].text,
                                                    focus === part && cn("ring-2", TONE[part].lit),
                                                    focus && focus !== part && "opacity-40",
                                                )}
                                            >
                                                {part}
                                            </span>
                                            {index < equation.parts.length - 1 ? " + " : <span className="caret text-foreground/70">;</span>}
                                        </span>
                                    ))}
                                </span>
                            </p>
                        </div>
                        <p data-eq-hint className="flex items-center gap-2 border-t border-border bg-surface px-5 py-2.5 text-xs text-muted-foreground">
                            <MousePointerClick className="size-3.5" />
                            {COMMUNITY.hint}
                        </p>
                    </div>
                </div>

                <ul className="grid gap-4">
                    {COMMUNITY.cards.map((card) => {
                        const tone = TONE[card.name];
                        const lit = focus === card.name;
                        return (
                            <SpotlightCard
                                as="li"
                                key={card.name}
                                data-eq-card
                                color={tone.color}
                                {...pick(card.name)}
                                className={cn(
                                    "group cursor-pointer overflow-hidden rounded-card border bg-card p-5 transition-[translate,border-color,box-shadow] duration-300",
                                    lit ? cn("-translate-x-1 shadow-card-hover", tone.card) : "border-border",
                                )}
                            >
                                {/* Dimmed on the inside, so the entrance can fade the card itself without a transition in the way. */}
                                <div className={cn("flex gap-4 transition-opacity duration-300", focus && !lit && "opacity-45")}>
                                    <span
                                        lang="en"
                                        aria-hidden
                                        className={cn(
                                            "grid h-11 min-w-16 shrink-0 place-items-center rounded-md border px-2 font-mono text-sm font-semibold transition-[scale,rotate] duration-300",
                                            tone.tile,
                                            lit && "-rotate-3 scale-110",
                                        )}
                                    >
                                        {card.name}
                                    </span>
                                    <div>
                                        <h3 className="font-semibold">{card.title}</h3>
                                        <p className="mt-1 text-[0.95rem] leading-relaxed text-muted-foreground">{card.text}</p>
                                    </div>
                                </div>
                            </SpotlightCard>
                        );
                    })}
                </ul>
            </div>
        </Section>
    );
}
