"use client";

import { Check, Circle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import EditorWindow from "@/components/site/EditorWindow";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { resolveLandingPath } from "@/lib/access";
import type { SignedInVia } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** How long the screen holds before opening the page: long enough to read, short enough not to wait on. */
const HOLD_MS = 1600;

/** When each line in the window types in. */
const LINE_DELAYS = ["0s", "0.45s", "0.9s"];

const COPY: Record<SignedInVia, { heading: (name: string) => string; first: string }> = {
    signin: { heading: (name) => `Welcome back, ${name}!`, first: "Password checked" },
    signup: { heading: (name) => `Welcome to Half Coders, ${name}!`, first: "Email verified — your account is ready" },
    reset: { heading: (name) => `You're signed in, ${name}`, first: "New password saved" },
};

/** Where they're headed, in plain words, for "Taking you to …". */
const placeFor = (path: string): string => {
    const pathname = path.split(/[?#]/)[0];
    switch (pathname.split("/")[1]) {
        case "admin":
            return "the admin console";
        case "mentor":
            return "the mentor console";
        case "dashboard":
            return "your dashboard";
        case "learn":
            return "your course";
        case "checkout":
            return "checkout";
        case "courses":
            return pathname === "/courses" ? "the courses" : "the course";
        case "bundles":
            return "the bundle";
        case "settings":
            return "your settings";
        case "orders":
            return "your orders";
        case "":
            return "the home page";
        default:
            return "where you were going";
    }
};

/**
 * The hand-off between signing in and the page they were after: a greeting,
 * and a terminal printing what just happened while a bar runs along its foot.
 * Then the page opens, replacing this one, so Back skips over it.
 *
 * `?to=` is re-checked against the account's role, by the same rule as
 * `?next=` — the address bar can say anything. Opened without a session (a
 * bookmark, an expired cookie), it sends them to sign in and on to the same
 * place.
 */
export default function RedirectingScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading } = useSession();

    const to = searchParams.get("to");
    const via: SignedInVia = searchParams.get("via") === "signup" ? "signup" : searchParams.get("via") === "reset" ? "reset" : "signin";
    const target = user ? resolveLandingPath(to, user.role) : null;

    useEffect(() => {
        if (isLoading || user) return;
        router.replace(to ? `/login?next=${encodeURIComponent(to)}` : "/login");
    }, [isLoading, user, to, router]);

    useEffect(() => {
        if (!target) return;
        // Fetched while the greeting shows, so it opens at once when the bar fills.
        router.prefetch(target);
        const timer = setTimeout(() => {
            router.replace(target);
            router.refresh();
        }, HOLD_MS);
        return () => clearTimeout(timer);
    }, [target, router]);

    if (!user || !target) return <Skeleton className="h-80" />;

    const copy = COPY[via];
    const place = placeFor(target);
    const lines = [copy.first, `Signed in as ${user.email}`, `Opening ${place}`];

    return (
        <div className="space-y-6">
            <header className="text-center">
                <span className="mx-auto mb-4 grid size-12 place-items-center rounded-md border border-success/30 bg-success/5 text-success">
                    <Check className="size-6" strokeWidth={2.5} />
                </span>
                {/* The whole name: a first word is often "Md." here, which is no one's name. */}
                <h1 className="text-balance text-3xl font-bold tracking-tight">{copy.heading(user.name)}</h1>
                <p role="status" className="mt-2 text-sm text-muted-foreground">
                    Taking you to {place} — just a moment.
                </p>
            </header>

            <EditorWindow
                tabs={[{ name: "signin.sh", label: "Signing you in", active: true }]}
                status={
                    <>
                        <span>Half Coders</span>
                        <span className="inline-flex items-center gap-1.5">
                            <Circle className="size-2 fill-green-300 text-green-300" /> Signed in
                        </span>
                    </>
                }
            >
                <ol className="space-y-1 px-4 py-4 font-mono text-[0.8rem] leading-6">
                    {lines.map((line, index) => {
                        const last = index === lines.length - 1;
                        return (
                            <li
                                key={line}
                                className={cn(
                                    "flex w-max max-w-full animate-type-in items-center gap-2 motion-reduce:animate-none",
                                    last ? "text-editor-fg" : "text-editor-muted",
                                )}
                                style={{ animationDelay: LINE_DELAYS[index] }}
                            >
                                {last ? (
                                    <span aria-hidden className="w-3.5 shrink-0 text-center text-syn-keyword">
                                        ›
                                    </span>
                                ) : (
                                    <Check aria-hidden className="size-3.5 shrink-0 text-syn-string" strokeWidth={3} />
                                )}
                                <span className={cn("truncate", last && "caret")}>{line}</span>
                            </li>
                        );
                    })}
                </ol>
                <div aria-hidden className="h-1 bg-editor-line">
                    <div className="h-full origin-left bg-violet-400" style={{ animation: `fill-x ${HOLD_MS}ms linear both` }} />
                </div>
            </EditorWindow>

            <p className="text-center text-sm text-muted-foreground">
                Not moving?{" "}
                <Link href={target} replace className="font-semibold text-primary hover:underline">
                    Go now
                </Link>
            </p>
        </div>
    );
}
