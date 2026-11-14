"use client";

import { Circle, MonitorPlay, Trophy, Users, type LucideIcon } from "lucide-react";
import { Fragment, useRef, type ReactNode } from "react";
import EditorWindow from "@/components/site/EditorWindow";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import SpotlightCard from "@/components/site/SpotlightCard";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { STATS } from "./content";

const { students, courses, success } = STATS;

/* Each tile in its own syntax colour: the glow, the icon (filling on hover), the accents and its picture. */
const TONES = {
    students: {
        color: "var(--syn-func)",
        text: "text-syn-func",
        icon: "border-syn-func/30 bg-syn-func/10 text-syn-func group-hover:border-syn-func group-hover:bg-syn-func group-hover:text-editor",
    },
    courses: {
        color: "var(--syn-keyword)",
        text: "text-syn-keyword",
        icon: "border-syn-keyword/30 bg-syn-keyword/10 text-syn-keyword group-hover:border-syn-keyword group-hover:bg-syn-keyword group-hover:text-editor",
    },
    success: {
        color: "var(--syn-string)",
        text: "text-syn-string",
        icon: "border-syn-string/30 bg-syn-string/10 text-syn-string group-hover:border-syn-string group-hover:bg-syn-string group-hover:text-editor",
    },
} as const;

type Tone = (typeof TONES)[keyof typeof TONES];

/*
 * The students' dots: one per `perDot` of them, then the grid filled out with
 * empty ones — always at least one, the reader's. Rows of 10 on phones and 20
 * wider, so the total is rounded up to a multiple of 20.
 */
const LIT = Math.floor(students.value / students.perDot);
const DOTS = Math.ceil((LIT + 1) / 20) * 20;

/* The courses' road: a stop per course, the live ones first. */
const STOPS = Array.from({ length: courses.live + courses.upcoming }, (_, index) => index < courses.live);

/* The success ring, filled to the figure. */
const RING = { r: 52, width: 10 };
const CIRCUMFERENCE = 2 * Math.PI * RING.r;
const PERCENT = Math.min(100, Math.max(0, success.percent));

/* How long a figure takes to count up; the ring fills in step with it. */
const COUNT = { duration: 1.8, ease: "power3.out" } as const;

/**
 * The window rises in and its tiles follow. Then everything fills at once:
 * the figures count up from zero, the dots light up one after another, the
 * ring draws round to its figure and the road is laid stop by stop.
 */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root, { autoAlpha: 0, y: 32, duration: 0.6, ...SETTLE })
        .from(root.querySelectorAll("[data-tile]"), { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.1, ...SETTLE }, 0.15)
        .from(
            root.querySelectorAll("[data-tile-icon]"),
            {
                scale: 0,
                rotate: -40,
                duration: 0.5,
                stagger: 0.1,
                ease: "back.out(2.2)",
                ...SETTLE,
            },
            0.25,
        );

    root.querySelectorAll<HTMLElement>("[data-count]").forEach((node) => {
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
            0.35,
        );
    });

    timeline
        .from(
            root.querySelectorAll("[data-dot]"),
            {
                scale: 0,
                autoAlpha: 0,
                duration: 0.3,
                stagger: 0.016,
                ease: "back.out(2)",
                ...SETTLE,
            },
            0.35,
        )
        // An attribute, not a style: left at its rendered value once played.
        .from(root.querySelectorAll("[data-ring]"), { attr: { "stroke-dashoffset": CIRCUMFERENCE }, ...COUNT }, 0.35)
        .from(
            root.querySelectorAll("[data-stop]"),
            {
                scale: 0,
                duration: 0.35,
                stagger: 0.07,
                ease: "back.out(2.4)",
                ...SETTLE,
            },
            0.5,
        )
        .from(
            root.querySelectorAll("[data-road]"),
            {
                scaleX: 0,
                transformOrigin: "left center",
                duration: 0.25,
                stagger: 0.07,
                ...SETTLE,
            },
            0.54,
        )
        .from(root.querySelectorAll("[data-now]"), { autoAlpha: 0, y: 6, duration: 0.4, ...SETTLE }, 0.5 + courses.live * 0.07);
};

/**
 * Half Coders by the numbers, as one dashboard on the dark editor surface:
 * the students as a grid of dots (the empty ones at the end left for the
 * next batch), the success figure as a ring, the courses as a road with the
 * live ones behind and the ones being made ahead. As the band scrolls into
 * view it all fills from zero (once, and not at all with reduced motion asked
 * for — the real figures are what's rendered).
 */
export default function HomeStats() {
    const rootRef = useRef<HTMLDivElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

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

            <div ref={rootRef} className="relative mx-auto max-w-5xl">
                <EditorWindow
                    tabs={[{ name: "progress.json", label: STATS.tab, active: true }]}
                    status={
                        <span className="inline-flex items-center gap-1.5 font-sans">
                            <Circle aria-hidden className="size-2 fill-green-300 text-green-300" />
                            {STATS.status}
                        </span>
                    }
                >
                    {/* The hairlines between the tiles are the grid's gap showing the line colour through. */}
                    <ul className="grid gap-px bg-editor-line sm:grid-cols-2 lg:grid-cols-3">
                        <Tile icon={Users} tone={TONES.students} label={students.label} className="sm:col-span-2">
                            <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                                <p className="font-heading text-5xl font-bold leading-none tracking-tight lg:text-6xl">
                                    <span className="sr-only">{`${students.value}${students.suffix}`}</span>
                                    <Figure value={students.value} suffix={students.suffix} tone={TONES.students} />
                                </p>
                                <p className="max-w-sm text-[0.95rem] leading-relaxed text-editor-muted">{students.text}</p>
                            </div>

                            <div aria-hidden className="mt-7 grid w-fit grid-cols-[repeat(10,auto)] gap-1.5 sm:grid-cols-[repeat(20,auto)]">
                                {Array.from({ length: DOTS }, (_, index) => (
                                    <span
                                        key={index}
                                        data-dot
                                        className={cn(
                                            "size-4 rounded-[3px] sm:size-5",
                                            index < LIT && "bg-syn-func",
                                            // The first empty one pulses: the next to fill, the reader's.
                                            index === LIT && "animate-pulse border-2 border-syn-string bg-syn-string/25 motion-reduce:animate-none",
                                            index > LIT && "border border-editor-gutter/60 bg-editor-panel",
                                        )}
                                    />
                                ))}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-editor-muted">
                                <span className="inline-flex items-center gap-2">
                                    <span aria-hidden className="size-2.5 shrink-0 rounded-[2px] bg-syn-func" />
                                    {students.legend}
                                </span>
                                <span className="inline-flex items-center gap-2">
                                    <span aria-hidden className="size-2.5 shrink-0 rounded-[2px] border border-syn-string" />
                                    {students.open}
                                </span>
                            </div>
                        </Tile>

                        <Tile icon={MonitorPlay} tone={TONES.courses} label={courses.label} className="lg:col-span-2">
                            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-2 font-heading text-4xl font-bold leading-none tracking-tight lg:text-5xl">
                                <span className="sr-only">{`${courses.live} ${courses.liveLabel} + ${courses.upcoming} ${courses.upcomingLabel}`}</span>
                                <Figure value={courses.live} unit={courses.liveLabel} tone={TONES.courses} />
                                <span aria-hidden className="text-3xl text-editor-gutter lg:text-4xl">
                                    +
                                </span>
                                <Figure value={courses.upcoming} unit={courses.upcomingLabel} tone={TONES.courses} />
                            </p>
                            <p className="mt-3 text-[0.95rem] leading-relaxed text-editor-muted">{courses.text}</p>
                            <Road />
                        </Tile>

                        <Tile icon={Trophy} tone={TONES.success} label={success.label} className="lg:col-start-3 lg:row-span-2 lg:row-start-1">
                            {/* The ring sits in the middle of whatever height the tile has spare (two rows' worth on wide screens). */}
                            <div className="flex flex-1 items-center justify-center py-7">
                                <div className="relative grid size-44 place-items-center lg:size-52">
                                    <svg aria-hidden viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90">
                                        <circle cx="60" cy="60" r={RING.r} fill="none" strokeWidth={RING.width} className="stroke-editor-raised" />
                                        <circle
                                            data-ring
                                            cx="60"
                                            cy="60"
                                            r={RING.r}
                                            fill="none"
                                            strokeWidth={RING.width}
                                            strokeLinecap="round"
                                            strokeDasharray={CIRCUMFERENCE}
                                            strokeDashoffset={CIRCUMFERENCE * (1 - PERCENT / 100)}
                                            className="stroke-syn-string"
                                        />
                                    </svg>
                                    <p className="relative font-heading text-5xl font-bold leading-none tracking-tight">
                                        <span className="sr-only">{`${PERCENT}%`}</span>
                                        <Figure value={PERCENT} suffix="%" tone={TONES.success} small />
                                    </p>
                                </div>
                            </div>
                            <p className="text-[0.95rem] leading-relaxed text-editor-muted">{success.text}</p>
                            <p className="mt-5 border-t border-editor-line pt-4 text-sm text-editor-muted">
                                <span className={cn("font-semibold", TONES.success.text)}>{success.note}</span>
                            </p>
                        </Tile>
                    </ul>
                </EditorWindow>
            </div>
        </Section>
    );
}

/** One tile of the dashboard: its icon and what it counts, then whatever it shows. */
function Tile({ icon: Icon, tone, label, className, children }: { icon: LucideIcon; tone: Tone; label: string; className?: string; children: ReactNode }) {
    return (
        <SpotlightCard as="li" data-tile color={tone.color} className={cn("group flex flex-col bg-editor p-6 sm:p-7", className)}>
            <h3 className="flex items-center gap-3 text-lg font-semibold text-editor-fg">
                <span
                    aria-hidden
                    data-tile-icon
                    className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-md border transition-[color,background-color,border-color,rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110",
                        tone.icon,
                    )}
                >
                    <Icon className="size-4.5" />
                </span>
                {label}
            </h3>
            {/* Takes the leftover height, so a tile's foot sits at its bottom when its row stretches it. */}
            <div className="flex flex-1 flex-col">{children}</div>
        </SpotlightCard>
    );
}

/**
 * A figure as the eye sees it, counted up as the band scrolls in. Held at its
 * final width so the suffix doesn't shuffle along as the digits count. The
 * words are said by an `sr-only` line beside it.
 */
function Figure({ value, suffix, unit, tone, small }: { value: number; suffix?: string; unit?: string; tone: Tone; small?: boolean }) {
    return (
        <span aria-hidden className="inline-flex items-baseline gap-1.5">
            <span data-count={value} className="inline-block text-right tabular-nums text-editor-fg" style={{ minWidth: `${String(value).length}ch` }}>
                {value}
            </span>
            {suffix && <span className={cn(small ? "text-3xl" : "text-4xl lg:text-5xl", tone.text)}>{suffix}</span>}
            {unit && <span className={cn("text-lg font-semibold tracking-normal lg:text-xl", tone.text)}>{unit}</span>}
        </span>
    );
}

/**
 * The courses as a road: a stop per course joined by a line, solid through
 * the live ones, dashed on through the ones being made. The last live stop
 * pulses under an "এখন এখানে" flag. The figures above already say it all;
 * this is only the picture.
 */
function Road() {
    return (
        <div aria-hidden className="mt-auto pt-12">
            <div className="flex items-center">
                {STOPS.map((live, index) => (
                    <Fragment key={index}>
                        {index > 0 && (
                            <span
                                data-road
                                className={cn("h-0 min-w-1 flex-1 border-t-2", live ? "border-syn-keyword" : "border-dashed border-syn-keyword/35")}
                            />
                        )}
                        <span data-stop className="relative flex size-3.5 shrink-0 sm:size-4">
                            {index === courses.live - 1 && (
                                <>
                                    <span className="absolute inset-0 animate-ping rounded-full bg-syn-keyword opacity-60 motion-reduce:animate-none" />
                                    <span
                                        data-now
                                        className="absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap rounded-sm border border-syn-keyword/40 bg-syn-keyword/15 px-2 py-0.5 text-xs font-semibold text-syn-keyword"
                                    >
                                        {courses.now}
                                    </span>
                                </>
                            )}
                            <span
                                className={cn(
                                    "relative size-full rounded-full",
                                    live ? "bg-syn-keyword" : "border-2 border-dashed border-syn-keyword/50 bg-editor",
                                )}
                            />
                        </span>
                    </Fragment>
                ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-editor-muted">
                <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-syn-keyword" />
                    {courses.liveLabel}
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full border border-dashed border-syn-keyword/60" />
                    {courses.upcomingLabel}
                </span>
            </div>
        </div>
    );
}
