import type { ReactNode } from "react";
import { Eyebrow } from "@/components/site/code";
import { langOf } from "@/lib/lang";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
    title: ReactNode;
    /** The band's subject in a word or two, set as a code comment: `// courses`. */
    eyebrow?: ReactNode;
    /** A number in front of the eyebrow ("01") — for bands that run in order. */
    index?: string;
    description?: ReactNode;
    /** A link or button for the whole band ("View all courses"): beside the title on wide screens, under it on phones. */
    action?: ReactNode;
    align?: "start" | "center";
    as?: "h1" | "h2" | "h3";
    /** For `Section labelledBy`. */
    id?: string;
    className?: string;
}

const textLang = (node: ReactNode) => (typeof node === "string" ? langOf(node) : undefined);

/** The heading block every band opens with — a comment above, the title, a line of context. */
export default function SectionHeader({
    title,
    eyebrow,
    index,
    description,
    action,
    align = "start",
    as: Heading = "h2",
    id,
    className,
}: SectionHeaderProps) {
    const centred = align === "center";

    return (
        <div
            className={cn(
                "mb-8 flex flex-col gap-5 sm:mb-12",
                action && !centred && "sm:flex-row sm:items-end sm:justify-between",
                centred && "items-center text-center",
                className,
            )}
        >
            <div className="max-w-2xl">
                {eyebrow && (
                    <Eyebrow index={index} className="mb-3">
                        {eyebrow}
                    </Eyebrow>
                )}
                <Heading id={id} lang={textLang(title)} className="text-h2 text-balance">
                    {title}
                </Heading>
                {description && (
                    <p lang={textLang(description)} className="mt-3 leading-relaxed text-muted-foreground sm:text-lg [.editor_&]:text-editor-muted">
                        {description}
                    </p>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
