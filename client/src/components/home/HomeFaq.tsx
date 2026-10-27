"use client";

import { MessageCircleQuestion, Plus, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import EditorWindow from "@/components/site/EditorWindow";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FAQ } from "./content";

const normalise = (text: string) => text.toLowerCase().trim();

/** `text` with every place `query` appears marked. */
function Highlight({ text, query }: { text: string; query: string }) {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, index) =>
        index % 2 ? (
            <mark key={index} className="rounded-sm bg-warning/30 px-0.5 text-inherit">
                {part}
            </mark>
        ) : (
            part
        ),
    );
}

/**
 * The questions nearly everyone asks first, in an editor pane, with a search
 * over them (question, answer and a few extra words each, so "পেমেন্ট" finds
 * the bKash answers) and, beside the heading, a few searches people often
 * make. Each opens in place — a native `<details>`, so it works without
 * JavaScript and a screen reader announces it — sliding open where the
 * browser can, with a violet edge and its number lit while open. A search
 * that finds nothing points at the way to ask directly.
 */
export default function HomeFaq() {
    const [query, setQuery] = useState("");
    const search = normalise(useDeferredValue(query));
    const shown = search ? FAQ.items.filter((item) => normalise(`${item.q} ${item.a} ${item.keys}`).includes(search)) : FAQ.items;

    return (
        <Section id="faq" labelledBy="home-faq-title">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
                <div className="lg:sticky lg:top-28 lg:self-start">
                    <SectionHeader id="home-faq-title" eyebrow={FAQ.eyebrow} title={FAQ.title} description={FAQ.description} className="mb-6 sm:mb-6" />
                    <p className="text-xs font-semibold text-muted-foreground">{FAQ.quickTitle}</p>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                        {FAQ.quick.map((word) => {
                            const active = normalise(query) === normalise(word);
                            return (
                                <li key={word}>
                                    <button
                                        type="button"
                                        onClick={() => setQuery(active ? "" : word)}
                                        aria-pressed={active}
                                        className={cn(
                                            "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                                            active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50 hover:text-primary",
                                        )}
                                    >
                                        {word}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    <Button asChild variant="outline" className="mt-7">
                        <Link href={FAQ.contact.href} lang="en">
                            <MessageCircleQuestion aria-hidden /> {FAQ.contact.label}
                        </Link>
                    </Button>
                </div>

                <EditorWindow
                    tone="light"
                    tabs={[{ name: "faq.md", label: FAQ.file, active: true }]}
                    actions={
                        <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
                            {shown.length.toLocaleString("bn-BD")}/{FAQ.items.length.toLocaleString("bn-BD")}
                        </span>
                    }
                >
                    <label className="flex items-center gap-3 border-b border-border px-5 py-3 transition-colors focus-within:bg-surface/60">
                        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="sr-only">{FAQ.search.label}</span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={FAQ.search.placeholder}
                            className="min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                aria-label={FAQ.search.clear}
                                className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                            >
                                <X className="size-3.5" aria-hidden />
                            </button>
                        )}
                    </label>

                    {shown.length ? (
                        <div className="divide-y divide-border">
                            {shown.map((item, index) => (
                                // Re-mounted when the search changes, so the first match opens.
                                <details
                                    key={`${item.q}|${search}`}
                                    open={index === 0}
                                    className="faq-item group relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:origin-top before:scale-y-0 before:bg-primary before:transition-[scale] before:duration-300 open:bg-surface/40 open:before:scale-y-100"
                                >
                                    <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-4 transition-colors hover:bg-surface [&::-webkit-details-marker]:hidden">
                                        <span
                                            aria-hidden
                                            className="w-5 shrink-0 pt-1 text-right font-mono text-xs text-syn-comment transition-colors group-open:font-semibold group-open:text-primary"
                                        >
                                            {String(FAQ.items.indexOf(item) + 1).padStart(2, "0")}
                                        </span>
                                        <span className="flex-1 font-semibold">
                                            <Highlight text={item.q} query={search} />
                                        </span>
                                        <span
                                            aria-hidden
                                            className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-[rotate,background-color,border-color,color] duration-300 group-open:rotate-45 group-open:border-primary group-open:bg-primary group-open:text-primary-foreground motion-reduce:transition-none"
                                        >
                                            <Plus className="size-3.5" />
                                        </span>
                                    </summary>
                                    <p className="pb-5 pl-14 pr-6 leading-relaxed text-muted-foreground">
                                        <Highlight text={item.a} query={search} />
                                    </p>
                                </details>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center px-6 py-12 text-center">
                            <span className="grid size-12 place-items-center rounded-full bg-surface text-muted-foreground">
                                <SearchX className="size-5" aria-hidden />
                            </span>
                            <p className="mt-4 max-w-sm leading-relaxed text-muted-foreground">{FAQ.empty}</p>
                            <Button asChild variant="brand" size="sm" className="mt-5">
                                <Link href={FAQ.contact.href} lang="en">
                                    <MessageCircleQuestion aria-hidden /> {FAQ.contact.label}
                                </Link>
                            </Button>
                        </div>
                    )}
                </EditorWindow>
            </div>
        </Section>
    );
}
