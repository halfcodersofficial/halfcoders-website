"use client";

import { BriefcaseBusiness, Cpu, GraduationCap, Shuffle, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import SpotlightCard from "@/components/site/SpotlightCard";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { AUDIENCE, type AudienceIcon } from "./content";

const ICONS: Record<AudienceIcon, LucideIcon> = {
    student: GraduationCap,
    engineer: Cpu,
    switcher: Shuffle,
    jobseeker: BriefcaseBusiness,
};

/* Each kind of learner in its own syntax colour: the glow, the line across the top, the icon tile (filling on hover). */
const TONES: Record<AudienceIcon, { color: string; text: string; tile: string; line: string }> = {
    student: {
        color: "var(--syn-func)",
        text: "text-syn-func",
        tile: "bg-syn-func/10 text-syn-func group-hover:bg-syn-func group-hover:text-white",
        line: "from-syn-func",
    },
    engineer: {
        color: "var(--syn-number)",
        text: "text-syn-number",
        tile: "bg-syn-number/10 text-syn-number group-hover:bg-syn-number group-hover:text-white",
        line: "from-syn-number",
    },
    switcher: {
        color: "var(--syn-keyword)",
        text: "text-syn-keyword",
        tile: "bg-syn-keyword/10 text-syn-keyword group-hover:bg-syn-keyword group-hover:text-white",
        line: "from-syn-keyword",
    },
    jobseeker: {
        color: "var(--syn-string)",
        text: "text-syn-string",
        tile: "bg-syn-string/10 text-syn-string group-hover:bg-syn-string group-hover:text-white",
        line: "from-syn-string",
    },
};

/** The cards rise in one after another, each icon popping in after its card. */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root.querySelectorAll("[data-audience]"), { autoAlpha: 0, y: 30, rotate: -1.5, duration: 0.55, stagger: 0.1, ...SETTLE })
        .from(root.querySelectorAll("[data-audience-icon]"), { scale: 0, duration: 0.45, stagger: 0.1, ease: "back.out(2.4)", ...SETTLE }, 0.2);
};

/**
 * Who the courses are for: four kinds of learner, each a card in its own
 * colour with an icon and a line. They rise in one after another; pointed
 * at, a card lifts, a glow in its colour follows the pointer, a line draws
 * across its top and the icon tile fills and tilts.
 */
export default function HomeAudience() {
    const rootRef = useRef<HTMLUListElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    return (
        <Section labelledBy="home-audience-title">
            <SectionHeader id="home-audience-title" eyebrow={AUDIENCE.eyebrow} title={AUDIENCE.title} description={AUDIENCE.description} />
            <ul ref={rootRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {AUDIENCE.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const tone = TONES[item.icon];
                    return (
                        <SpotlightCard
                            as="li"
                            key={item.title}
                            data-audience
                            color={tone.color}
                            className="group overflow-hidden rounded-card border border-border bg-card p-5 transition-[translate,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:shadow-card-hover motion-reduce:hover:translate-y-0 sm:p-6"
                        >
                            {/* A line in the card's colour, drawing across the top on hover. */}
                            <span
                                aria-hidden
                                className={cn(
                                    "absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-linear-to-r to-transparent transition-[scale] duration-500 ease-out group-hover:scale-x-100",
                                    tone.line,
                                )}
                            />
                            <Icon
                                aria-hidden
                                strokeWidth={1.25}
                                className={cn(
                                    "pointer-events-none absolute -right-5 -top-5 size-28 opacity-[0.05] transition-[rotate,scale,opacity] duration-500 ease-out group-hover:rotate-12 group-hover:scale-110 group-hover:opacity-[0.1]",
                                    tone.text,
                                )}
                            />
                            <span
                                data-audience-icon
                                className={cn(
                                    "grid size-12 place-items-center rounded-xl transition-[color,background-color,rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110",
                                    tone.tile,
                                )}
                            >
                                <Icon className="size-5.5" aria-hidden />
                            </span>
                            <h3 className="mt-5 font-semibold leading-snug">{item.title}</h3>
                            <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted-foreground">{item.text}</p>
                        </SpotlightCard>
                    );
                })}
            </ul>
        </Section>
    );
}
