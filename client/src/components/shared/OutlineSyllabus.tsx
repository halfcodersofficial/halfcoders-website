"use client";

import { BookOpen, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FolderOpen, Folder, ListTree, Search, SearchX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ClassModeTag } from "@/components/shared/CourseClassification";
import { Button } from "@/components/ui/button";
import { langOf } from "@/lib/lang";
import { cn } from "@/lib/utils";
import type { OutlineItem, OutlineWeek } from "@/types/domain.types";

/*
 * A traditional (self-paced) course's outline, read as a syllabus: every
 * milestone on the page at once, each module a card that opens onto its
 * topics. Beside it (when there's room) the contents as an editor's explorer —
 * a search over every topic, the milestones as folders, the module being read
 * lit up — with a status bar saying where in the course you are.
 *
 * Shared by the student outline page and the Outline Maker's "Student view",
 * so staff preview exactly what students get.
 */

export const WEEK_ANCHOR = "outline-week-";
export const MODULE_ANCHOR = "outline-module-";

export const weekLabelFor = (week: Pick<OutlineWeek, "order">, label: string) => `${label} ${pad2(week.order)}`;

export const pad2 = (value: number) => String(value).padStart(2, "0");

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Staff list a module's topics in its note — "Introduction · What Is a
 * Computer? · …", one per line, or bulleted. Two or more pieces read as a
 * list of topics; anything else is a plain note (what to prepare, a remark)
 * and stays a sentence.
 */
const TOPIC_BREAK = /\s*(?:\r?\n|[·•●▪])\s*/;
const LIST_MARKER = /^(?:[-*–—]|\d{1,2}[.)])\s+/;

export function splitNote(note: string | null): { topics: string[]; text: string | null } {
    const clean = note?.trim();
    if (!clean) return { topics: [], text: null };
    const parts = clean
        .split(TOPIC_BREAK)
        .map((part) => part.replace(LIST_MARKER, "").trim())
        .filter(Boolean);
    return parts.length >= 2 ? { topics: parts, text: null } : { topics: [], text: clean };
}

export interface SyllabusModule {
    item: OutlineItem;
    /** Its place in the whole course, counting from 1 across every milestone. */
    number: number;
    topics: string[];
    text: string | null;
}

export interface SyllabusSection {
    week: OutlineWeek;
    modules: SyllabusModule[];
    topicCount: number;
}

export interface SyllabusPlan {
    sections: SyllabusSection[];
    modules: SyllabusModule[];
    topicCount: number;
}

/**
 * What a student is shown: published modules only — the same filter the API
 * applies for them, so a staff preview (which receives drafts and any
 * no-module or practice day left from a bootcamp past) stays honest.
 */
export function buildSyllabus(weeks: OutlineWeek[]): SyllabusPlan {
    const modules: SyllabusModule[] = [];
    const sections = weeks.map((week) => {
        const own = week.items
            .filter((item) => item.isPublished && item.kind === "MODULE")
            .map((item, index) => ({ item, number: modules.length + index + 1, ...splitNote(item.note) }));
        modules.push(...own);
        return { week, modules: own, topicCount: own.reduce((sum, module) => sum + module.topics.length, 0) };
    });
    return { sections, modules, topicCount: modules.reduce((sum, module) => sum + module.topics.length, 0) };
}

/* ---- Search ------------------------------------------------------------- */

interface Hit {
    title: boolean;
    text: boolean;
    /** Indexes of the matching topics. */
    topics: Set<number>;
}

const searchSyllabus = (modules: SyllabusModule[], query: string) => {
    const hits = new Map<string, Hit>();
    if (!query) return hits;
    const has = (value: string) => value.toLocaleLowerCase().includes(query);
    for (const entry of modules) {
        const topics = new Set(entry.topics.flatMap((topic, index) => (has(topic) ? [index] : [])));
        const hit = { title: has(entry.item.title), text: Boolean(entry.text && has(entry.text)), topics };
        if (hit.title || hit.text || topics.size > 0) hits.set(entry.item.id, hit);
    }
    return hits;
};

/** The query's matches marked like text selected in the editor. */
function Highlight({ text, query }: { text: string; query: string }) {
    if (!query) return <>{text}</>;
    const lower = text.toLocaleLowerCase();
    const parts: ReactNode[] = [];
    let from = 0;
    let at = lower.indexOf(query);
    while (at !== -1) {
        if (at > from) parts.push(text.slice(from, at));
        parts.push(
            <mark key={at} className="selected-text text-inherit">
                {text.slice(at, at + query.length)}
            </mark>,
        );
        from = at + query.length;
        at = lower.indexOf(query, from);
    }
    parts.push(text.slice(from));
    return <>{parts}</>;
}

const scrollBehavior = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/* ---- The syllabus --------------------------------------------------------- */

export default function OutlineSyllabus({
    syllabus,
    weekLabel,
    moduleLabel = "Module",
}: {
    syllabus: SyllabusPlan;
    weekLabel: string;
    moduleLabel?: string;
}) {
    const { sections, modules, topicCount } = syllabus;
    const expandable = useMemo(() => modules.filter((module) => module.topics.length > 0 || module.text), [modules]);

    // The first module starts open, so the page shows what a card holds; the rest wait for a click.
    const [open, setOpen] = useState<Set<string>>(() => new Set(expandable[0] ? [expandable[0].item.id] : []));
    const [closedFolders, setClosedFolders] = useState<Set<string>>(() => new Set());
    const [activeId, setActiveId] = useState(modules[0]?.item.id ?? "");
    const [rawQuery, setQuery] = useState("");
    const query = rawQuery.trim().toLocaleLowerCase();
    const hits = useMemo(() => searchSyllabus(modules, query), [modules, query]);
    const searching = query.length > 0;

    const sideSearch = useRef<HTMLInputElement>(null);
    const topSearch = useRef<HTMLInputElement>(null);
    const treeRef = useRef<HTMLDivElement>(null);

    const moduleIds = modules.map((module) => module.item.id).join(",");
    const lowerModule = moduleLabel.toLowerCase();

    // Which module is being read: the first one inside a band under the
    // navbar. Kept as a set of what's in the band, so the answer is always the
    // topmost in page order rather than whichever crossed a line last.
    useEffect(() => {
        const ids = moduleIds.split(",").filter(Boolean);
        const inBand = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const id = entry.target.id.slice(MODULE_ANCHOR.length);
                    if (entry.isIntersecting) inBand.add(id);
                    else inBand.delete(id);
                }
                const first = ids.find((id) => inBand.has(id));
                if (first) setActiveId(first);
            },
            { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
        );
        ids.forEach((id) => {
            const element = document.getElementById(`${MODULE_ANCHOR}${id}`);
            if (element) observer.observe(element);
        });
        return () => observer.disconnect();
    }, [moduleIds]);

    // A link straight to a module (`#outline-module-…`, as the figures panel
    // and a shared URL use) opens it.
    useEffect(() => {
        const ids = new Set(moduleIds.split(","));
        const openFromHash = () => {
            const hash = decodeURIComponent(window.location.hash.slice(1));
            const id = hash.startsWith(MODULE_ANCHOR) ? hash.slice(MODULE_ANCHOR.length) : "";
            if (!ids.has(id)) return;
            setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
            setActiveId(id);
            requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" }));
        };
        openFromHash();
        window.addEventListener("hashchange", openFromHash);
        return () => window.removeEventListener("hashchange", openFromHash);
    }, [moduleIds]);

    // "/" puts the cursor in the search, as in an editor's file finder.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target as HTMLElement | null;
            if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
            const input = [sideSearch.current, topSearch.current].find((element) => element && element.offsetParent !== null);
            if (!input) return;
            event.preventDefault();
            input.focus({ preventScroll: true });
            input.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Keep the lit-up row in view inside the explorer as the page scrolls.
    useEffect(() => {
        const tree = treeRef.current;
        const row = tree?.querySelector<HTMLElement>("[data-active]");
        if (!tree || !row) return;
        const top = row.offsetTop;
        if (top < tree.scrollTop || top + row.offsetHeight > tree.scrollTop + tree.clientHeight) {
            tree.scrollTo({ top: top - tree.clientHeight / 3, behavior: scrollBehavior() });
        }
    }, [activeId]);

    const jumpTo = (id: string) => {
        setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
        setActiveId(id);
        window.history.replaceState(window.history.state, "", `#${MODULE_ANCHOR}${id}`);
        requestAnimationFrame(() =>
            document.getElementById(`${MODULE_ANCHOR}${id}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" }),
        );
    };

    const jumpToWeek = (weekId: string) =>
        document.getElementById(`${WEEK_ANCHOR}${weekId}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });

    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleFolder = (weekId: string) =>
        setClosedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(weekId)) next.delete(weekId);
            else next.add(weekId);
            return next;
        });

    const allOpen = expandable.length > 0 && expandable.every((module) => open.has(module.item.id));
    const toggleAll = () => setOpen(allOpen ? new Set() : new Set(expandable.map((module) => module.item.id)));

    const matchedTopics = [...hits.values()].reduce((sum, hit) => sum + hit.topics.size, 0);
    const resultText = !searching
        ? `${plural(modules.length, lowerModule)}${topicCount ? ` · ${plural(topicCount, "topic")}` : ""}`
        : hits.size === 0
          ? `Nothing matches “${rawQuery.trim()}”`
          : matchedTopics > 0
            ? `${plural(matchedTopics, "topic")} found in ${plural(hits.size, lowerModule)}`
            : `${plural(hits.size, lowerModule)} found`;

    const active = modules.find((module) => module.item.id === activeId) ?? modules[0];
    const readFraction = active ? active.number / modules.length : 0;

    // Container queries, not viewport ones: the same component sits full-width
    // on the student page and inside the admin console beside its sidebar.
    return (
        <div className="@container/syllabus">
            <div className="grid gap-6 @4xl/syllabus:grid-cols-[17rem_minmax(0,1fr)] @4xl/syllabus:gap-8">
                {/* ---- Contents: the explorer ------------------------------------ */}
                <nav aria-label="Course contents" className="hidden @4xl/syllabus:block">
                    <div className="editor sticky top-24 flex max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-panel border border-editor-line shadow-panel">
                        <div className="flex items-center justify-between gap-2 border-b border-editor-line bg-editor-panel px-3 py-2">
                            <span className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-wider text-editor-muted">
                                <ListTree className="size-3.5 text-syn-func" aria-hidden />
                                Contents
                            </span>
                            <span className="font-mono text-[0.68rem] text-editor-muted">{plural(sections.length, weekLabel.toLowerCase())}</span>
                        </div>

                        {/* How far down the course the reader is. */}
                        <div className="h-0.5 bg-editor-line" aria-hidden>
                            <div
                                className="h-full bg-primary-400 transition-[width] duration-500 ease-out"
                                style={{ width: `${readFraction * 100}%` }}
                            />
                        </div>

                        <div className="border-b border-editor-line p-2">
                            <SearchField value={rawQuery} onChange={setQuery} inputRef={sideSearch} tone="dark" />
                        </div>

                        <div
                            ref={treeRef}
                            className="relative min-h-0 flex-1 overflow-y-auto p-1.5 [scrollbar-color:var(--editor-line)_transparent] scrollbar-thin"
                        >
                            {searching && hits.size === 0 && (
                                <p className="px-3 py-6 text-center text-xs text-editor-muted">No {lowerModule} matches.</p>
                            )}
                            {sections.map(({ week, modules: weekModules }) => {
                                const shown = searching ? weekModules.filter((module) => hits.has(module.item.id)) : weekModules;
                                if (searching && shown.length === 0) return null;
                                const isOpen = searching || !closedFolders.has(week.id);
                                const holdsActive = weekModules.some((module) => module.item.id === activeId);
                                const FolderIcon = isOpen ? FolderOpen : Folder;
                                return (
                                    <div key={week.id} className="pb-1">
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => toggleFolder(week.id)}
                                                disabled={searching}
                                                aria-expanded={isOpen}
                                                aria-label={`${isOpen ? "Hide" : "Show"} ${weekLabelFor(week, weekLabel)}`}
                                                className="grid size-6 shrink-0 place-items-center rounded-sm text-editor-muted hover:text-editor-fg disabled:opacity-60"
                                            >
                                                <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} aria-hidden />
                                            </button>
                                            <button
                                                type="button"
                                                title={week.title ?? undefined}
                                                onClick={() => jumpToWeek(week.id)}
                                                className={cn(
                                                    "flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-1.5 pr-2 text-left text-[0.8rem] font-semibold transition-colors hover:bg-editor-raised",
                                                    holdsActive ? "text-editor-fg" : "text-editor-muted",
                                                )}
                                            >
                                                <FolderIcon className="size-3.5 shrink-0 text-syn-number" aria-hidden />
                                                <span lang={langOf(week.title)} className="truncate">
                                                    {week.title ?? weekLabelFor(week, weekLabel)}
                                                </span>
                                            </button>
                                        </div>

                                        {isOpen && (
                                            <ul className="ml-3 border-l border-editor-line pl-1.5">
                                                {shown.length === 0 && <li className="px-2 py-1.5 text-xs text-editor-gutter">Coming soon</li>}
                                                {shown.map((module) => {
                                                    const isActive = module.item.id === activeId;
                                                    const hit = hits.get(module.item.id);
                                                    return (
                                                        <li key={module.item.id}>
                                                            <button
                                                                type="button"
                                                                data-active={isActive || undefined}
                                                                aria-current={isActive ? "location" : undefined}
                                                                onClick={() => jumpTo(module.item.id)}
                                                                className={cn(
                                                                    "relative flex w-full items-center gap-2.5 rounded-sm py-1.5 pl-2 pr-2 text-left text-[0.8rem] transition-colors",
                                                                    isActive
                                                                        ? "bg-violet-500/20 text-editor-fg"
                                                                        : "text-editor-muted hover:bg-editor-raised hover:text-editor-fg",
                                                                )}
                                                            >
                                                                {isActive && (
                                                                    <span aria-hidden className="absolute inset-y-1 -left-1.75 w-0.5 rounded-full bg-primary-400" />
                                                                )}
                                                                <span
                                                                    className={cn(
                                                                        "w-5 shrink-0 font-mono text-[0.68rem] tabular-nums",
                                                                        isActive ? "text-syn-keyword" : "text-editor-gutter",
                                                                    )}
                                                                >
                                                                    {pad2(module.number)}
                                                                </span>
                                                                <span lang={langOf(module.item.title)} className="min-w-0 flex-1 truncate">
                                                                    <Highlight text={module.item.title} query={query} />
                                                                </span>
                                                                {searching && hit && hit.topics.size > 0 ? (
                                                                    <span className="shrink-0 rounded-sm bg-syn-string/15 px-1 font-mono text-[0.62rem] text-syn-string">
                                                                        {hit.topics.size}
                                                                    </span>
                                                                ) : module.topics.length > 0 ? (
                                                                    <span className="shrink-0 font-mono text-[0.62rem] text-editor-gutter">{module.topics.length}</span>
                                                                ) : null}
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex h-7 shrink-0 items-center justify-between gap-2 bg-primary px-3 font-mono text-[0.68rem] text-primary-foreground">
                            <span className="truncate">
                                {active ? `${moduleLabel} ${active.number} of ${modules.length}` : `${modules.length} ${lowerModule}s`}
                            </span>
                            {topicCount > 0 && <span className="shrink-0">{plural(topicCount, "topic")}</span>}
                        </div>
                    </div>
                </nav>

                {/* ---- The milestones and their modules ---------------------------- */}
                <div className="min-w-0">
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                        <div className="w-full @4xl/syllabus:hidden">
                            <SearchField value={rawQuery} onChange={setQuery} inputRef={topSearch} tone="light" />
                        </div>
                        <p
                            aria-live="polite"
                            className={cn(
                                "min-w-0 flex-1 font-mono text-xs text-muted-foreground",
                                searching && hits.size > 0 && "text-primary-ink",
                            )}
                        >
                            {resultText}
                        </p>
                        {expandable.length > 0 && (
                            <Button variant="outline" size="sm" onClick={toggleAll} disabled={searching} className="shrink-0">
                                {allOpen ? <ChevronsDownUp aria-hidden /> : <ChevronsUpDown aria-hidden />}
                                {allOpen ? "Collapse all" : "Expand all"}
                            </Button>
                        )}
                    </div>

                    {searching && hits.size === 0 ? (
                        <div className="grid place-items-center rounded-card border border-dashed border-border px-6 py-14 text-center">
                            <SearchX className="size-7 text-muted-foreground" aria-hidden />
                            <p className="mt-3 font-semibold">Nothing matches “{rawQuery.trim()}”</p>
                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                Try a shorter word, or a different spelling. The search looks through every {lowerModule} title and topic.
                            </p>
                            <Button variant="outline" size="sm" className="mt-5" onClick={() => setQuery("")}>
                                Clear the search
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {sections.map(({ week, modules: weekModules, topicCount: weekTopics }) => {
                                const label = weekLabelFor(week, weekLabel);
                                const headingId = `${WEEK_ANCHOR}${week.id}-heading`;
                                const anyShown = !searching || weekModules.some((module) => hits.has(module.item.id));
                                return (
                                    <section
                                        key={week.id}
                                        id={`${WEEK_ANCHOR}${week.id}`}
                                        aria-labelledby={headingId}
                                        hidden={!anyShown}
                                        className="scroll-mt-24"
                                    >
                                        <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-border pb-3">
                                            <div className="min-w-0">
                                                <p className="font-mono text-xs text-primary-ink">{label}</p>
                                                {week.title && (
                                                    <h2 id={headingId} lang={langOf(week.title)} className="mt-1 text-h3 text-balance">
                                                        {week.title}
                                                    </h2>
                                                )}
                                                {!week.title && <h2 id={headingId} className="sr-only">{label}</h2>}
                                            </div>
                                            {weekModules.length > 0 && (
                                                <p className="font-mono text-xs text-muted-foreground">
                                                    {plural(weekModules.length, lowerModule)}
                                                    {weekTopics > 0 && ` · ${plural(weekTopics, "topic")}`}
                                                </p>
                                            )}
                                        </header>

                                        {weekModules.length === 0 ? (
                                            <p className="rounded-card border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
                                                Coming soon — nothing is out in this {weekLabel.toLowerCase()} yet.
                                            </p>
                                        ) : (
                                            <ol className="space-y-3">
                                                {weekModules.map((module) => {
                                                    const hit = hits.get(module.item.id);
                                                    return (
                                                        <ModuleCard
                                                            key={module.item.id}
                                                            module={module}
                                                            moduleLabel={moduleLabel}
                                                            isOpen={searching ? Boolean(hit) : open.has(module.item.id)}
                                                            onToggle={() => toggle(module.item.id)}
                                                            query={query}
                                                            hit={hit}
                                                            hidden={searching && !hit}
                                                            locked={searching}
                                                        />
                                                    );
                                                })}
                                            </ol>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ---- A module ------------------------------------------------------------- */

function ModuleCard({
    module,
    moduleLabel,
    isOpen,
    onToggle,
    query,
    hit,
    hidden,
    locked,
}: {
    module: SyllabusModule;
    moduleLabel: string;
    isOpen: boolean;
    onToggle: () => void;
    query: string;
    hit: Hit | undefined;
    hidden: boolean;
    /** While searching, cards open by the search, not by hand. */
    locked: boolean;
}) {
    const { item, number, topics, text } = module;
    const canOpen = topics.length > 0 || Boolean(text);
    const shown = canOpen && isOpen;
    const headId = `${MODULE_ANCHOR}${item.id}-head`;
    const bodyId = `${MODULE_ANCHOR}${item.id}-body`;
    const preview = topics.slice(0, 3).join(" · ");
    const more = topics.length - 3;

    const head = (
        <>
            <span
                aria-hidden
                className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-md border font-mono text-sm font-semibold tabular-nums transition-colors duration-200",
                    shown
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-primary-ink group-hover:border-primary/40",
                )}
            >
                {pad2(number)}
            </span>
            <span className="min-w-0 flex-1">
                <span lang={langOf(item.title)} className="block text-base font-semibold leading-snug">
                    <span className="sr-only">
                        {moduleLabel} {number}:{" "}
                    </span>
                    <Highlight text={item.title} query={query} />
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                        <BookOpen className="size-3.5" aria-hidden />
                        {moduleLabel}
                    </span>
                    {topics.length > 0 && (
                        <>
                            <span aria-hidden>·</span>
                            <span>{plural(topics.length, "topic")}</span>
                        </>
                    )}
                    {hit && hit.topics.size > 0 && (
                        <>
                            <span aria-hidden>·</span>
                            <span className="font-semibold text-primary-ink">{hit.topics.size} matching</span>
                        </>
                    )}
                    {item.mode && (
                        <>
                            <span aria-hidden>·</span>
                            <ClassModeTag mode={item.mode} />
                        </>
                    )}
                </span>
                {!shown && topics.length > 0 && (
                    <span lang={langOf(preview)} className="mt-2 block truncate text-sm text-muted-foreground/90">
                        {preview}
                        {more > 0 && <span className="font-medium text-primary-ink"> +{more} more</span>}
                    </span>
                )}
            </span>
            {canOpen && (
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "mt-3 size-4 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none",
                        shown && "rotate-180 text-primary",
                    )}
                />
            )}
        </>
    );

    return (
        <li
            id={`${MODULE_ANCHOR}${item.id}`}
            hidden={hidden}
            className={cn(
                "scroll-mt-24 overflow-hidden rounded-card border bg-card transition-[border-color,box-shadow] duration-200",
                shown ? "border-primary/40 shadow-card-hover" : "border-border shadow-card hover:border-border-strong",
            )}
        >
            <h3 id={headId}>
                {canOpen ? (
                    <button
                        type="button"
                        onClick={onToggle}
                        disabled={locked}
                        aria-expanded={shown}
                        aria-controls={bodyId}
                        className="group flex w-full items-start gap-4 p-4 text-left disabled:cursor-default sm:p-5"
                    >
                        {head}
                    </button>
                ) : (
                    <div className="flex items-start gap-4 p-4 sm:p-5">{head}</div>
                )}
            </h3>

            {canOpen && (
                <div
                    id={bodyId}
                    role="region"
                    aria-labelledby={headId}
                    inert={!shown}
                    className={cn(
                        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                        shown ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                >
                    <div className="min-h-0 overflow-hidden">
                        <div className="border-t border-border">
                            {text && (
                                <p lang={langOf(text)} className="px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                                    <Highlight text={text} query={query} />
                                </p>
                            )}
                            {topics.length > 0 && <TopicLines topics={topics} query={query} hit={hit} />}
                        </div>
                    </div>
                </div>
            )}
        </li>
    );
}

/**
 * A module's topics as the lines of a file: numbers down a gutter, the line
 * under the pointer lit like the editor's current line. While searching, the
 * matching topics are lit and the rest fade back.
 */
function TopicLines({ topics, query, hit }: { topics: string[]; query: string; hit: Hit | undefined }) {
    const narrowing = Boolean(query && hit && hit.topics.size > 0);
    return (
        <ol aria-label="Topics" className="bg-surface/50 py-2 text-sm">
            {topics.map((topic, index) => {
                const isHit = narrowing && hit!.topics.has(index);
                return (
                    <li
                        key={`${index}-${topic}`}
                        className={cn(
                            "group/line grid grid-cols-[3.25rem_minmax(0,1fr)] transition-colors hover:bg-primary/6",
                            isHit && "bg-primary/6",
                            narrowing && !isHit && "opacity-55",
                        )}
                    >
                        <span
                            aria-hidden
                            className={cn(
                                "select-none border-r border-border py-1.5 pr-3 text-right font-mono text-[0.7rem] leading-6 tabular-nums text-muted-foreground/70 group-hover/line:text-primary-ink",
                                isHit && "text-primary-ink",
                            )}
                        >
                            {index + 1}
                        </span>
                        <span lang={langOf(topic)} className="py-1.5 pl-4 pr-5 leading-6">
                            <Highlight text={topic} query={query} />
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

/* ---- The search field ------------------------------------------------------ */

function SearchField({
    value,
    onChange,
    inputRef,
    tone,
}: {
    value: string;
    onChange: (value: string) => void;
    inputRef: RefObject<HTMLInputElement | null>;
    tone: "dark" | "light";
}) {
    const dark = tone === "dark";
    return (
        <label
            className={cn(
                "flex h-9 items-center gap-2 rounded-md border px-2.5 transition-[border-color,box-shadow] focus-within:ring-2",
                dark
                    ? "border-editor-line bg-editor text-editor-fg focus-within:border-primary-400 focus-within:ring-primary-400/25"
                    : "border-border-strong bg-card focus-within:border-primary focus-within:ring-ring/20",
            )}
        >
            <Search className={cn("size-3.5 shrink-0", dark ? "text-editor-muted" : "text-muted-foreground")} aria-hidden />
            <span className="sr-only">Search topics</span>
            <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        onChange("");
                        event.currentTarget.blur();
                    }
                }}
                placeholder="Search topics…"
                autoComplete="off"
                spellCheck={false}
                className={cn(
                    "min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none",
                    dark ? "placeholder:text-editor-gutter" : "placeholder:text-muted-foreground/70",
                )}
            />
            {value ? (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="Clear the search"
                    className={cn("grid size-5 place-items-center rounded-sm", dark ? "text-editor-muted hover:text-editor-fg" : "text-muted-foreground hover:text-foreground")}
                >
                    <X className="size-3.5" aria-hidden />
                </button>
            ) : (
                <kbd
                    aria-hidden
                    title="Press / to search"
                    className={cn(
                        "hidden rounded-sm border px-1.5 font-mono text-[0.65rem] leading-4 sm:inline",
                        dark ? "border-editor-line text-editor-gutter" : "border-border text-muted-foreground",
                    )}
                >
                    /
                </kbd>
            )}
        </label>
    );
}
