import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Syntax-coloured spans for the "code" the site is dressed in — headlines,
 * eyebrows, hero windows. They take their colours from the `syn-*` tokens, so
 * they read on the light pages and inside `.editor` alike. Decoration only:
 * the words still have to make sense read aloud.
 */

type SpanProps = { children: ReactNode; className?: string };

export const Kw = ({ children, className }: SpanProps) => <span className={cn("text-syn-keyword", className)}>{children}</span>;
export const Str = ({ children, className }: SpanProps) => <span className={cn("text-syn-string", className)}>{children}</span>;
export const Fn = ({ children, className }: SpanProps) => <span className={cn("text-syn-func", className)}>{children}</span>;
export const Num = ({ children, className }: SpanProps) => <span className={cn("text-syn-number", className)}>{children}</span>;
export const Tag = ({ children, className }: SpanProps) => <span className={cn("text-syn-tag", className)}>{children}</span>;
export const Cmt = ({ children, className }: SpanProps) => <span className={cn("text-syn-comment", className)}>{children}</span>;

/**
 * A comment-style label: `// courses`. The site's eyebrow — above section
 * titles, on cards, in the footer. `index` puts a number in front ("01").
 */
export function Eyebrow({ children, index, className }: { children: ReactNode; index?: string; className?: string }) {
    return (
        <p className={cn("font-mono text-xs tracking-tight text-syn-comment sm:text-[0.8rem]", className)}>
            {index && <span className="mr-2 text-primary-ink">{index}</span>}
            <span aria-hidden>{"// "}</span>
            {children}
        </p>
    );
}

/** A shell prompt and a command after it: `~/halfcoders $ npm start`. */
export function Prompt({
    children,
    path = "~/halfcoders",
    className,
}: {
    children?: ReactNode;
    path?: string;
    className?: string;
}) {
    return (
        <span className={cn("font-mono", className)}>
            <span className="text-syn-string">{path}</span> <span className="text-syn-keyword">$</span>
            {children && <> {children}</>}
        </span>
    );
}
