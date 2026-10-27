"use client";

import { gsap } from "gsap";
import { GraduationCap } from "lucide-react";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import type { CurrentUser } from "@/types/domain.types";

const ROLE_LABEL: Record<string, string> = {
    MENTOR: "Mentor",
    ADMIN: "Admin",
    SUPER_ADMIN: "Super admin",
    STUDENT: "Student",
};

/**
 * A barcode drawn from the account id: each hex digit sets a bar's width and
 * the gap after it, so every account's pass is its own and the same on every
 * visit. Decoration only — nothing scans it.
 */
function Barcode({ seed }: { seed: string }) {
    const digits = seed.replace(/[^0-9a-f]/gi, "").slice(0, 28).split("");
    return (
        <span aria-hidden className="flex h-9 items-stretch gap-px">
            {digits.map((digit, index) => {
                const value = parseInt(digit, 16);
                return (
                    <span
                        key={index}
                        className="bg-foreground/80"
                        style={{ width: 1 + (value % 3), marginRight: value % 2 }}
                    />
                );
            })}
        </span>
    );
}

/**
 * Who is signed in, as a staff pass hanging from a lanyard: the brand band
 * with the role, the photo, name and designation, the sign-in details, and an
 * id with its barcode. On arrival it drops in and swings on the lanyard until
 * it settles — unless reduced motion is asked for.
 */
export default function StaffPass({ user }: { user: CurrentUser }) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
            gsap.timeline()
                .from(root, { autoAlpha: 0, y: -40, duration: 0.45, ease: "power2.out" })
                .fromTo(
                    root,
                    { rotation: -9 },
                    { rotation: 0, duration: 2.2, ease: "elastic.out(1, 0.28)", clearProps: "transform" },
                    0.1,
                );
        });
        return () => media.revert();
    }, []);

    const designation = user.mentorProfile?.designation;
    const role = ROLE_LABEL[user.role] ?? user.role;
    const shortId = user.id.replace(/-/g, "").slice(-8).toUpperCase();

    const details = [
        { label: "Email", value: user.email },
        { label: "Mobile", value: user.phone },
        { label: "Member since", value: formatDate(user.learnerSince ?? user.createdAt) },
    ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value));

    return (
        <div ref={rootRef} className="mx-auto w-full max-w-80 origin-top">
            {/* The lanyard and its clip. */}
            <div aria-hidden className="flex flex-col items-center">
                <span className="h-8 w-5 bg-brand opacity-90 [clip-path:polygon(0_0,100%_0,85%_100%,15%_100%)]" />
                <span className="relative z-10 -mb-2 h-4 w-8 rounded-md border border-slate-400/70 bg-linear-to-b from-slate-100 to-slate-400 shadow-sm dark:border-slate-500 dark:from-slate-400 dark:to-slate-700" />
            </div>

            <article className="relative overflow-hidden rounded-panel border border-border bg-card shadow-panel">
                <div className="relative h-28 overflow-hidden bg-brand px-5 pt-7 text-white">
                    {/* The slot the clip passes through. */}
                    <span
                        aria-hidden
                        className="absolute left-1/2 top-3 h-2 w-12 -translate-x-1/2 rounded-full bg-background/90 shadow-[inset_0_1px_2px_oklch(0_0_0/0.35)]"
                    />
                    <span
                        aria-hidden
                        className="absolute -right-10 -top-16 size-44 rounded-full bg-white/10"
                    />
                    <div className="relative flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 font-bold">
                            <span className="grid size-7 place-items-center rounded-lg bg-white/20">
                                <GraduationCap className="size-4" aria-hidden />
                            </span>
                            Half Coders
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85">{role}</span>
                    </div>
                </div>

                <div className="-mt-12 flex flex-col items-center px-6 text-center">
                    <Avatar
                        src={user.image}
                        name={user.name}
                        size={96}
                        className="relative shadow-lg ring-4 ring-card"
                    />
                    <h1 className="mt-3 text-xl font-bold leading-tight tracking-tight">{user.name}</h1>
                    <p className="mt-1 text-sm font-medium text-primary">{designation ?? `Half Coders ${role.toLowerCase()}`}</p>
                </div>

                <dl className="mx-6 mt-5 space-y-2.5 border-t border-dashed border-border pt-5 text-sm">
                    {details.map((detail) => (
                        <div key={detail.label} className="flex items-baseline justify-between gap-4">
                            <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{detail.label}</dt>
                            <dd className="min-w-0 truncate text-right font-medium" title={detail.value}>
                                {detail.value}
                            </dd>
                        </div>
                    ))}
                </dl>

                <div className="mx-6 mb-6 mt-5 flex items-end justify-between gap-4 rounded-md bg-secondary/60 px-4 py-3">
                    <span>
                        <span className="block text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">Pass ID</span>
                        <span className="font-mono text-sm font-semibold tracking-wider">{shortId}</span>
                    </span>
                    <Barcode seed={user.id} />
                </div>
            </article>
        </div>
    );
}
