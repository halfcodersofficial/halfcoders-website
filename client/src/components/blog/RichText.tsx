import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/** `**bold**`, `` `code` `` and `[text](href)` — the only marks a post's text may use (content/blog/types.ts). */
const MARK = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/**
 * A line of a post's text with its inline marks turned into elements. Split,
 * not parsed into HTML, so the text can never carry markup of its own. A link
 * to "/…" stays on the site; an https link opens in a new tab; any other
 * address is shown as plain text.
 */
export default function RichText({ text }: { text: string }): ReactNode {
    return text.split(MARK).map((part, index) => {
        if (index % 2 === 0) return part ? <Fragment key={index}>{part}</Fragment> : null;

        if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;

        if (part.startsWith("`")) {
            return (
                <code key={index} lang="en" className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.85em]">
                    {part.slice(1, -1)}
                </code>
            );
        }

        const [, label, href] = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? [];
        if (href?.startsWith("/")) {
            return (
                <Link key={index} href={href}>
                    {label}
                </Link>
            );
        }
        if (href?.startsWith("https://")) {
            return (
                <a key={index} href={href} target="_blank" rel="noopener noreferrer">
                    {label}
                </a>
            );
        }
        return <Fragment key={index}>{label ?? part}</Fragment>;
    });
}
