"use client";

import { ChevronLeft, ChevronRight, Inbox, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import type { ApiMeta } from "@/types/api.types";

interface DataShellProps {
    title?: string;
    description?: ReactNode;
    /**
     * Replaces the title block (title, description, action) — for a screen
     * that heads its list with more than a heading, like one course's orders.
     */
    header?: ReactNode;
    /** Top-right — the screen's one "create" button. */
    action?: ReactNode;
    searchPlaceholder?: string;
    /** Called as the admin types (debounced), and at once on Enter or clear. */
    onSearch?: (term: string) => void;
    /** What the search box holds when it first renders — e.g. a term restored from the URL. */
    defaultSearch?: string;
    /** `count` shows beside the label, e.g. how many rows that filter holds. */
    filters?: { value: string; label: string; count?: number }[];
    activeFilter?: string;
    onFilter?: (value: string) => void;
    /** More toolbar controls after the filter — a sort, a second filter. */
    controls?: ReactNode;
    /**
     * The list as a CSV, from the API's export of it: `params` are the list's
     * current filters, search and sort (paging is ignored — it's every row).
     */
    exportCsv?: { path: string; params: Record<string, unknown> };
    isLoading: boolean;
    /** Replaces the default table-shaped placeholder — e.g. cards for a card view. */
    skeleton?: ReactNode;
    isEmpty: boolean;
    emptyMessage: string;
    /** What to do about it, in a sentence. */
    emptyHint?: string;
    /** A button that resolves the empty state — usually the same as `action`. */
    emptyAction?: ReactNode;
    meta?: ApiMeta;
    onPage?: (page: number) => void;
    children: ReactNode;
}

/**
 * The chrome around every admin list: heading and primary action, a live
 * search box, a segmented filter, then loading / empty / results / paging.
 *
 * One shape for all of them is the point. An admin who has used the students
 * screen already knows where the search is, what the filter looks like and
 * where the "new" button sits on every other screen.
 */
export default function DataShell({
    title,
    description,
    header,
    action,
    searchPlaceholder,
    onSearch,
    defaultSearch = "",
    filters,
    activeFilter,
    onFilter,
    controls,
    exportCsv,
    isLoading,
    skeleton,
    isEmpty,
    emptyMessage,
    emptyHint,
    emptyAction,
    meta,
    onPage,
    children,
}: DataShellProps) {
    const [term, setTerm] = useState(defaultSearch);
    const debounced = useDebouncedValue(term, 300);

    // Pages pass an inline arrow; reading it through a ref keeps the effect
    // keyed on the term alone rather than re-firing every render.
    const onSearchRef = useRef(onSearch);
    onSearchRef.current = onSearch;

    // Only a term that differs from the last one reported is passed on. That
    // skips the first render, and stays true when strict mode runs the effect
    // twice — a "first run" flag would report the starting term the second
    // time, over whatever the page had changed since.
    const lastReported = useRef(defaultSearch.trim());
    useEffect(() => {
        const value = debounced.trim();
        if (value === lastReported.current) return;
        lastReported.current = value;
        onSearchRef.current?.(value);
    }, [debounced]);

    const searchNow = (value: string) => {
        setTerm(value);
        lastReported.current = value.trim();
        onSearchRef.current?.(value.trim());
    };

    const hasToolbar = Boolean(onSearch || (filters && onFilter) || controls || exportCsv);

    return (
        <div className="space-y-5">
            {header ?? (
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
                        {description && <div className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</div>}
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </header>
            )}

            {hasToolbar && (
                <div className="flex flex-wrap items-center gap-3">
                    {onSearch && (
                        <div className="relative min-w-60 flex-1 sm:max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                value={term}
                                onChange={(event) => setTerm(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        searchNow(term);
                                    }
                                }}
                                placeholder={searchPlaceholder ?? "Search…"}
                                aria-label={searchPlaceholder ?? "Search"}
                                className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
                            />
                            {term && (
                                <button
                                    type="button"
                                    onClick={() => searchNow("")}
                                    aria-label="Clear search"
                                    className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                    )}

                    {filters && onFilter && (
                        <div
                            role="group"
                            aria-label="Filter"
                            className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary/60 p-1"
                        >
                            {filters.map((filter) => {
                                const isActive = activeFilter === filter.value;
                                return (
                                    <button
                                        key={filter.value || "all"}
                                        type="button"
                                        aria-pressed={isActive}
                                        onClick={() => onFilter(filter.value)}
                                        className={cn(
                                            "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-card text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        {filter.label}
                                        {filter.count !== undefined && (
                                            <span
                                                className={cn(
                                                    "ml-1.5 tabular-nums",
                                                    isActive ? "text-muted-foreground" : "text-muted-foreground/70",
                                                )}
                                            >
                                                {filter.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {controls}

                    {exportCsv && (
                        <div className="sm:ml-auto">
                            <ExportCsvButton path={exportCsv.path} params={exportCsv.params} disabled={!isLoading && isEmpty} />
                        </div>
                    )}
                </div>
            )}

            {isLoading && skeleton ? (
                <div aria-busy>{skeleton}</div>
            ) : isLoading ? (
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-busy>
                    <div className="h-10 bg-secondary/40" />
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-4 border-t border-border px-4 py-3.5">
                            <Skeleton className="size-9 rounded-full" />
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="ml-auto h-4 w-24" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                    ))}
                </div>
            ) : isEmpty ? (
                <div className="animate-in fade-in-0 zoom-in-95 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center duration-200">
                    <div className="mx-auto grid size-14 place-items-center rounded-full bg-secondary/60">
                        <Inbox className="size-6 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="mt-4 font-medium">{emptyMessage}</p>
                    {emptyHint && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{emptyHint}</p>}
                    {emptyAction && <div className="mt-5 flex justify-center">{emptyAction}</div>}
                </div>
            ) : (
                <>
                    {children}

                    {meta && (
                        <nav
                            className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
                            aria-label="Pagination"
                        >
                            <p>
                                {meta.totalPages > 1 ? (
                                    <>
                                        Showing {(meta.page - 1) * meta.limit + 1}–
                                        {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                                    </>
                                ) : (
                                    <>
                                        {meta.total} {meta.total === 1 ? "result" : "results"}
                                    </>
                                )}
                            </p>

                            {meta.totalPages > 1 && onPage && (
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={meta.page <= 1}
                                        onClick={() => onPage(meta.page - 1)}
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft /> Prev
                                    </Button>
                                    <span className="px-2 tabular-nums">
                                        {meta.page} / {meta.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={meta.page >= meta.totalPages}
                                        onClick={() => onPage(meta.page + 1)}
                                        aria-label="Next page"
                                    >
                                        Next <ChevronRight />
                                    </Button>
                                </div>
                            )}
                        </nav>
                    )}
                </>
            )}
        </div>
    );
}
