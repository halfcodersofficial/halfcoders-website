"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flame, LifeBuoy, MessageSquareText, Route, ShieldCheck, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import EditorWindow from "@/components/site/EditorWindow";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { SETTLE } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { WHY, type WhyIcon } from "./content";

const ICONS: Record<WhyIcon, LucideIcon> = {
    roadmap: Route,
    review: MessageSquareText,
    support: LifeBuoy,
    motivation: Flame,
    proof: ShieldCheck,
};

/* Each answer's icon in its own syntax colour. */
const TONES: Record<WhyIcon, string> = {
    roadmap: "border-syn-func/30 bg-syn-func/10 text-syn-func",
    review: "border-syn-keyword/30 bg-syn-keyword/10 text-syn-keyword",
    support: "border-syn-tag/30 bg-syn-tag/10 text-syn-tag",
    motivation: "border-syn-number/30 bg-syn-number/10 text-syn-number",
    proof: "border-syn-string/30 bg-syn-string/10 text-syn-string",
};

const bn = (value: number) => value.toLocaleString("bn-BD");
const COUNT = WHY.rows.length;

/**
 * Learning alone against learning here, as a code review's split diff in the
 * editor: the problems down the left as removed lines (red, a `−`, line
 * numbers in the gutter), what Half Coders does about each down the right as
 * the added lines that replace them (green, a `+`, the answer's icon in its
 * syntax colour). A hunk header and the window's status bar count them. On a
 * phone it folds into a unified diff — each `−` line straight above its `+`.
 * Pointing at a row lights both halves.
 *
 * As a row scrolls in, its problem appears and then the fix is "applied" —
 * the added line wiping in from the left. Rendered complete, so without
 * JavaScript or with reduced motion asked for, it is simply the whole diff.
 */
export default function HomeWhy() {
    const listRef = useRef<HTMLOListElement>(null);

    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();

        media.add("(prefers-reduced-motion: no-preference)", () => {
            const finish: (() => void)[] = [];
            list.querySelectorAll<HTMLElement>("[data-why-row]").forEach((row) => {
                if (row.getBoundingClientRect().top < window.innerHeight * 0.85) return;
                const timeline = gsap
                    .timeline({ paused: true, defaults: { ease: "power2.out" } })
                    .from(row.querySelector("[data-why-problem]"), { autoAlpha: 0, duration: 0.4, ...SETTLE })
                    .from(
                        row.querySelector("[data-why-solution]"),
                        { clipPath: "inset(0 100% 0 0)", duration: 0.6, ease: "power2.inOut", clearProps: "clipPath" },
                        0.3,
                    )
                    .from(row.querySelector("[data-why-icon]"), { scale: 0, duration: 0.35, ease: "back.out(2.4)", ...SETTLE }, 0.6);
                ScrollTrigger.create({ trigger: row, start: "top 88%", once: true, onEnter: () => void timeline.play() });
                finish.push(() => void timeline.progress(1));
            });
            return () => finish.forEach((done) => done());
        });

        return () => media.revert();
    }, []);

    return (
        <Section tone="surface" labelledBy="home-why-title">
            <SectionHeader
                id="home-why-title"
                eyebrow={WHY.eyebrow}
                align="center"
                title={WHY.title.map((part, index) => (
                    <span key={index} className={cn(part.kind === "problem" && "text-destructive-ink", part.kind === "solution" && "text-success-ink")}>
                        {part.text}
                    </span>
                ))}
                description={WHY.description}
            />

            <EditorWindow
                tone="light"
                tabs={[{ name: "compare.diff", label: "পার্থক্য", active: true }]}
                status={
                    <>
                        <span>
                            {bn(COUNT)}টা সমস্যা, {bn(COUNT)}টা সমাধান
                        </span>
                        <span lang="en" aria-hidden>
                            −{COUNT} +{COUNT}
                        </span>
                    </>
                }
                className="mx-auto max-w-5xl shadow-card"
            >
                {/* The two sides' headers, as a split diff's file names. */}
                <div className="hidden grid-cols-2 border-b border-border text-sm font-semibold md:grid">
                    <p className="flex items-center gap-2 bg-destructive/5 px-5 py-2.5 text-destructive-ink">
                        <span aria-hidden className="font-mono">
                            −
                        </span>
                        {WHY.problemLabel}
                    </p>
                    <p className="flex items-center gap-2 border-l border-border bg-success/6 px-5 py-2.5 text-success-ink">
                        <span aria-hidden className="font-mono">
                            +
                        </span>
                        {WHY.solutionLabel}
                    </p>
                </div>

                {/* The hunk header: where the change is, in diff terms. */}
                <p aria-hidden lang="en" className="border-b border-border bg-surface px-5 py-1.5 font-mono text-xs text-syn-func">
                    @@ -1,{COUNT} +1,{COUNT} @@ <span className="text-syn-comment">learn-alone → half-coders</span>
                </p>

                <ol ref={listRef} className="divide-y divide-border">
                    {WHY.rows.map((row, index) => {
                        const Icon = ICONS[row.icon];
                        const number = index + 1;
                        return (
                            <li key={row.icon} data-why-row className="group grid grid-cols-1 md:grid-cols-2">
                                <p
                                    data-why-problem
                                    className="grid grid-cols-[2.25rem_1.25rem_minmax(0,1fr)] items-start bg-destructive/4 py-3.5 pr-5 transition-colors group-hover:bg-destructive/8"
                                >
                                    <span aria-hidden className="pr-2 text-right font-mono text-xs leading-6 text-muted-foreground/70">
                                        {number}
                                    </span>
                                    <span className="font-mono leading-6 text-destructive-ink">
                                        <span aria-hidden>−</span>
                                        <span className="sr-only">{WHY.problemLabel}: </span>
                                    </span>
                                    <span className="leading-6 text-muted-foreground">{row.problem}</span>
                                </p>
                                <p
                                    data-why-solution
                                    className="grid grid-cols-[2.25rem_1.25rem_minmax(0,1fr)] items-start bg-success/5 py-3.5 pr-5 transition-colors group-hover:bg-success/10 md:border-l md:border-border"
                                >
                                    <span aria-hidden className="pr-2 text-right font-mono text-xs leading-6 text-muted-foreground/70">
                                        {number}
                                    </span>
                                    <span className="font-mono leading-6 text-success-ink">
                                        <span aria-hidden>+</span>
                                        <span className="sr-only">{WHY.solutionLabel}: </span>
                                    </span>
                                    <span className="flex items-start gap-3">
                                        <span
                                            data-why-icon
                                            aria-hidden
                                            className={cn("mt-px grid size-6 shrink-0 place-items-center rounded-sm border", TONES[row.icon])}
                                        >
                                            <Icon className="size-3.5" />
                                        </span>
                                        <span className="font-medium leading-6">{row.solution}</span>
                                    </span>
                                </p>
                            </li>
                        );
                    })}
                </ol>
            </EditorWindow>
        </Section>
    );
}
