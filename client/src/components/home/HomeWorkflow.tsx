"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Award, Check, CheckCircle2, CheckSquare, ClipboardCheck, MessageSquareText, MinusSquare, Sparkles, Video, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import EditorWindow from "@/components/site/EditorWindow";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { WORKFLOW, type WorkflowIcon } from "./content";

const ICONS: Record<WorkflowIcon, LucideIcon> = {
    enroll: Wallet,
    live: Video,
    quiz: ClipboardCheck,
    review: MessageSquareText,
    certificate: Award,
};

/* Each step's icon tile, in its own syntax colour once the step is reached. */
const TONES: Record<WorkflowIcon, string> = {
    enroll: "border-syn-number/40 bg-syn-number/10 text-syn-number",
    live: "border-syn-tag/40 bg-syn-tag/10 text-syn-tag",
    quiz: "border-syn-func/40 bg-syn-func/10 text-syn-func",
    review: "border-syn-keyword/40 bg-syn-keyword/10 text-syn-keyword",
    certificate: "border-syn-string/40 bg-syn-string/10 text-syn-string",
};

const STEPS = WORKFLOW.commits;

/** Where on the screen the path "is", as a share of the viewport's height: a step lights up as its dot passes this line. */
const LINE = 0.65;

const bn = (value: number) => value.toLocaleString("bn-BD");

/** The checklist's ticks land one by one, then the note under them. */
const buildNeeds: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root.querySelectorAll("[data-need]"), { autoAlpha: 0, x: -12, duration: 0.4, stagger: 0.12, ...SETTLE })
        .from(root.querySelectorAll("[data-need-icon]"), { scale: 0, duration: 0.35, stagger: 0.12, ease: "back.out(2.5)", ...SETTLE }, 0.15)
        .from(root.querySelectorAll("[data-need-note]"), { autoAlpha: 0, y: 6, duration: 0.4, ...SETTLE });
};

/**
 * How a course goes, as five steps down a path, from enrolling to the
 * certificate. The path fills in violet as the page scrolls, and each step
 * lights up as the fill reaches its dot: the dot turns into a tick, the icon
 * takes its colour, and a little note slides in — what you'd see on reaching
 * that step ("আজ রাত ৯টায় লাইভ ক্লাস"). Rendered fully lit, so without
 * JavaScript or with reduced motion asked for, it is simply the whole path.
 * Beside it, sticky on wide screens, what you need to start, the ticks
 * landing one by one.
 */
export default function HomeWorkflow() {
    const listRef = useRef<HTMLOListElement>(null);
    const needsRef = useRef<HTMLDivElement>(null);
    const [reached, setReached] = useState<number>(STEPS.length);
    useScrollEntrance(needsRef, buildNeeds);

    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();

        media.add("(prefers-reduced-motion: no-preference)", () => {
            const dots = Array.from(list.querySelectorAll<HTMLElement>("[data-step-dot]"));
            const count = () => {
                const line = window.innerHeight * LINE;
                setReached(
                    dots.filter((dot) => {
                        const box = dot.getBoundingClientRect();
                        return box.top + box.height / 2 <= line;
                    }).length,
                );
            };
            const at = `${LINE * 100}%`;

            ScrollTrigger.create({ trigger: list, start: `top ${at}`, end: `bottom ${at}`, onUpdate: count, onRefresh: count });
            list.querySelectorAll<HTMLElement>("[data-step-line]").forEach((line) => {
                gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: line.parentElement, start: `top ${at}`, end: `bottom ${at}`, scrub: true } });
            });
            count();

            return () => setReached(STEPS.length);
        });

        return () => media.revert();
    }, []);

    return (
        <Section tone="surface" labelledBy="home-workflow-title">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
                <div ref={needsRef} className="lg:sticky lg:top-28 lg:self-start">
                    <SectionHeader
                        id="home-workflow-title"
                        eyebrow={WORKFLOW.eyebrow}
                        title={WORKFLOW.title}
                        description={WORKFLOW.description}
                        className="mb-8 sm:mb-8"
                    />
                    <EditorWindow tone="light" tabs={[{ name: "requirements.txt", label: WORKFLOW.needsTitle, active: true }]}>
                        <ul className="space-y-3 px-5 py-4">
                            {WORKFLOW.needs.map((need) => (
                                <li key={need.text} data-need className="flex items-start gap-3 text-[0.95rem]">
                                    <span data-need-icon className="mt-0.5 shrink-0">
                                        {need.done ? (
                                            <CheckSquare className="size-4.5 text-success" aria-hidden />
                                        ) : (
                                            <MinusSquare className="size-4.5 text-muted-foreground" aria-hidden />
                                        )}
                                    </span>
                                    <span className={cn(!need.done && "text-muted-foreground")}>{need.text}</span>
                                </li>
                            ))}
                        </ul>
                        <p data-need-note className="flex items-center gap-2 border-t border-border bg-success/5 px-5 py-3 text-sm font-medium text-success-ink">
                            <Sparkles className="size-4 shrink-0" aria-hidden />
                            {WORKFLOW.needsNote}
                        </p>
                    </EditorWindow>
                </div>

                <ol ref={listRef} className="relative">
                    {STEPS.map((step, index) => {
                        const Icon = ICONS[step.icon];
                        const done = index < reached;
                        const last = index === STEPS.length - 1;
                        // The step the fill has just reached keeps a slow pulse, until the whole path is done.
                        const current = index === reached - 1 && !last;
                        return (
                            <li key={step.message} className="relative pb-6 pl-10 last:pb-0 sm:pl-14">
                                {/* The path down to the next step: a grey track, filling violet as the page scrolls. */}
                                {!last && (
                                    <span aria-hidden className="absolute left-[0.8125rem] top-[2.125rem] h-full w-0.5 rounded-full bg-border-strong">
                                        <span data-step-line className="absolute inset-0 origin-top rounded-full bg-primary" />
                                    </span>
                                )}
                                <span
                                    aria-hidden
                                    data-step-dot
                                    className={cn(
                                        "absolute left-0 top-5 z-10 grid size-7 place-items-center rounded-full border-2 font-mono text-[0.7rem] font-bold transition-[background-color,border-color,color,box-shadow,scale] duration-300",
                                        done
                                            ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
                                            : "scale-90 border-border-strong bg-surface text-muted-foreground",
                                    )}
                                >
                                    {current && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40 motion-reduce:animate-none" />}
                                    {done ? <Check className="relative size-3.5" strokeWidth={3} /> : bn(index + 1)}
                                </span>

                                <div
                                    className={cn(
                                        "group relative overflow-hidden rounded-card border bg-card p-5 transition-[border-color,box-shadow,translate] duration-500 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-6",
                                        done ? "border-primary/30 shadow-card-hover" : "border-border",
                                    )}
                                >
                                    {/* The step's number, large and faint in the corner. */}
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "pointer-events-none absolute -top-4 right-2 select-none font-heading text-[4.5rem] font-bold leading-none transition-colors duration-500 sm:-top-6 sm:text-[6.5rem]",
                                            done ? "text-primary/[0.08]" : "text-foreground/[0.04]",
                                        )}
                                    >
                                        {bn(index + 1)}
                                    </span>
                                    {/* Icon above the text on phones, where beside it the text would be squeezed. */}
                                    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                                        <span
                                            className={cn(
                                                "grid size-11 shrink-0 place-items-center rounded-md border transition-[color,background-color,border-color,rotate,scale] duration-500 group-hover:-rotate-6 group-hover:scale-105",
                                                done ? TONES[step.icon] : "border-border bg-surface text-muted-foreground",
                                            )}
                                        >
                                            <Icon className="size-5" aria-hidden />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-mono text-xs text-syn-keyword">ধাপ {bn(index + 1)}</p>
                                            <h3 className="mt-0.5 text-lg font-semibold">{step.message}</h3>
                                            <p className="mt-1.5 leading-relaxed text-muted-foreground">{step.text}</p>
                                            <p
                                                className={cn(
                                                    "mt-3 inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-xs font-medium text-success-ink transition-[opacity,translate] duration-500",
                                                    done ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
                                                )}
                                            >
                                                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                                                {step.chip}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </Section>
    );
}
