"use client";

import { useRef } from "react";
import Section from "@/components/site/Section";
import { useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { PRINCIPLES } from "./content";
import { DocHeading } from "./paper";

/* Each note's paper and how it sits on the board: a pastel each, turned a little this way or that. */
const NOTES = [
    { paper: "bg-amber-100 text-amber-950", ink: "text-amber-700", turn: "-rotate-2" },
    { paper: "bg-sky-100 text-sky-950", ink: "text-sky-700", turn: "rotate-1" },
    { paper: "bg-lime-100 text-lime-950", ink: "text-lime-700", turn: "-rotate-1" },
    { paper: "bg-violet-100 text-violet-950", ink: "text-violet-700", turn: "rotate-2" },
    { paper: "bg-rose-100 text-rose-950", ink: "text-rose-700", turn: "-rotate-[1.5deg]" },
    { paper: "bg-teal-100 text-teal-950", ink: "text-teal-700", turn: "rotate-[1.5deg]" },
];

/** The notes drop onto the board one after another, landing with a little turn. */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline.from(root.querySelectorAll("[data-note]"), {
        autoAlpha: 0,
        y: -36,
        rotation: (index: number) => (index % 2 ? 9 : -9),
        duration: 0.6,
        ease: "back.out(1.6)",
        stagger: 0.09,
        clearProps: "opacity,visibility,transform",
    });
};

/**
 * The six things that are the same in every course, as sticky notes on a
 * board: a pastel each, taped at the top, turned a little this way or that,
 * with its number written large. They drop onto the board one after another;
 * pointed at, a note straightens, lifts and comes forward.
 */
export default function AboutPrinciples() {
    const rootRef = useRef<HTMLOListElement>(null);
    useScrollEntrance(rootRef, buildEntrance);

    return (
        <Section labelledBy="about-principles-title">
            <DocHeading id="about-principles-title" title={PRINCIPLES.heading} lead={PRINCIPLES.description} />
            <ol ref={rootRef} className="grid grid-cols-1 gap-x-6 gap-y-10 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                {PRINCIPLES.items.map((item, index) => {
                    const note = NOTES[index % NOTES.length];
                    return (
                        <li key={item.title} data-note>
                            <div
                                className={cn(
                                    "relative h-full px-6 pb-7 pt-8 shadow-[0_16px_30px_-18px_rgb(21_17_42/0.45)] transition-[rotate,translate,scale,box-shadow] duration-300 ease-out hover:z-10 hover:-translate-y-2 hover:rotate-0 hover:scale-[1.03] hover:shadow-[0_28px_44px_-22px_rgb(21_17_42/0.5)] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100",
                                    note.paper,
                                    note.turn,
                                )}
                            >
                                {/* The tape holding it up. */}
                                <span
                                    aria-hidden
                                    className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 bg-white/60 shadow-sm ring-1 ring-black/5"
                                />
                                <span aria-hidden className={cn("block font-heading text-4xl font-bold leading-none opacity-70", note.ink)}>
                                    {(index + 1).toLocaleString("bn-BD", { minimumIntegerDigits: 2 })}
                                </span>
                                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                                <p className="mt-2 leading-relaxed opacity-80">{item.text}</p>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </Section>
    );
}
