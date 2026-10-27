"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { FileIcon } from "@/components/site/EditorWindow";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { cn } from "@/lib/utils";
import { INSIDE } from "./content";

/* Colour a preview line by how it starts, as an editor would. */
const lineTone = (line: string) =>
    line.startsWith("-")
        ? "bg-syn-tag/10 text-syn-tag"
        : line.startsWith("+")
          ? "bg-syn-string/10 text-syn-string"
          : line.startsWith("$")
            ? "text-syn-keyword"
            : line.startsWith("✓")
              ? "text-syn-string"
              : line.startsWith("💬")
                ? "text-syn-func"
                : "text-editor-fg";

/**
 * What's in every course, as an editor's explorer: the parts down the left
 * (video lessons, assignments, the certificate…, each with a file icon and a
 * plain name), the chosen one on the right — what it is in a sentence or two,
 * and a small example of how it looks (a code fix with a mentor's comment, a
 * queue number, a certificate check). A real tab list: arrow
 * keys move between the files, Home/End jump to the ends.
 */
export default function HomeInside() {
    const [active, setActive] = useState(0);
    const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
    const file = INSIDE.files[active];

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const last = INSIDE.files.length - 1;
        const next =
            event.key === "ArrowDown" || event.key === "ArrowRight"
                ? Math.min(active + 1, last)
                : event.key === "ArrowUp" || event.key === "ArrowLeft"
                  ? Math.max(active - 1, 0)
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? last
                      : null;
        if (next === null) return;
        event.preventDefault();
        setActive(next);
        tabsRef.current[next]?.focus();
    };

    return (
        <Section tone="dark" labelledBy="home-inside-title">
            <SectionHeader id="home-inside-title" eyebrow={INSIDE.eyebrow} title={INSIDE.title} description={INSIDE.description} />

            <div className="grid grid-cols-1 overflow-hidden rounded-panel border border-editor-line bg-editor-panel shadow-panel lg:grid-cols-[17rem_minmax(0,1fr)]">
                <div className="border-b border-editor-line lg:border-b-0 lg:border-r">
                    <p className="hidden items-center gap-1.5 px-3 pb-2 pt-4 text-[0.75rem] font-semibold uppercase tracking-wider text-editor-muted lg:flex">
                        <ChevronDown className="size-3.5" aria-hidden /> {INSIDE.explorer}
                    </p>
                    <div
                        role="tablist"
                        aria-label="Inside a course"
                        aria-orientation="vertical"
                        onKeyDown={onKeyDown}
                        className="no-scrollbar flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-px lg:overflow-visible lg:px-2 lg:pb-4 lg:pt-0"
                    >
                        {INSIDE.files.map((item, index) => {
                            const selected = index === active;
                            return (
                                <button
                                    key={item.id}
                                    ref={(node) => {
                                        tabsRef.current[index] = node;
                                    }}
                                    type="button"
                                    role="tab"
                                    id={`inside-tab-${item.id}`}
                                    aria-selected={selected}
                                    aria-controls="inside-panel"
                                    tabIndex={selected ? 0 : -1}
                                    onClick={() => setActive(index)}
                                    className={cn(
                                        "flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors lg:pl-7",
                                        selected ? "bg-violet-500/20 text-editor-fg" : "text-editor-muted hover:bg-editor-raised hover:text-editor-fg",
                                    )}
                                >
                                    <FileIcon name={item.file} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div id="inside-panel" role="tabpanel" aria-labelledby={`inside-tab-${file.id}`} className="min-w-0 bg-editor">
                    <div aria-hidden className="flex border-b border-editor-line bg-editor-panel">
                        <span
                            data-active
                            className="editor-tab flex items-center gap-2 border-r border-editor-line bg-editor px-3.5 py-2 font-mono text-[0.72rem] text-editor-fg"
                        >
                            <FileIcon name={file.file} />
                            <span className="font-sans text-[0.78rem] font-medium">{file.label}</span>
                        </span>
                    </div>
                    <div key={file.id} className="animate-in fade-in duration-300 p-6 motion-reduce:animate-none sm:p-8">
                        <h3 className="text-h3">{file.title}</h3>
                        <p className="mt-3 max-w-2xl leading-relaxed text-editor-muted">{file.text}</p>
                        <p aria-hidden className="mt-6 text-xs font-semibold uppercase tracking-wider text-editor-gutter">
                            {INSIDE.example}
                        </p>
                        <pre
                            aria-hidden
                            className="mt-2 overflow-x-auto rounded-md border border-editor-line bg-editor-panel py-3 font-mono text-[0.8rem] leading-7"
                        >
                            {file.preview.map((line) => (
                                <span key={line} className={cn("block px-4", lineTone(line))}>
                                    {line}
                                </span>
                            ))}
                        </pre>
                    </div>
                </div>
            </div>
        </Section>
    );
}
