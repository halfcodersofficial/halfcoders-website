"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ClipboardCheck, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { elapsed } from "@/components/mentor/dashboard/time";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useNow } from "@/hooks/useNow";
import { useSession } from "@/hooks/useSession";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { assignmentService, dashboardService } from "@/services";
import type { ApiMeta, SubmissionStatus } from "@/types/api.types";
import type { ReviewQueueItem } from "@/types/mentor.types";
import MarkingPane, { STATUS_META } from "./MarkingPane";

export type ReviewTab = "WAITING" | "NEEDS_REVISION" | "ACCEPTED" | "REJECTED" | "ALL";

const TABS: { value: ReviewTab; label: string; statuses: SubmissionStatus[]; empty: string }[] = [
    { value: "WAITING", label: "Waiting", statuses: ["SUBMITTED", "UNDER_REVIEW"], empty: "You're all caught up — new hand-ins land here, oldest first." },
    { value: "NEEDS_REVISION", label: "Changes asked", statuses: ["NEEDS_REVISION"], empty: "Nothing sent back for changes." },
    { value: "ACCEPTED", label: "Accepted", statuses: ["ACCEPTED"], empty: "Nothing accepted yet." },
    { value: "REJECTED", label: "Rejected", statuses: ["REJECTED"], empty: "Nothing rejected." },
    { value: "ALL", label: "All", statuses: [], empty: "No hand-ins yet." },
];

/** A `?status=` from a link, as the tab it belongs under. */
export const tabFor = (status: string | null): ReviewTab => {
    if (status === null || status === "SUBMITTED" || status === "UNDER_REVIEW") return "WAITING";
    return (TABS.find((tab) => tab.value === status)?.value ?? "ALL") as ReviewTab;
};

const LARGE = "(min-width: 1024px)";
/** Whether the marking pane sits beside the list (or inline under the row). */
function useWide() {
    return useSyncExternalStore(
        (notify) => {
            const query = window.matchMedia(LARGE);
            query.addEventListener("change", notify);
            return () => query.removeEventListener("change", notify);
        },
        () => window.matchMedia(LARGE).matches,
        () => false,
    );
}

type Page = { data: ReviewQueueItem[]; meta?: ApiMeta };

/**
 * The mentor's review queue as a marking desk: hand-ins on the left —
 * tabs that carry their counts, course chips, search by name or assignment,
 * oldest or newest first — and the chosen one beside them, ready to mark.
 * Saving moves straight on to the next. Opened from a link it lands on that
 * course, assignment, state and hand-in.
 */
export default function ReviewDesk({
    initial,
}: {
    initial: { tab: ReviewTab; courseId: string; assignmentId: string; sort: "asc" | "desc"; focus: string | null };
}) {
    const queryClient = useQueryClient();
    const wide = useWide();
    const now = useNow(60_000);
    const { user } = useSession();
    const [tab, setTab] = useState<ReviewTab>(initial.tab);
    const [courseId, setCourseId] = useState(initial.courseId);
    const [assignmentId, setAssignmentId] = useState(initial.assignmentId);
    const [sortOrder, setSortOrder] = useState(initial.sort);
    const [searchInput, setSearchInput] = useState("");
    const searchTerm = useDebouncedValue(searchInput.trim(), 300);
    const [selectedId, setSelectedId] = useState<string | null>(initial.focus);
    const [focusPending, setFocusPending] = useState(initial.focus);
    const dirty = useRef(false);
    const paneRef = useRef<HTMLElement>(null);
    const onDirtyChange = useCallback((value: boolean) => {
        dirty.current = value;
    }, []);

    const dashboard = useQuery({ queryKey: ["dashboard", "mentor"], queryFn: dashboardService.mentor });
    const courses = dashboard.data?.courses ?? [];

    const counts = useQuery({
        queryKey: ["reviews", "counts", courseId, assignmentId],
        queryFn: () => assignmentService.reviewCounts({ courseId: courseId || undefined, assignmentId: assignmentId || undefined }),
    });
    const countOf = (value: ReviewTab) => {
        if (!counts.data) return null;
        const statuses = TABS.find((entry) => entry.value === value)?.statuses ?? [];
        const keys = statuses.length ? statuses : (Object.keys(counts.data) as SubmissionStatus[]);
        return keys.reduce((sum, key) => sum + (counts.data?.[key] ?? 0), 0);
    };

    const statuses = TABS.find((entry) => entry.value === tab)?.statuses ?? [];
    const list = useInfiniteQuery({
        queryKey: ["reviews", "desk", tab, sortOrder, courseId, assignmentId, searchTerm],
        queryFn: ({ pageParam }): Promise<Page> =>
            assignmentService.reviewQueue({
                status: statuses.length ? statuses : undefined,
                sortOrder,
                courseId: courseId || undefined,
                assignmentId: assignmentId || undefined,
                searchTerm: searchTerm || undefined,
                page: pageParam,
                limit: 25,
            }),
        initialPageParam: 1,
        getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    });

    // A hand-in saved while the next page loads shifts the pages by one — drop the repeat.
    const items = useMemo(() => {
        const seen = new Set<string>();
        return (list.data?.pages.flatMap((page) => page.data) ?? []).filter((item) => !seen.has(item.id) && seen.add(item.id));
    }, [list.data]);
    const total = list.data?.pages[0]?.meta?.total ?? items.length;
    const current = items.find((item) => item.id === selectedId) ?? null;
    // Each hand-in starts from the top: who, the brief, their work.
    useEffect(() => {
        paneRef.current?.scrollTo({ top: 0 });
    }, [current?.id]);
    // Saved this visit — under "Waiting" they're on their way out of the list, so never reopened.
    const saved = useRef(new Set<string>());

    // Land on the hand-in a link pointed at — once.
    useEffect(() => {
        if (!focusPending || !list.data) return;
        setFocusPending(null);
        if (!items.some((item) => item.id === focusPending)) {
            setSelectedId(null);
            toast.info("That hand-in isn't in this list any more — it may have been reviewed already.");
        }
    }, [focusPending, list.data, items]);

    // Side by side, something is always open: the first in line.
    useEffect(() => {
        if (!wide || focusPending || selectedId) return;
        const first = items.find((item) => tab !== "WAITING" || !saved.current.has(item.id));
        if (first) setSelectedId(first.id);
    }, [wide, focusPending, selectedId, items, tab]);

    const choose = async (id: string | null) => {
        if (id === selectedId) {
            if (!wide) setSelectedId(null);
            return;
        }
        if (dirty.current && !(await confirmAction({ title: "Leave this review?", text: "What you've written so far isn't saved.", confirmText: "Leave it" }))) return;
        dirty.current = false;
        setSelectedId(id);
    };
    const resetTo = (change: () => void) => {
        change();
        setSelectedId(null);
    };

    const onSaved = (done: ReviewQueueItem) => {
        dirty.current = false;
        saved.current.add(done.id);
        const index = items.findIndex((item) => item.id === done.id);
        // On to the next in line; elsewhere than "Waiting", stay on it when it's the last.
        const next = items.slice(index + 1).find((item) => !saved.current.has(item.id)) ?? (tab === "WAITING" ? null : done);
        setSelectedId(next?.id ?? null);
        void queryClient.invalidateQueries({ queryKey: ["reviews"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "mentor"] });
        void queryClient.invalidateQueries({ queryKey: ["staff", "results"] });
        if (!next && tab === "WAITING" && !list.hasNextPage) toast.success("That was the last one — all caught up.");
    };

    // A hand-in taken into review (or put back) stays open; the list and its tabs catch up.
    const onClaimChange = () => {
        void queryClient.invalidateQueries({ queryKey: ["reviews"] });
    };

    // ↑ / ↓ (or k / j) walk the queue.
    const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
        const step = event.key === "ArrowDown" || event.key === "j" ? 1 : event.key === "ArrowUp" || event.key === "k" ? -1 : 0;
        if (!step) return;
        const rows = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-review-row]")];
        const from = rows.indexOf(document.activeElement as HTMLButtonElement);
        const target = rows[Math.min(rows.length - 1, Math.max(0, (from < 0 ? -1 : from) + step))];
        if (!target) return;
        event.preventDefault();
        target.focus();
        void choose(target.dataset.reviewRow ?? null);
    };

    const assignmentTitle = items.find((item) => item.assignment.id === assignmentId)?.assignment.title;
    const activeTab = TABS.find((entry) => entry.value === tab) ?? TABS[0];

    return (
        <div className="container-page space-y-5 py-8 sm:py-10">
            <header className="flex flex-wrap items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold sm:text-3xl">Review queue</h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                        {countOf("WAITING") ? (
                            <>
                                <span className="font-medium text-foreground">{countOf("WAITING")} waiting</span> · hand-ins from your courses, students by name only.
                            </>
                        ) : (
                            "Hand-ins from your courses, students by name only."
                        )}
                    </p>
                </div>
                <div role="group" aria-label="Order" className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-1">
                    {(
                        [
                            { value: "asc", label: "Oldest first", icon: ArrowUpNarrowWide },
                            { value: "desc", label: "Newest first", icon: ArrowDownWideNarrow },
                        ] as const
                    ).map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={sortOrder === option.value}
                            onClick={() => resetTo(() => setSortOrder(option.value))}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                                sortOrder === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <option.icon className="size-4" aria-hidden />
                            {option.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div role="group" aria-label="State" className="no-scrollbar relative flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary/60 p-1">
                        {TABS.map((option) => {
                            const count = countOf(option.value);
                            const active = tab === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => resetTo(() => setTab(option.value))}
                                    className={cn(
                                        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {option.label}
                                    {count !== null && (
                                        <span
                                            className={cn(
                                                "min-w-5 rounded-full px-1.5 text-center text-[0.6875rem] font-semibold tabular-nums",
                                                option.value === "WAITING" && count > 0 ? "bg-primary text-primary-foreground" : "bg-card/80 text-muted-foreground",
                                            )}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative min-w-0 flex-1 sm:max-w-xs">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                            type="search"
                            value={searchInput}
                            onChange={(event) => {
                                setSearchInput(event.target.value);
                                setSelectedId(null);
                            }}
                            placeholder="Find a student or assignment"
                            aria-label="Find a student or assignment"
                            className="pl-9"
                        />
                    </div>
                </div>

                {(courses.length > 1 || assignmentId) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {courses.length > 1 && (
                            <>
                                <Chip active={!courseId} onClick={() => resetTo(() => { setCourseId(""); setAssignmentId(""); })}>
                                    All courses
                                </Chip>
                                {courses.map((course) => (
                                    <Chip
                                        key={course.id}
                                        active={courseId === course.id}
                                        onClick={() => resetTo(() => { setCourseId(course.id); setAssignmentId(""); })}
                                        badge={course.stats.toReview || undefined}
                                    >
                                        {course.title}
                                    </Chip>
                                ))}
                            </>
                        )}
                        {assignmentId && (
                            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm text-primary">
                                <span className="truncate">
                                    Only <span className="font-semibold">{assignmentTitle ? `“${assignmentTitle}”` : "one assignment"}</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => resetTo(() => setAssignmentId(""))}
                                    aria-label="Show every assignment"
                                    className="grid size-6 shrink-0 place-items-center rounded-full transition-colors hover:bg-primary/15"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    {list.isLoading ? (
                        <div className="space-y-px p-2">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-16 rounded-lg" />
                            ))}
                        </div>
                    ) : list.isError && !list.data ? (
                        <div className="p-10 text-center">
                            <p className="font-medium">Couldn&apos;t load the queue.</p>
                            <Button variant="outline" className="mt-4" onClick={() => list.refetch()}>
                                Try again
                            </Button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="px-8 py-14 text-center">
                            <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                                <ClipboardCheck className="size-5" aria-hidden />
                            </span>
                            <p className="mt-4 font-medium">{searchTerm ? `Nothing matches “${searchTerm}”.` : tab === "WAITING" ? "All caught up" : "Nothing here"}</p>
                            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{searchTerm ? "Try a name or an assignment title." : activeTab.empty}</p>
                        </div>
                    ) : (
                        <>
                            <p className="border-b border-border bg-secondary/30 px-4 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                                {total} {total === 1 ? "hand-in" : "hand-ins"} · {sortOrder === "asc" ? "oldest first" : "newest first"}
                            </p>
                            <ul aria-label="Hand-ins" onKeyDown={onListKeyDown}>
                                {items.map((item) => {
                                    const active = current?.id === item.id;
                                    const pending = item.status === "SUBMITTED" || item.status === "UNDER_REVIEW";
                                    const wait = elapsed(item.submittedAt, now);
                                    return (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                data-review-row={item.id}
                                                aria-current={active || undefined}
                                                onClick={() => void choose(item.id)}
                                                className={cn(
                                                    "relative flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                                    active ? "bg-primary/6" : "hover:bg-secondary/50",
                                                )}
                                            >
                                                {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
                                                <Avatar name={item.student.name} size={32} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-baseline gap-2">
                                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.student.name}</span>
                                                        {pending ? (
                                                            <span
                                                                className={cn(
                                                                    "shrink-0 text-xs tabular-nums",
                                                                    wait.days >= 2 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                                                                )}
                                                            >
                                                                {wait.text}
                                                            </span>
                                                        ) : (
                                                            <span className={cn("shrink-0 rounded-full px-2 py-px text-[0.6875rem] font-semibold", STATUS_META[item.status].tone)}>
                                                                {item.status === "ACCEPTED" && item.score !== null ? `${item.score}/${item.assignment.totalMarks}` : STATUS_META[item.status].label}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">{item.assignment.title}</span>
                                                    <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                                                        <span className="truncate">{item.assignment.course.title}</span>
                                                        {item.maxScore !== null && <span className="shrink-0 font-medium text-amber-700 dark:text-amber-400">· Late</span>}
                                                        {item.status === "UNDER_REVIEW" && item.reviewedBy && (
                                                            <span className="shrink-0 font-medium text-foreground/80">
                                                                · {item.reviewedBy.id === user?.id ? "You're reviewing" : `${item.reviewedBy.name.split(" ")[0]} reviewing`}
                                                            </span>
                                                        )}
                                                    </span>
                                                </span>
                                            </button>
                                            {!wide && active && current && (
                                                <div className="border-b border-border bg-primary/3 px-4 py-4">
                                                    <MarkingPane key={current.id} submission={current} onSaved={onSaved} onClaimChange={onClaimChange} onDirtyChange={onDirtyChange} compact />
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                            {list.hasNextPage && (
                                <div className="p-2">
                                    <Button variant="ghost" className="w-full" onClick={() => list.fetchNextPage()} isLoading={list.isFetchingNextPage}>
                                        Load more
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {wide && (
                    // No taller than the window: stuck beside a long list, its save button must stay reachable.
                    <aside
                        ref={paneRef}
                        aria-label="Marking"
                        className="min-h-96 rounded-2xl border border-border bg-card shadow-sm lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto"
                    >
                        {current ? (
                            <MarkingPane key={current.id} submission={current} onSaved={onSaved} onClaimChange={onClaimChange} onDirtyChange={onDirtyChange} />
                        ) : (
                            <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
                                <span className="grid size-12 place-items-center rounded-full bg-secondary/70">
                                    <ClipboardCheck className="size-5 text-muted-foreground" aria-hidden />
                                </span>
                                <p className="mt-4 font-medium">{items.length ? "Pick a hand-in to mark it" : "Nothing to mark here"}</p>
                                <p className="mt-6 text-xs text-muted-foreground">
                                    <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono">↑</kbd>{" "}
                                    <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono">↓</kbd> move through the queue
                                </p>
                            </div>
                        )}
                    </aside>
                )}
            </div>
        </div>
    );
}

function Chip({ active, onClick, badge, children }: { active: boolean; onClick: () => void; badge?: number; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                "inline-flex max-w-64 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                active ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            )}
        >
            <span className="truncate">{children}</span>
            {badge !== undefined && <span className="shrink-0 rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold tabular-nums text-primary-foreground">{badge}</span>}
        </button>
    );
}
