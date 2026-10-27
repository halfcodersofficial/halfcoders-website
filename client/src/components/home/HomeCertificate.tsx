"use client";

import { Award, BadgeCheck, BriefcaseBusiness, FileDown, Fingerprint, Loader2, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { Button } from "@/components/ui/button";
import { SETTLE, useScrollEntrance, type EntranceBuilder } from "@/hooks/useScrollEntrance";
import { cn } from "@/lib/utils";
import { CERTIFICATE } from "./content";

/* One icon per point, in the order of CERTIFICATE.points: the ID, the PDF, the CV. */
const POINT_ICONS: LucideIcon[] = [Fingerprint, FileDown, BriefcaseBusiness];

/** The check's phases, and how long each holds: the ID being typed in, the lookup, the answer. */
const PHASES = [1700, 900, 3600] as const;
const TYPING = 0;
const CHECKING = 1;
const VALID = 2;

/** The points slide in, the certificate settles onto its stack, the signature writes itself and the seal stamps down. */
const buildEntrance: EntranceBuilder = (root, timeline) => {
    timeline
        .from(root.querySelectorAll("[data-cert-point]"), { autoAlpha: 0, x: -14, duration: 0.45, stagger: 0.1, ...SETTLE })
        .from(root.querySelectorAll("[data-cert-paper]"), { autoAlpha: 0, y: 40, rotate: 3, duration: 0.8, ...SETTLE }, 0)
        .from(root.querySelectorAll("[data-cert-signature]"), { strokeDashoffset: 1, duration: 1.3, ease: "power2.inOut", clearProps: "strokeDashoffset" }, 0.55)
        .from(root.querySelectorAll("[data-cert-seal]"), { scale: 0, rotate: -120, duration: 0.7, ease: "back.out(1.8)", ...SETTLE }, 0.95);
};

/**
 * The certificate: what makes it worth having (its own ID and page, the PDF,
 * a place on a CV) beside a sample — drawn in English like the real ones —
 * on a little stack of paper. Pointed at with a mouse, the sample tilts
 * toward the pointer with light following it; a sheen passes over it now and
 * then, the mentor's signature writes itself in and the seal turns slowly.
 * Under it, the check anyone can run, acted out: the ID typed in, looked up,
 * coming back valid. With reduced motion asked for it all simply stays put.
 */
export default function HomeCertificate() {
    const { sample, check } = CERTIFICATE;
    const rootRef = useRef<HTMLDivElement>(null);
    const sealPath = useId();
    const [still, setStill] = useState(true);
    const [phase, setPhase] = useState<number>(VALID);
    const [cycle, setCycle] = useState(0);
    useScrollEntrance(rootRef, buildEntrance);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => {
            setStill(media.matches);
            setPhase(media.matches ? VALID : TYPING);
        };
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        if (still) return;
        const timer = window.setTimeout(() => {
            const next = (phase + 1) % PHASES.length;
            setPhase(next);
            if (next === TYPING) setCycle((current) => current + 1);
        }, PHASES[phase]);
        return () => window.clearTimeout(timer);
    }, [phase, still]);

    const tilt = (event: PointerEvent<HTMLDivElement>) => {
        if (still || event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        event.currentTarget.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
        event.currentTarget.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
        event.currentTarget.style.setProperty("--gx", `${x * 100}%`);
        event.currentTarget.style.setProperty("--gy", `${y * 100}%`);
    };

    const settle = (event: PointerEvent<HTMLDivElement>) => {
        event.currentTarget.style.setProperty("--rx", "0deg");
        event.currentTarget.style.setProperty("--ry", "0deg");
    };

    return (
        <Section tone="surface" labelledBy="home-certificate-title">
            <div ref={rootRef} className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
                <div>
                    <SectionHeader id="home-certificate-title" eyebrow={CERTIFICATE.eyebrow} title={CERTIFICATE.title} description={CERTIFICATE.description} className="mb-7 sm:mb-7" />
                    <ul className="space-y-3">
                        {CERTIFICATE.points.map((point, index) => {
                            const Icon = POINT_ICONS[index] ?? BadgeCheck;
                            return (
                                <li key={point} data-cert-point className="flex items-center gap-3.5">
                                    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-success/25 bg-success/10 text-success">
                                        <Icon className="size-4.5" aria-hidden />
                                    </span>
                                    {point}
                                </li>
                            );
                        })}
                    </ul>
                    <Button asChild variant="outline" size="lg" className="mt-8">
                        <Link href="/certificate" lang="en">
                            <Search aria-hidden /> {CERTIFICATE.cta}
                        </Link>
                    </Button>
                </div>

                {/* The sample, decoration. */}
                <div aria-hidden className="relative">
                    <div data-cert-paper className="relative mx-auto max-w-lg">
                        {/* Two more sheets under it, a little askew, so it reads as paper. */}
                        {/* (Less askew on phones, where they would reach past the page's edge.) */}
                        <div className="absolute inset-0 translate-x-1 translate-y-3 rotate-2 rounded-panel border border-border bg-card/80 sm:translate-x-3 sm:rotate-3" />
                        <div className="absolute inset-0 -translate-x-1 translate-y-2 -rotate-1 rounded-panel border border-border bg-card/90 sm:-translate-x-2 sm:-rotate-2" />

                        <div
                            onPointerMove={tilt}
                            onPointerLeave={settle}
                            className="group relative rounded-panel border border-border bg-card p-2.5 shadow-panel"
                            style={{ transform: "perspective(1100px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))", transition: "transform 0.25s ease-out" }}
                        >
                            <span className="absolute -right-2 -top-3 z-20 rounded-sm bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">{sample.badge}</span>
                            <div
                                lang="en"
                                className="relative overflow-hidden rounded-md border-2 border-primary/25 px-6 pb-6 pt-8 text-center sm:px-10"
                                style={{ background: "linear-gradient(135deg, #fff 0%, var(--violet-50) 60%, var(--lilac-50) 100%)" }}
                            >
                                <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
                                {/* A second, finer frame, with corner marks. */}
                                <div className="pointer-events-none absolute inset-2 rounded-sm border border-primary/15" />
                                {(["left-2 top-2 border-l-2 border-t-2", "right-2 top-2 border-r-2 border-t-2", "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-b-2 border-r-2"] as const).map(
                                    (corner) => (
                                        <span key={corner} className={cn("pointer-events-none absolute size-4 border-primary/50", corner)} />
                                    ),
                                )}
                                {/* Light catching the paper now and then, and following the pointer. */}
                                <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/80 to-transparent animate-[sheen_6s_ease-in-out_infinite] motion-reduce:hidden" />
                                <span
                                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                    style={{ background: "radial-gradient(22rem circle at var(--gx, 50%) var(--gy, 50%), color-mix(in oklch, var(--violet-400) 16%, transparent), transparent 60%)" }}
                                />

                                <div className="relative">
                                    <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                                        <Award className="size-8 text-primary" />
                                    </span>
                                    <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Certificate of Completion</p>
                                    <p className="mt-4 text-sm text-muted-foreground">This certifies that</p>
                                    <p className="mt-1 bg-brand bg-clip-text font-heading text-3xl font-bold text-transparent sm:text-4xl">{sample.name}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">has completed</p>
                                    <p className="mt-1 font-semibold text-primary">{sample.course}</p>

                                    <div className="mt-7 grid grid-cols-2 items-end gap-3 text-xs sm:grid-cols-[1fr_auto_1fr]">
                                        <div className="text-left">
                                            <svg viewBox="0 0 120 40" className="h-9 w-28 text-primary/80" fill="none">
                                                <path
                                                    data-cert-signature
                                                    pathLength={1}
                                                    strokeDasharray={1}
                                                    d="M4 30 C 12 8, 22 6, 20 26 S 28 36, 36 18 S 48 6, 50 24 S 58 32, 66 16 C 70 10, 76 12, 74 22 S 84 30, 92 18 S 108 14, 116 20"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                            <span className="mt-1 block border-t border-border pt-1 text-muted-foreground">{sample.signedBy}</span>
                                        </div>

                                        {/* The seal, turning slowly. */}
                                        <div data-cert-seal className="relative hidden size-20 place-items-center sm:grid">
                                            <svg viewBox="0 0 100 100" className="absolute inset-0 animate-[spin_24s_linear_infinite] text-primary motion-reduce:animate-none">
                                                <defs>
                                                    <path id={sealPath} d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
                                                </defs>
                                                <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 3" />
                                                <text className="fill-current text-[7.5px] font-semibold">
                                                    <textPath href={`#${sealPath}`} textLength={230} lengthAdjust="spacing">
                                                        {sample.seal}
                                                    </textPath>
                                                </text>
                                            </svg>
                                            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)]">
                                                <BadgeCheck className="size-5" />
                                            </span>
                                        </div>

                                        <div className="text-right">
                                            <span className="block text-muted-foreground">Certificate ID</span>
                                            <span className="whitespace-nowrap font-mono text-[0.65rem] font-semibold sm:text-xs">{sample.id}</span>
                                            <span className="mt-1.5 block text-muted-foreground">Completed</span>
                                            <span className="font-semibold">{sample.date}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* The check, acted out: the ID typed in, looked up, coming back valid. */}
                    <div
                        className={cn(
                            "relative z-10 mx-auto -mt-4 w-[96%] max-w-md overflow-hidden rounded-md border bg-card shadow-card transition-[border-color,box-shadow] duration-300 sm:w-[90%]",
                            phase === VALID ? "border-success/50 shadow-[0_10px_28px_-14px_var(--success)]" : "border-border",
                        )}
                    >
                        <p className="border-b border-border bg-surface px-4 py-1.5 text-[0.68rem] font-semibold text-muted-foreground">{check.label}</p>
                        <div className="flex items-center gap-2.5 px-3.5 py-3 sm:gap-3 sm:px-4">
                            <Search className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate font-mono text-[0.68rem] sm:text-xs">
                                <span
                                    key={cycle}
                                    className="inline-block"
                                    style={phase === TYPING ? { animation: `type-id ${PHASES[TYPING] - 300}ms steps(18, end) both` } : undefined}
                                >
                                    {sample.id}
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center text-xs font-semibold">
                                {phase === CHECKING && (
                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                        <Loader2 className="size-3.5 animate-spin" /> {check.checking}
                                    </span>
                                )}
                                {phase === VALID && (
                                    <span className="flex items-center gap-1.5 text-success-ink animate-in fade-in zoom-in-90 duration-300 motion-reduce:animate-none">
                                        <BadgeCheck className="size-4" /> {check.valid}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Section>
    );
}
