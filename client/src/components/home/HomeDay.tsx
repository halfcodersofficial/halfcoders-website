"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Bed, Briefcase, Coffee, Headphones, Home, Lightbulb, ListChecks, Sandwich, Video, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
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

/** A time of day as the gutter shows it: 7.5 → "07:30". */
const clock = (hour: number) => `${String(Math.floor(hour) % 24).padStart(2, "0")}:${hour % 1 ? "30" : "00"}`;

const bn = (value: number) => value.toLocaleString("bn-BD");

/** Where on the screen the day "is", as a share of the viewport's height: the block under this line is the current one. */
const LINE = 0.6;

/**
 * The day as the file draws it: each busy block a line, with any learning
 * that falls inside it (lunch, in the office day) nested in its scope.
 */
const ROWS: { block: DayBlock; inner: DayBlock[] }[] = (() => {
    const rows: { block: DayBlock; inner: DayBlock[] }[] = [];
    for (const block of DAY.blocks) {
        const host = block.kind === "learn" && rows.find((row) => row.block.kind === "busy" && row.block.from <= block.from && block.to <= row.block.to);
        if (host) host.inner.push(block);
        else rows.push({ block, inner: [] });
    }
    return rows;
})();

/** Every block in the order the file shows it — the order the playhead walks. */
const ORDER = ROWS.flatMap((row) => [row.block, ...row.inner]);
const LEARN_COUNT = DAY.blocks.filter((block) => block.kind === "learn").length;

/**
 * An ordinary day with learning fitted into its gaps, written as a file in
 * the dark editor (`routine.ts`): the clock down the gutter where the line
 * numbers would be; the learning as added lines — a `+`, a green wash, the
 * icon, what happens and why it fits; the rest of the day (office, family,
 * sleep) as greyed-out comments, the office day a `{ … }` scope with the
 * lunch-break lesson nested inside it. Beside it, sticky on wide screens,
 * the heading, a legend and what's fixed in the day and what isn't.
 *
 * As the page scrolls, a violet line fills down the gutter and the block
 * under it lights up, its time in the status bar — the day moving on.
 * Without JavaScript or with reduced motion asked for, the whole day simply
 * stands there, nothing lit.
 */
export default function HomeDay() {
    const listRef = useRef<HTMLOListElement>(null);
    const [active, setActive] = useState(-1);

    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();

        media.add("(prefers-reduced-motion: no-preference)", () => {
            const blocks = Array.from(list.querySelectorAll<HTMLElement>("[data-day-block]"));
            const at = `${LINE * 100}%`;
            const update = () => {
                const line = window.innerHeight * LINE;
                setActive(blocks.filter((block) => block.getBoundingClientRect().top <= line).length - 1);
            };
            ScrollTrigger.create({
                trigger: list,
                start: `top ${at}`,
                end: `bottom ${at}`,
                onUpdate: update,
                onRefresh: update,
                onLeave: update,
                onLeaveBack: () => setActive(-1),
            });
            const fill = list.querySelector("[data-day-fill]");
            if (fill)
                gsap.fromTo(
                    fill,
                    { scaleY: 0 },
                    { scaleY: 1, ease: "none", scrollTrigger: { trigger: list, start: `top ${at}`, end: `bottom ${at}`, scrub: 0.4 } },
                );
            update();
            return () => setActive(-1);
        });

        return () => media.revert();
    }, []);

    const current = active >= 0 ? ORDER[active] : null;

    /** One block of the day, as the file writes it. */
    const line = (block: DayBlock, nested = false) => {
        const Icon = ICONS[block.icon];
        const index = ORDER.indexOf(block);
        const lit = index === active;

        if (block.kind === "busy") {
            return (
                <div className="py-2.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[0.8rem]">
                        <Icon className={cn("size-3.5 shrink-0 transition-colors", lit ? "text-editor-fg" : "text-syn-comment")} aria-hidden />
                        <span className="text-syn-comment" aria-hidden>
                            {"//"}
                        </span>
                        <span className={cn("font-sans text-[0.95rem] font-medium transition-colors", lit ? "text-editor-fg" : "text-editor-muted")}>
                            {block.title}
                        </span>
                        <span className="font-sans text-xs text-syn-comment">· {block.time}</span>
                    </p>
                    <p className="mt-0.5 pl-6 text-sm italic text-syn-comment">{block.text}</p>
                </div>
            );
        }

        return (
            <div
                className={cn(
                    "relative my-1.5 rounded-sm border-l-2 border-syn-string bg-syn-string/[0.07] py-3 pl-4 pr-3 transition-[background-color,box-shadow] duration-300",
                    lit && "bg-syn-string/[0.14] shadow-[0_0_0_1px_color-mix(in_oklch,var(--syn-string)_35%,transparent)]",
                    nested && "my-1",
                )}
            >
                <span aria-hidden className="absolute -left-5 top-3 font-mono text-sm font-bold text-syn-string">
                    +
                </span>
                <div className="flex items-start gap-3">
                    <span
                        aria-hidden
                        className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-md border border-syn-string/30 bg-syn-string/10 text-syn-string transition-transform duration-300",
                            lit && "scale-110",
                        )}
                    >
                        <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="font-semibold text-editor-fg">{block.title}</span>
                            <span className="rounded-sm border border-syn-string/25 px-1.5 py-px text-[0.7rem] text-syn-string">{block.time}</span>
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-editor-muted">{block.text}</p>
                    </div>
                </div>
            </div>
        );
    };

    /** The gutter cell beside a line: its time, lit when it's the current one. */
    const gutter = (hour: number, lit = false) => (
        <span
            aria-hidden
            className={cn("pt-3 pr-3 text-right font-mono text-[0.72rem] tabular-nums transition-colors", lit ? "text-editor-fg" : "text-editor-gutter")}
        >
            {clock(hour)}
        </span>
    );

    return (
        <Section labelledBy="home-day-title">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
                <div className="lg:sticky lg:top-28 lg:self-start">
                    <SectionHeader id="home-day-title" eyebrow={DAY.eyebrow} title={DAY.title} description={DAY.description} className="mb-6 sm:mb-8" />

                    {/* The legend: what the two kinds of line mean. */}
                    <div className="rounded-card border border-border bg-card p-5 shadow-card">
                        <ul className="space-y-2.5 text-sm">
                            <li className="flex items-center gap-3">
                                <span aria-hidden className="grid size-6 place-items-center rounded-sm bg-syn-string/12 font-mono font-bold text-syn-string">
                                    +
                                </span>
                                <span className="font-medium">{DAY.tracks.learn}</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <span aria-hidden className="grid size-6 place-items-center rounded-sm bg-secondary font-mono text-xs text-syn-comment">
                                    {"//"}
                                </span>
                                <span className="text-muted-foreground">{DAY.tracks.busy}</span>
                            </li>
                        </ul>
                        <p className="mt-4 flex gap-2.5 border-t border-dashed border-border pt-4 text-sm leading-relaxed text-muted-foreground">
                            <Lightbulb className="mt-0.5 size-4 shrink-0 text-syn-number" aria-hidden />
                            {DAY.tip}
                        </p>
                    </div>
                </div>

                <EditorWindow
                    tabs={[{ name: "routine.ts", label: DAY.tab, active: true }]}
                    status={
                        <>
                            <span className="truncate">{DAY.status.replace("{n}", bn(LEARN_COUNT))}</span>
                            <span className="shrink-0">{current ? `${clock(current.from)} · ${current.title}` : `${clock(6)} → ${clock(24)}`}</span>
                        </>
                    }
                >
                    <ol ref={listRef} className="relative py-3 pr-4 sm:pr-5">
                        {/* The gutter's edge, filling violet as the day moves on. */}
                        <span aria-hidden className="absolute bottom-3 left-17 top-3 w-px bg-editor-line">
                            <span data-day-fill className="absolute inset-0 origin-top bg-violet-400" />
                        </span>

                        {ROWS.map(({ block, inner }) => {
                            const lit = ORDER.indexOf(block) === active;
                            return (
                                <Fragment key={block.icon}>
                                    <li
                                        data-day-block
                                        className={cn(
                                            "grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-6 transition-colors",
                                            lit && block.kind === "busy" && "bg-editor-raised/60",
                                        )}
                                    >
                                        {gutter(block.from, lit)}
                                        <div>
                                            {line(block)}
                                            {inner.length > 0 && (
                                                <span aria-hidden className="-mt-1 block pb-1 font-mono text-[0.8rem] text-editor-fg">
                                                    {"{"}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                    {inner.map((child) => (
                                        <li key={child.icon} data-day-block className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-6">
                                            {gutter(child.from, ORDER.indexOf(child) === active)}
                                            {/* Nested in its busy block's scope, with an indent guide. */}
                                            <div className="border-l border-dashed border-editor-line pl-6">{line(child, true)}</div>
                                        </li>
                                    ))}
                                    {inner.length > 0 && (
                                        <li aria-hidden className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-6">
                                            <span className="pr-3 text-right font-mono text-[0.72rem] tabular-nums text-editor-gutter">{clock(block.to)}</span>
                                            <span className="pb-2 font-mono text-[0.8rem] text-editor-fg">{"}"}</span>
                                        </li>
                                    )}
                                </Fragment>
                            );
                        })}
                    </ol>
                </EditorWindow>
            </div>
        </Section>
    );
}
