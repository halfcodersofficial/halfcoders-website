"use client";

import { Check } from "lucide-react";
import { useRef } from "react";
import CtaButton from "@/components/site/CtaButton";
import { Eyebrow, Prompt } from "@/components/site/code";
import EditorWindow from "@/components/site/EditorWindow";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { CTA } from "./content";

/** The terminal prints its lines one after another, as if the command were running. */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline.from(root.querySelectorAll("[data-cta-line]"), {
        autoAlpha: 0,
        x: -10,
        duration: 0.35,
        stagger: 0.14,
        ...SETTLE,
    });
};

/**
 * The closing call to action, on the dark editor surface with a violet glow:
 * the ask and the two ways in on the left; on the right a terminal that
 * "starts" Half Coders and prints, ticked line by line, what every course
 * gives — the command is decoration, the lines are the real promise, in
 * plain Bangla. The lines type in as the card scrolls into view (not at all
 * with reduced motion asked for).
 */
export default function HomeCta() {
    const terminalRef = useRef<HTMLDivElement>(null);
    useScrollEntrance(terminalRef, buildEntrance);

    return (
        <section aria-labelledby="home-cta-title" className="container-page pt-6">
            <EditorWindow tabs={[{ name: "start.sh", label: CTA.eyebrow, active: true }]} className="relative">
                <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
                <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 size-112 rounded-full bg-violet-600/25 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/4 size-96 rounded-full bg-fuchsia-600/10 blur-3xl" />

                <div className="relative grid grid-cols-1 gap-10 p-7 sm:p-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-14">
                    <div>
                        <Eyebrow>{CTA.eyebrow}</Eyebrow>
                        <h2 id="home-cta-title" className="mt-4 text-h2 text-balance">
                            {CTA.title}
                        </h2>
                        <p className="mt-3 max-w-xl leading-relaxed text-editor-muted sm:text-lg">{CTA.description}</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <CtaButton kind="enroll" size="lg" />
                            <CtaButton kind="courses" size="lg" />
                        </div>
                    </div>

                    <div ref={terminalRef} className="rounded-card border border-editor-line bg-editor-panel/90 p-5 shadow-panel sm:p-6">
                        <p lang="en" aria-hidden className="font-mono text-xs sm:text-sm">
                            <Prompt>{CTA.command}</Prompt>
                        </p>
                        <ul className="mt-4 space-y-2.5">
                            {CTA.gives.map((line) => (
                                <li key={line} data-cta-line className="flex items-start gap-2.5 text-[0.95rem] text-editor-fg">
                                    <Check className="mt-1 size-4 shrink-0 text-syn-string" strokeWidth={3} aria-hidden />
                                    {line}
                                </li>
                            ))}
                        </ul>
                        <p data-cta-line className="mt-4 font-mono text-sm text-syn-keyword">
                            <span aria-hidden>{"→ "}</span>
                            {CTA.output}
                            <span aria-hidden className="caret" />
                        </p>
                    </div>
                </div>
            </EditorWindow>
        </section>
    );
}
