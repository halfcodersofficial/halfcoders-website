import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
    id?: string;
    /**
     * `surface` lays the quiet tint behind the band, edged with hairlines.
     * `dark` is the editor surface (`.editor`) on graph paper, and tells the
     * navbar, which turns dark over it (`data-nav-tone`).
     */
    tone?: "default" | "surface" | "dark";
    /** `sm` for a band that follows straight on from another of the same kind. */
    size?: "default" | "sm";
    /** Points at the band's heading (`SectionHeader id`), so the region has a name. */
    labelledBy?: string;
    className?: string;
    containerClassName?: string;
    children: ReactNode;
}

/**
 * One band of a public page: the shared vertical rhythm and the page
 * container. Every band uses the same two spacings.
 */
export default function Section({
    id,
    tone = "default",
    size = "default",
    labelledBy,
    className,
    containerClassName,
    children,
}: SectionProps) {
    return (
        <section
            id={id}
            aria-labelledby={labelledBy}
            data-nav-tone={tone === "dark" ? "dark" : undefined}
            className={cn(
                "relative",
                size === "sm" ? "section-sm" : "section",
                tone === "surface" && "border-y border-border bg-surface",
                tone === "dark" && "editor overflow-hidden",
                id && "scroll-anchor",
                className,
            )}
        >
            {tone === "dark" && <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />}
            <div className={cn("container-page relative", containerClassName)}>{children}</div>
        </section>
    );
}
