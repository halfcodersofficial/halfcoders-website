"use client";

import { Code2, Cpu, Rocket, BriefcaseBusiness, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import CtaButton from "@/components/site/CtaButton";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import SpotlightCard from "@/components/site/SpotlightCard";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { TRACKS, type TrackIcon } from "./content";

const ICONS: Record<TrackIcon, LucideIcon> = {
    code: Code2,
    engineering: Cpu,
    build: Rocket,
    career: BriefcaseBusiness,
};

/* Each area in its own syntax colour: the glow, the bar, the icon tile (filling on hover) and the topics. */
const TONES: Record<TrackIcon, { color: string; text: string; tile: string; bar: string; chip: string }> = {
    code: {
        color: "var(--syn-func)",
        text: "text-syn-func",
        tile: "border-syn-func/30 bg-syn-func/5 text-syn-func group-hover:border-syn-func group-hover:bg-syn-func group-hover:text-white",
        bar: "bg-syn-func",
        chip: "group-hover:bg-syn-func/10 group-hover:text-syn-func",
    },
    engineering: {
        color: "var(--syn-number)",
        text: "text-syn-number",
        tile: "border-syn-number/30 bg-syn-number/5 text-syn-number group-hover:border-syn-number group-hover:bg-syn-number group-hover:text-white",
        bar: "bg-syn-number",
        chip: "group-hover:bg-syn-number/10 group-hover:text-syn-number",
    },
    build: {
        color: "var(--syn-keyword)",
        text: "text-syn-keyword",
        tile: "border-syn-keyword/30 bg-syn-keyword/5 text-syn-keyword group-hover:border-syn-keyword group-hover:bg-syn-keyword group-hover:text-white",
        bar: "bg-syn-keyword",
        chip: "group-hover:bg-syn-keyword/10 group-hover:text-syn-keyword",
    },
    career: {
        color: "var(--syn-string)",
        text: "text-syn-string",
        tile: "border-syn-string/30 bg-syn-string/5 text-syn-string group-hover:border-syn-string group-hover:bg-syn-string group-hover:text-white",
        bar: "bg-syn-string",
        chip: "group-hover:bg-syn-string/10 group-hover:text-syn-string",
    },
};

/** The cards rise in one after another, their colour bars drawing across, the icons popping and the topics following. */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root.querySelectorAll("[data-track]"), { autoAlpha: 0, y: 36, scale: 0.96, duration: 0.6, stagger: 0.1, ...SETTLE })
        .from(root.querySelectorAll("[data-track-bar]"), { scaleX: 0, transformOrigin: "left center", duration: 0.6, stagger: 0.1, ...SETTLE }, 0.25)
        .from(root.querySelectorAll("[data-track-icon]"), { scale: 0, rotate: -40, duration: 0.5, stagger: 0.1, ease: "back.out(2.2)", ...SETTLE }, 0.3)
        .from(root.querySelectorAll("[data-track-topic]"), { autoAlpha: 0, y: 8, duration: 0.3, stagger: 0.03, ...SETTLE }, 0.55);
};

/**
 * The areas Half Coders teaches in — coding, engineering foundations,
 * building with AI, career skills — as four cards, each in its own colour
 * with its icon, what it covers and a few topics. They arrive one after
 * another as they scroll into view; pointed at, a card lifts, a glow in its
 * colour follows the pointer, the icon tile fills and the topics take the
 * colour one by one. Under them, the catalogue.
 */
export default function HomeTracks() {
    const rootRef = useRef<HTMLUListElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    return (
        <Section id="tracks" labelledBy="home-tracks-title">
            <SectionHeader
                id="home-tracks-title"
                eyebrow={TRACKS.eyebrow}
                title={TRACKS.title}
                description={TRACKS.description}
                action={<CtaButton kind="catalogue" label={TRACKS.cta} />}
            />
            <ul ref={rootRef} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {TRACKS.items.map((track) => {
                    const Icon = ICONS[track.icon];
                    const tone = TONES[track.icon];
                    return (
                        <SpotlightCard
                            as="li"
                            key={track.title}
                            data-track
                            color={tone.color}
                            className="group flex flex-col overflow-hidden rounded-card border border-border bg-card p-5 transition-[translate,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:shadow-card-hover motion-reduce:hover:translate-y-0"
                        >
                            <span aria-hidden data-track-bar className={cn("absolute inset-x-0 top-0 h-0.5 transition-[height] duration-300 group-hover:h-1", tone.bar)} />
                            {/* A big faint copy of the icon in the corner, turning as the card is pointed at. */}
                            <Icon
                                aria-hidden
                                className={cn(
                                    "pointer-events-none absolute -bottom-7 -right-7 size-32 opacity-[0.05] transition-[rotate,scale,opacity] duration-500 ease-out group-hover:-rotate-12 group-hover:scale-110 group-hover:opacity-[0.11]",
                                    tone.text,
                                )}
                                strokeWidth={1.25}
                            />
                            <span
                                data-track-icon
                                className={cn(
                                    "grid size-11 place-items-center rounded-md border transition-[color,background-color,border-color,rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110",
                                    tone.tile,
                                )}
                            >
                                <Icon className="size-5" aria-hidden />
                            </span>
                            <h3 className="mt-4 text-lg font-semibold">{track.title}</h3>
                            <p className="mt-1.5 flex-1 text-[0.95rem] leading-relaxed text-muted-foreground">{track.text}</p>
                            <ul className="mt-4 flex flex-wrap gap-1.5">
                                {track.topics.map((topic, index) => (
                                    <li
                                        key={topic}
                                        data-track-topic
                                        className={cn("rounded-sm bg-surface px-2 py-0.5 text-xs text-foreground/80 transition-colors duration-300", tone.chip)}
                                        style={{ transitionDelay: `${index * 60}ms` }}
                                    >
                                        {topic}
                                    </li>
                                ))}
                            </ul>
                        </SpotlightCard>
                    );
                })}
            </ul>
        </Section>
    );
}
