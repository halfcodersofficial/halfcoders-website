import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The public site's one card grid: one column on phones, two on tablets,
 * three on small laptops and four per row on desktop (from 1280px) — the same
 * gaps everywhere. Use it for every row of cards on a visitor page.
 */
export const CARD_GRID = "grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4";

export default function CardGrid({
    as: Tag = "div",
    className,
    children,
}: {
    as?: "div" | "ul" | "ol";
    className?: string;
    children: ReactNode;
}) {
    return <Tag className={cn(CARD_GRID, className)}>{children}</Tag>;
}
