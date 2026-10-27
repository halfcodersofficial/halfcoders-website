"use client";

import { Code2 } from "lucide-react";
import { useId, useRef, type CSSProperties } from "react";
import CtaButton from "@/components/site/CtaButton";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { CLOSING } from "./content";
import { DocHeading } from "./paper";

/** The letter slides onto the table, its lines appear one by one, the team signs it and the stamp comes down. */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root.querySelectorAll("[data-letter]"), { autoAlpha: 0, y: 60, rotation: -5, duration: 0.8, ...SETTLE })
        .from(root.querySelectorAll("[data-letter-line]"), { autoAlpha: 0, y: 10, duration: 0.45, stagger: 0.14, ...SETTLE }, 0.4)
        .from(root.querySelectorAll("[data-letter-signature]"), {
            strokeDashoffset: 1,
            duration: 1.4,
            ease: "power2.inOut",
            clearProps: "strokeDashoffset",
        })
        .from(
            root.querySelectorAll("[data-letter-stamp]"),
            { autoAlpha: 0, scale: 1.8, rotation: -40, duration: 0.5, ease: "back.out(2)", ...SETTLE },
            "-=0.5",
        );
};

/* Every line of the letter sits on the paper's ruling: a 2rem line, set inline because Bangla text otherwise gets its own taller line. */
const ON_THE_LINES: CSSProperties = { lineHeight: "2rem" };

/**
 * The close, as a letter from the team on ruled paper: a greeting, a few
 * honest lines about how starting feels, the sign-off with a signature that
 * writes itself, a postscript, and a stamp in the corner. As it scrolls into
 * view the letter slides onto the table and its lines appear one by one.
 * Under it, the two ways in.
 */
export default function AboutClosing() {
    const rootRef = useRef<HTMLDivElement>(null);
    const stampPath = useId();
    useScrollEntrance(rootRef, buildEntrance);

    return (
        <section aria-labelledby="about-closing-title" className="relative overflow-hidden py-16 sm:py-24">
            <div
                aria-hidden
                className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_30%,transparent_80%)]"
            />

            <div ref={rootRef} className="container-page relative">
                <DocHeading id="about-closing-title" title={CLOSING.title} align="center" className="mb-12 sm:mb-14" />

                <div className="mx-auto max-w-3xl">
                    <article
                        data-letter
                        className="relative -rotate-1 bg-[#fffdf8] px-6 pb-10 pt-10 shadow-[0_34px_70px_-34px_rgb(21_17_42/0.5)] ring-1 ring-black/5 transition-[rotate] duration-500 ease-out hover:rotate-0 motion-reduce:hover:-rotate-1 sm:px-14 sm:pb-14 sm:pt-14"
                    >
                        {/* The margin rule, as on writing paper. */}
                        <span aria-hidden className="absolute inset-y-0 left-9 hidden w-px bg-rose-300/70 sm:block" />

                        {/* The stamp. */}
                        <div
                            data-letter-stamp
                            aria-hidden
                            className="absolute right-4 top-4 grid size-20 rotate-12 place-items-center sm:right-8 sm:top-8 sm:size-24"
                        >
                            <svg
                                viewBox="0 0 100 100"
                                className="absolute inset-0 animate-[spin_30s_linear_infinite] text-primary motion-reduce:animate-none"
                            >
                                <defs>
                                    <path id={stampPath} d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
                                </defs>
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="47"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeOpacity={0.45}
                                    strokeWidth={1.5}
                                    strokeDasharray="3 3"
                                />
                                <text className="fill-current text-[8px] font-semibold">
                                    <textPath href={`#${stampPath}`} textLength={222} lengthAdjust="spacing">
                                        {CLOSING.stamp}
                                    </textPath>
                                </text>
                            </svg>
                            <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary sm:size-10">
                                <Code2 className="size-5" />
                            </span>
                        </div>

                        <div className="bg-ruled relative font-heading text-foreground/90 sm:pl-4">
                            <p data-letter-line className="pr-20 text-xl font-semibold text-primary sm:pr-24" style={ON_THE_LINES}>
                                {CLOSING.greeting}
                            </p>
                            {CLOSING.paragraphs.map((paragraph) => (
                                <p key={paragraph.slice(0, 24)} data-letter-line className="mt-8 text-lg" style={ON_THE_LINES}>
                                    {paragraph}
                                </p>
                            ))}
                            <p data-letter-line className="mt-8 text-lg" style={ON_THE_LINES}>
                                {CLOSING.signoff}
                            </p>
                            <svg aria-hidden viewBox="0 0 160 40" className="h-16 w-44 text-primary" fill="none">
                                <path
                                    data-letter-signature
                                    pathLength={1}
                                    strokeDasharray={1}
                                    d="M6 30 C 14 6, 26 6, 24 28 S 32 38, 42 18 C 48 8, 56 10, 54 26 S 64 34, 74 16 C 80 6, 90 10, 86 24 S 100 32, 112 18 C 120 10, 132 14, 138 22 S 150 26, 156 14"
                                    stroke="currentColor"
                                    strokeWidth={2.2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <p data-letter-line className="text-lg font-semibold" style={ON_THE_LINES}>
                                {CLOSING.team}
                            </p>
                            <p data-letter-line className="mt-8 text-base text-muted-foreground" style={ON_THE_LINES}>
                                {CLOSING.postscript}
                            </p>
                        </div>
                    </article>

                    <div className="mt-12 flex flex-wrap justify-center gap-3">
                        <CtaButton kind="enroll" size="lg" />
                        <CtaButton kind="courses" size="lg" />
                    </div>
                </div>
            </div>
        </section>
    );
}
