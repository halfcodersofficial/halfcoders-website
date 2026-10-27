"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface LegalTocItem {
    id: string;
    label: string;
}

/**
 * "এই পাতায়": the document's parts as a numbered list of links, the one being
 * read marked (a rule down its left, the number filled) as the page scrolls —
 * whichever part's top last passed a line a third of the way down the screen.
 */
export default function LegalToc({ items }: { items: LegalTocItem[] }) {
    const [current, setCurrent] = useState(items[0]?.id);

    useEffect(() => {
        const sections = items.map((item) => document.getElementById(item.id)).filter((node): node is HTMLElement => node !== null);
        if (sections.length === 0) return;

        let frame = 0;
        const update = () => {
            frame = 0;
            const line = window.innerHeight / 3;
            let reading = sections[0].id;
            for (const section of sections) {
                if (section.getBoundingClientRect().top <= line) reading = section.id;
            }
            setCurrent(reading);
        };
        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [items]);

    return (
        <ol className="border-l border-border">
            {items.map((item, index) => {
                const active = item.id === current;
                return (
                    <li key={item.id}>
                        <a
                            href={`#${item.id}`}
                            aria-current={active ? "location" : undefined}
                            className={cn(
                                "-ml-px flex items-baseline gap-2.5 border-l-2 py-1.5 pl-3 pr-2 text-sm leading-snug transition-colors",
                                active ? "border-primary bg-primary/5 font-semibold text-foreground" : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
                            )}
                        >
                            <span aria-hidden className="shrink-0 font-mono text-[0.68rem] text-syn-comment">
                                §{String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0">{item.label}</span>
                        </a>
                    </li>
                );
            })}
        </ol>
    );
}
