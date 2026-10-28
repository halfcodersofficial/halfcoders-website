"use client";

import { Compass, GraduationCap, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Section from "@/components/site/Section";
import { SafeImage } from "@/components/ui/safe-image";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { TEAM, type TeamMember } from "./content";
import { DocHeading } from "./paper";

const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline.from(root.querySelectorAll("[data-member]"), { autoAlpha: 0, y: 44, scale: 0.95, duration: 0.6, stagger: 0.09, ...SETTLE });
};

/** A syntax colour each, so no two cards look alike; they re-point for the dark theme on their own. */
const TONES = ["keyword", "func", "string", "number", "tag"] as const;

/** The activity strip at a card's foot: columns × rows of squares. */
const COLUMNS = 18;
const ROWS = 5;

/** "Tariq M Nasim" → "TN": the first and last names' initials. */
const monogram = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
};

/**
 * A strip of squares, 0 (empty) to 4 (busiest), the same for a name on every
 * render — the server's and the browser's first paint have to agree.
 */
const activityFor = (name: string): number[] => {
    let seed = 0;
    for (const char of name) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
    return Array.from({ length: COLUMNS * ROWS }, () => {
        // mulberry32: small, and plenty for a pattern.
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        return r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.78 ? 2 : r < 0.92 ? 3 : 4;
    });
};

/** How strongly each busy level shows, at rest (grey) and lit (the card's colour). */
const LEVEL_OPACITY = [1, 0.35, 0.55, 0.8, 1];

/**
 * The people who run Half Coders, each as a card dressed like an editor pane:
 * a tab with their title's short form, a round portrait on graph paper (their photo, or
 * their initials in the card's own colour), the name, the full title — never
 * cut short — and a Mentor badge for those who also teach (Advisor for those
 * who advise). A strip of
 * squares at the foot stands in for a contribution graph; it's decoration,
 * not a record of anything.
 *
 * Pointed at with a mouse, a card tilts toward the pointer with a light in its
 * colour following it, the ring round the portrait turns, and the strip
 * lights up left to right. They rise in one after another as the band
 * scrolls into view; with reduced motion asked for, nothing tilts or turns.
 */
export default function AboutTeam() {
    const rootRef = useRef<HTMLUListElement>(null);
    const [still, setStill] = useState(true);
    useScrollEntrance(rootRef, buildEntrance);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setStill(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    return (
        <Section id="team" labelledBy="about-team-title" className="overflow-hidden bg-linear-to-b from-primary/6 to-transparent to-40%">
            <DocHeading id="about-team-title" title={TEAM.title} lead={TEAM.description} align="center" />
            <ul ref={rootRef} className="flex flex-wrap justify-center gap-5">
                {TEAM.members.map((member, index) => (
                    <Member key={member.name} member={member} tone={TONES[index % TONES.length]} still={still} />
                ))}
            </ul>
        </Section>
    );
}

function Member({ member, tone, still }: { member: TeamMember; tone: (typeof TONES)[number]; still: boolean }) {
    const tilt = (event: PointerEvent<HTMLElement>) => {
        if (still || event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        event.currentTarget.style.setProperty("--rx", `${(0.5 - y) * 9}deg`);
        event.currentTarget.style.setProperty("--ry", `${(x - 0.5) * 11}deg`);
        event.currentTarget.style.setProperty("--gx", `${x * 100}%`);
        event.currentTarget.style.setProperty("--gy", `${y * 100}%`);
    };

    const settle = (event: PointerEvent<HTMLElement>) => {
        event.currentTarget.style.setProperty("--rx", "0deg");
        event.currentTarget.style.setProperty("--ry", "0deg");
    };

    return (
        // The entrance moves the <li>; the tilt is on the card inside, so the two never fight over `transform`.
        <li data-member className="flex w-full max-w-sm sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.84rem)] xl:w-[calc(20%-1rem)]">
            <article
                onPointerMove={tilt}
                onPointerLeave={settle}
                className="group relative flex w-full flex-col overflow-hidden rounded-panel border border-border bg-card shadow-card hover:border-(--tone-edge) hover:shadow-[0_32px_60px_-30px_var(--tone)]"
                style={
                    {
                        "--tone": `var(--syn-${tone})`,
                        "--tone-edge": "color-mix(in oklch, var(--tone) 55%, transparent)",
                        "--tone-line": "color-mix(in oklch, var(--tone) 35%, transparent)",
                        "--tone-wash": "color-mix(in oklch, var(--tone) 10%, transparent)",
                        transform: "perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
                        transition: "transform 0.25s ease-out, border-color 0.3s, box-shadow 0.3s",
                    } as CSSProperties
                }
            >
                {/* The light, following the pointer. */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                        background:
                            "radial-gradient(380px circle at var(--gx, 50%) var(--gy, 0%), color-mix(in oklch, var(--tone) 16%, transparent), transparent 65%)",
                    }}
                />

                {/* An editor's tab strip, the title's short form open in it. */}
                <div className="relative flex items-stretch border-b border-border bg-surface">
                    <span
                        lang="en"
                        data-active
                        className="editor-tab flex items-center gap-2 border-r border-border bg-card px-3.5 py-2 font-mono text-xs font-semibold text-(--tone) before:bg-(--tone)"
                    >
                        <span aria-hidden className="size-1.5 rounded-full bg-(--tone)" />
                        {member.short}
                    </span>
                </div>

                <div className="relative flex flex-1 flex-col items-center px-5 pb-5 pt-7 text-center">
                    {/* The site's graph paper behind the portrait, in the card's colour. */}
                    <div
                        aria-hidden
                        className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 h-44 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                        style={{ "--grid-line": "color-mix(in oklch, var(--tone) 16%, transparent)" } as CSSProperties}
                    />
                    <Portrait member={member} />

                    <h3 lang="en" className="mt-5 text-lg font-bold tracking-tight">
                        {member.name}
                    </h3>
                    <p lang="en" className="mt-1 text-sm leading-snug text-balance text-muted-foreground">
                        {member.role}
                    </p>

                    {/* Kept in place when empty, so every card's name sits at the same height. */}
                    <div className="mt-3 flex min-h-6 flex-wrap justify-center gap-1.5">
                        {member.mentor && <RoleBadge icon={GraduationCap} label="Mentor" />}
                        {member.advisor && <RoleBadge icon={Compass} label="Advisor" />}
                    </div>
                </div>

                <Activity name={member.name} />
            </article>
        </li>
    );
}

/** A pill under the title in the card's colour: Mentor, Advisor. */
function RoleBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
    return (
        <span
            lang="en"
            className="inline-flex items-center gap-1 rounded-full border border-(--tone-line) bg-(--tone-wash) px-2.5 py-0.5 text-xs font-medium text-(--tone)"
        >
            <Icon className="size-3.5" aria-hidden />
            {label}
        </span>
    );
}

/** The photo, or the initials in the card's colour, inside a ring that turns while the card is pointed at. */
function Portrait({ member }: { member: TeamMember }) {
    const initials = (
        <span
            className="grid size-full place-items-center font-heading text-3xl font-bold text-(--tone)"
            style={{
                background:
                    "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--tone) 24%, var(--card)), color-mix(in oklch, var(--tone) 8%, var(--card)))",
            }}
        >
            {monogram(member.name)}
        </span>
    );

    return (
        <div className="relative size-28 shrink-0">
            <span
                aria-hidden
                className="absolute -inset-1 rounded-full opacity-35 transition-opacity duration-500 group-hover:animate-[spin_5s_linear_infinite] group-hover:opacity-100 motion-reduce:animate-none"
                style={{ background: "conic-gradient(from 0deg, var(--tone), transparent 30%, var(--tone) 55%, transparent 80%, var(--tone))" }}
            />
            <div className="relative size-full overflow-hidden rounded-full border-4 border-card">
                {member.photo ? (
                    <SafeImage src={member.photo} alt={member.name} fill sizes="112px" className="object-cover object-top" fallback={initials} />
                ) : (
                    <span role="img" aria-label={member.name} className="block size-full">
                        {initials}
                    </span>
                )}
            </div>
        </div>
    );
}

/** The decorative strip of squares: grey at rest, lit in the card's colour column by column. */
function Activity({ name }: { name: string }) {
    const levels = activityFor(name);

    return (
        <div
            aria-hidden
            className="relative grid grid-flow-col gap-0.75 border-t border-border bg-surface/60 px-5 py-4"
            style={{ gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`, gridAutoColumns: "minmax(0, 1fr)" }}
        >
            {levels.map((level, index) => (
                <span
                    key={index}
                    className={
                        level === 0
                            ? "aspect-square rounded-[2px] bg-border"
                            : "aspect-square rounded-[2px] bg-border-strong transition-colors duration-300 group-hover:bg-(--tone)"
                    }
                    style={{ opacity: LEVEL_OPACITY[level], transitionDelay: `${Math.floor(index / ROWS) * 22}ms` }}
                />
            ))}
        </div>
    );
}
