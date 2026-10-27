import type { ReactNode } from "react";
import { BANGLA } from "@/lib/lang";

/**
 * A run of Latin script inside Bangla — "Variables, Data Types, Operators",
 * "C++ Programming". It ends on a letter, digit, `+` or `#`, so the hyphen
 * before a Bangla suffix ("Programming-এর") stays with the suffix.
 */
const LATIN_RUN = /[A-Za-z0-9][\w+#.&/:,' -]*[\w+#]|[A-Za-z]/g;

/**
 * Course copy here is Bangla with the technical terms left in English, so the
 * English words are the subject — "Pointers", "Dynamic Memory Allocation" —
 * and the Bangla around them the grammar. Wraps each English run in
 * `className`, so the terms can be read at a glance. Copy in one script only
 * comes back as it is.
 */
export const emphasiseLatin = (text: string, className: string): ReactNode => {
    if (!BANGLA.test(text) || !/[A-Za-z]/.test(text)) return text;

    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(LATIN_RUN)) {
        if (match.index > last) parts.push(text.slice(last, match.index));
        parts.push(
            <span key={match.index} className={className}>
                {match[0]}
            </span>,
        );
        last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
};
