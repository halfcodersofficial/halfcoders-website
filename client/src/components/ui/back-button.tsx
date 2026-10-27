import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The way out of a page — a bordered button that names where it leads
 * ("← All courses"), never a bare arrow, which reads as decoration and gets
 * missed.
 *
 * On a page header it sits on its own row above the title. `compact` is for
 * the 64px top bars of the student screens, where it shares the row with the
 * title: the label drops out on phones, leaving the bordered arrow.
 */
export function BackButton({
    href,
    label,
    compact = false,
    className,
}: {
    href: string;
    /** Where it goes — "All courses", "Module Manager". */
    label: string;
    compact?: boolean;
    className?: string;
}) {
    return (
        <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("shrink-0 bg-card shadow-sm", compact && "max-sm:size-9 max-sm:px-0", className)}
        >
            <Link href={href}>
                <ArrowLeft />
                {/* Still read out on phones — it names the link. */}
                <span className={cn(compact && "max-sm:sr-only")}>{label}</span>
            </Link>
        </Button>
    );
}
