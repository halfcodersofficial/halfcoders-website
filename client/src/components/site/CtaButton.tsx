"use client";

import { ChevronRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

export type CtaKind = "enroll" | "courses" | "catalogue";

const LABEL: Record<CtaKind, string> = {
    enroll: "Start Learning",
    courses: "Browse Courses",
    catalogue: "View All Courses",
};

/**
 * The public site's calls to action, typed as commands (`.cmd` in
 * globals.css): square corners, a mono label, a halo on hover.
 *
 * - **Start Learning** — solid violet, the conversion. A prompt chevron in
 *   front; on hover a caret starts blinking after the label.
 * - **Browse Courses** — a bordered command with an open folder, to the
 *   catalogue.
 * - **View All Courses** — under the course list, with the count in brackets.
 *
 * The labels are English on every page, Bangla ones included, so the link
 * says `lang="en"`. Start Learning sends a visitor to sign in (or sign up);
 * once signed in it opens the catalogue to pick a course.
 */
export default function CtaButton({
    kind,
    label,
    size = "default",
    count,
    className,
}: {
    kind: CtaKind;
    label?: string;
    size?: "sm" | "default" | "lg";
    /** View All Courses: the number in brackets after the label. */
    count?: string;
    className?: string;
}) {
    const { isAuthenticated } = useSession();
    const text = label ?? LABEL[kind];
    const classes = cn("group/cta", size === "sm" && "px-4", className);

    if (kind === "courses") {
        return (
            <Button asChild variant="courses" size={size} className={classes}>
                <Link href="/courses" lang="en">
                    <FolderOpen className="text-syn-number" aria-hidden />
                    {text}
                </Link>
            </Button>
        );
    }

    if (kind === "catalogue") {
        return (
            <Button asChild variant="courses" size={size} className={classes}>
                <Link href="/courses" lang="en">
                    {text}
                    {count && (
                        <span className="font-normal text-muted-foreground tabular-nums">
                            [<span className="text-syn-number">{count}</span>]
                            <span className="sr-only"> courses</span>
                        </span>
                    )}
                    <ChevronRight className="transition-transform duration-200 group-hover/cta:translate-x-0.5" aria-hidden />
                </Link>
            </Button>
        );
    }

    return (
        <Button asChild variant="enroll" size={size} className={classes}>
            <Link href={isAuthenticated ? "/courses" : "/login"} lang="en">
                <ChevronRight className="-ml-1 opacity-80" aria-hidden />
                <span className="group-hover/cta:caret">{text}</span>
            </Link>
        </Button>
    );
}
