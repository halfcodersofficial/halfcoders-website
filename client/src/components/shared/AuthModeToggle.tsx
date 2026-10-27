"use client";

import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The Sign In / Sign Up switch above the credential forms.
 *
 * Two links styled as a segmented control, not two tabs on one page: each
 * screen keeps its own URL, so the browser's back button, a bookmark and the
 * `?next=` the interceptor attaches all keep working. The return path is
 * carried across so someone who lands on sign-in and realises they need an
 * account still ends up where they were going.
 *
 * The thumb — a focused editor tab, violet line across its top — is one
 * element that slides, rather than a background that jumps from one half to
 * the other: the layout keeps this component mounted across the navigation,
 * so the transition actually plays.
 */
export default function AuthModeToggle({ active }: { active: "login" | "register" }) {
    const searchParams = useSearchParams();
    const next = searchParams.get("next");
    const query = next ? `?next=${encodeURIComponent(next)}` : "";

    const items = [
        { key: "login", href: `/login${query}`, label: "Sign In", icon: LogIn },
        { key: "register", href: `/register${query}`, label: "Sign Up", icon: UserPlus },
    ] as const;

    return (
        <div className="relative grid grid-cols-2 rounded-md border border-border bg-surface p-1">
            <span
                aria-hidden
                className={cn(
                    "absolute left-1 top-1 h-[calc(100%-0.5rem)] w-[calc(50%-0.25rem)] overflow-hidden rounded-sm border border-border bg-card shadow-sm",
                    "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary",
                    "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    active === "register" && "translate-x-full",
                )}
            />
            {items.map(({ key, href, label, icon: Icon }) => {
                const isActive = key === active;
                return (
                    <Link
                        key={key}
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "relative z-10 flex items-center justify-center gap-2 rounded-sm py-2.5 text-sm font-semibold transition-colors duration-300",
                            isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <Icon aria-hidden className={cn("size-4 transition-colors duration-300", isActive && "text-primary")} />
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}
