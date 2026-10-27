"use client";

import { Bed, Briefcase, Coffee, Headphones, Home, ListChecks, Sandwich, Video, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import EditorWindow from "@/components/site/EditorWindow";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { cn } from "@/lib/utils";
import { DAY, type DayBlock, type DayIcon } from "./content";

const ICONS: Record<DayIcon, LucideIcon> = {
    tea: Coffee,
    work: Briefcase,
    lunch: Sandwich,
    home: Home,
    live: Video,
    support: Headphones,
    quiz: ListChecks,
    sleep: Bed,
};

/** How long the playhead rests on each learning block before moving on. */
const STEP_MS = 2200;

const LEARN = DAY.blocks.filter((block) => block.kind === "learn");
const HOURS = Array.from({ length: (DAY.end - DAY.start) / 3 + 1 }, (_, index) => DAY.start + index * 3);

/** Where on the day an hour sits, as a share of the track's width. */
const at = (hour: number) => ((hour - DAY.start) / (DAY.end - DAY.start)) * 100;
const clock = (hour: number) => `${String(Math.floor(hour)).padStart(2, "0")}:${hour % 1 ? "30" : "00"}`;

/**
 * An ordinary day as a timeline in the editor: two tracks under an hour ruler
 * — the learner's own hours (class or office, family, sleep) and the Half
 * Coders blocks in the gaps (a morning lesson, the rest at lunch, the live
 * class, a support session, a quiz before bed). A violet playhead glides from
 * one learning block to the next and the card under the timeline says what
 * that block is, a thin bar along its foot counting down to the next move
 * (the bar's end is what moves it, so the two never drift apart). It rests
 * while pointed at or focused, any block can be picked, and with reduced
 * motion asked for it stays where it's put.
 */
export default function HomeDay() {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const [still, setStill] = useState(false);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setStill(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    const next = () => setActive((index) => (index + 1) % LEARN.length);
    const current = LEARN[active];
    const Icon = ICONS[current.icon];

    const track = (kind: DayBlock["kind"]) => (
        <div className="relative h-11 rounded-sm bg-editor-panel">
            {DAY.blocks
                .filter((block) => block.kind === kind)
                .map((block) => {
                    const BlockIcon = ICONS[block.icon];
                    const learnIndex = LEARN.indexOf(block);
                    const isActive = learnIndex === active;
                    const common = cn(
                        "absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-sm border transition-[color,background-color,border-color,box-shadow,scale] duration-300",
                        kind === "busy" ? "border-editor-line bg-editor-raised text-editor-muted" : "border-violet-400/40 bg-violet-500/20 text-syn-keyword",
                        isActive && "z-10 scale-110 border-syn-string bg-syn-string/25 text-syn-string shadow-[0_0_14px_-2px_var(--syn-string)]",
                    );
                    const style = { left: `${at(block.from)}%`, width: `${Math.max(at(block.to) - at(block.from), 2.4)}%` };
                    return kind === "learn" ? (
                        <button
                            key={block.title}
                            type="button"
                            onClick={() => setActive(learnIndex)}
                            aria-label={`${block.time} — ${block.title}`}
                            aria-pressed={isActive}
                            className={cn(common, "cursor-pointer hover:border-syn-string")}
                            style={style}
                        >
                            <BlockIcon className="size-3.5 shrink-0" aria-hidden />
                        </button>
                    ) : (
                        <span key={block.title} className={common} style={style} title={`${block.time} — ${block.title}`}>
                            <BlockIcon className="size-3.5 shrink-0" aria-hidden />
                            {block.to - block.from >= 2 && <span className="ml-1.5 hidden truncate text-[0.7rem] sm:inline">{block.title}</span>}
                        </span>
                    );
                })}
        </div>
    );

    return (
        <Section labelledBy="home-day-title">
            <SectionHeader id="home-day-title" eyebrow={DAY.eyebrow} title={DAY.title} description={DAY.description} />

            <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
                <EditorWindow tabs={[{ name: "day.ts", label: DAY.tab, active: true }]} bodyClassName="px-4 pb-5 pt-4 sm:px-6">
                    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
                        {/* The hour ruler. */}
                        <span />
                        <div aria-hidden className="relative mb-2 h-5 font-mono text-[0.65rem] text-editor-gutter">
                            {HOURS.map((hour) => (
                                <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${at(hour)}%` }}>
                                    {String(hour % 24).padStart(2, "0")}
                                </span>
                            ))}
                        </div>

                        <p className="self-center text-xs text-editor-muted">{DAY.tracks.busy}</p>
                        <div className="relative">
                            {track("busy")}
                            <Playhead left={at(current.from)} still={still} label={clock(current.from)} />
                        </div>

                        <p className="mt-2 self-center text-xs font-semibold text-syn-keyword">{DAY.tracks.learn}</p>
                        <div className="relative mt-2">
                            {track("learn")}
                            <Playhead left={at(current.from)} still={still} />
                        </div>
                    </div>

                    {/* What the playhead is on. */}
                    <div aria-live="polite" className="relative mt-5 flex gap-4 overflow-hidden rounded-card border border-editor-line bg-editor-panel p-4 sm:p-5">
                        <span
                            key={`icon-${current.title}`}
                            className="grid size-11 shrink-0 place-items-center rounded-md border border-syn-string/40 bg-syn-string/10 text-syn-string animate-in zoom-in-50 spin-in-12 duration-300 motion-reduce:animate-none"
                        >
                            <Icon className="size-5" aria-hidden />
                        </span>
                        <div key={current.title} className="min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
                            <p className="font-mono text-xs text-syn-string">{current.time}</p>
                            <h3 className="mt-0.5 text-lg font-semibold text-editor-fg">{current.title}</h3>
                            <p className="mt-1 leading-relaxed text-editor-muted">{current.text}</p>
                        </div>
                        {/* Counting down to the next block; when it fills, the playhead moves on. */}
                        {!still && (
                            <span
                                key={`bar-${active}`}
                                aria-hidden
                                onAnimationEnd={next}
                                className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-syn-string/70"
                                style={{ animation: `fill-x ${STEP_MS}ms linear both`, animationPlayState: paused ? "paused" : "running" }}
                            />
                        )}
                    </div>
                </EditorWindow>
            </div>
        </Section>
    );
}

/** The violet line marking the moment of the day, gliding as it moves. */
function Playhead({ left, still, label }: { left: number; still: boolean; label?: string }) {
    return (
        <span
            aria-hidden
            className={cn("pointer-events-none absolute -inset-y-1 z-20 w-0.5 -translate-x-1/2 bg-violet-400", !still && "transition-[left] duration-500 ease-in-out")}
            style={{ left: `${left}%` }}
        >
            {label && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-sm bg-violet-500 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-white">
                    {label}
                </span>
            )}
        </span>
    );
}
