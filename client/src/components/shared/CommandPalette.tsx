"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
    href: string;
    label: string;
    group: string;
    icon: LucideIcon;
}

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: CommandItem[];
}

/**
 * Ctrl/Cmd+K "Go to…", an editor's quick-open, on the dark editor surface.
 * Used by the public navbar (pages) and the consoles (every admin section).
 *
 * Ctrl/Cmd+K search over every admin section — the console's fifteen-odd
 * pages are all one click deep from the sidebar already, but "one click deep"
 * still means finding the right group first. Typing is faster once an admin
 * knows the console at all, which is true of anyone using it daily.
 *
 * Radix `Dialog` under the hood (already a dependency for `Modal`), not a
 * dedicated command-menu library — the list here is a few dozen static nav
 * items, not enough to justify another package.
 */
export default function CommandPalette({ open, onOpenChange, items }: CommandPaletteProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter(
            (item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q),
        );
    }, [items, query]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    useEffect(() => {
        if (!open) return;
        setQuery("");
        setActiveIndex(0);
        // Radix already focuses the content pane; a frame later wins the race
        // for the input specifically, so typing starts immediately.
        const raf = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(raf);
    }, [open]);

    const go = (href: string) => {
        onOpenChange(false);
        router.push(href);
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter") {
            event.preventDefault();
            const item = filtered[activeIndex];
            if (item) go(item.href);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-editor/45 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
                <Dialog.Content
                    className="editor fixed left-1/2 top-20 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-panel border border-editor-line focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                    style={{ boxShadow: "var(--shadow-panel)" }}
                    aria-describedby={undefined}
                    onKeyDown={onKeyDown}
                >
                    <Dialog.Title className="sr-only">Jump to a page</Dialog.Title>

                    <div className="flex items-center gap-2.5 border-b border-editor-line bg-editor-panel px-4 py-3">
                        <Search className="size-4 shrink-0 text-syn-keyword" aria-hidden />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Go to…"
                            aria-label="Jump to a page"
                            className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-editor-muted"
                        />
                        <kbd className="hidden shrink-0 rounded-sm border border-editor-line px-1.5 py-0.5 font-mono text-[10px] text-editor-muted sm:block">
                            Esc
                        </kbd>
                    </div>

                    <div className="max-h-80 overflow-y-auto p-1.5">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-8 text-center font-mono text-sm text-editor-muted">
                                No matches for &ldquo;{query}&rdquo;.
                            </p>
                        ) : (
                            filtered.map((item, index) => (
                                <button
                                    key={item.href}
                                    type="button"
                                    onClick={() => go(item.href)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={cn(
                                        "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors",
                                        index === activeIndex ? "bg-violet-500/20 text-editor-fg" : "text-editor-muted hover:bg-editor-panel",
                                    )}
                                >
                                    <item.icon className="size-4 shrink-0 text-syn-func" aria-hidden />
                                    <span className="flex-1 truncate">{item.label}</span>
                                    <span className="shrink-0 font-mono text-[0.7rem] text-syn-comment">{item.group}</span>
                                    {index === activeIndex && (
                                        <CornerDownLeft className="size-3.5 shrink-0 text-editor-muted" aria-hidden />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
