"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowRight,
    Award,
    Bell,
    BookOpen,
    CheckCheck,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    CreditCard,
    GraduationCap,
    Headphones,
    ListChecks,
    Megaphone,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import EditorWindow from "@/components/site/EditorWindow";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { linkify } from "@/lib/linkify";
import { paginationRange } from "@/lib/pagination";
import { scrollPageTo } from "@/lib/smoothScroll";
import { cn, formatDateTime } from "@/lib/utils";
import { notificationService } from "@/services";
import type { ApiMeta } from "@/types/api.types";
import type { AppNotification } from "@/types/domain.types";

export const TYPE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    ASSIGNMENT: "warning",
    QUIZ: "warning",
    SUPPORT: "default",
    PAYMENT: "success",
    CERTIFICATE: "success",
    COURSE: "default",
    MODULE: "secondary",
    SYSTEM: "secondary",
    GENERAL: "secondary",
};

/** A broadcast's message, with any raw URL in it as a new-tab link (see `linkify`). */
export const linkifyMessage = linkify;

/**
 * Each kind of notification in plain words, with the icon tile it wears in
 * the list (tinted in a syntax colour, like a file icon in an editor) and
 * what its "open" button says when it carries a link.
 */
const TYPE_META: Record<string, { label: string; icon: LucideIcon; tone: string; action: string }> = {
    GENERAL: { label: "Announcement", icon: Megaphone, tone: "bg-syn-number/12 text-syn-number", action: "Open" },
    SYSTEM: { label: "Update", icon: Megaphone, tone: "bg-syn-tag/12 text-syn-tag", action: "Open" },
    SUPPORT: { label: "Support", icon: Headphones, tone: "bg-syn-func/12 text-syn-func", action: "Open support" },
    MODULE: { label: "New module", icon: BookOpen, tone: "bg-syn-keyword/12 text-syn-keyword", action: "Open the course" },
    COURSE: { label: "Course", icon: GraduationCap, tone: "bg-syn-keyword/12 text-syn-keyword", action: "Open" },
    ASSIGNMENT: { label: "Assignment", icon: ClipboardCheck, tone: "bg-syn-number/12 text-syn-number", action: "Open the assignment" },
    QUIZ: { label: "Quiz", icon: ListChecks, tone: "bg-syn-number/12 text-syn-number", action: "Open the quiz" },
    PAYMENT: { label: "Payment", icon: CreditCard, tone: "bg-syn-string/12 text-syn-string", action: "View the order" },
    CERTIFICATE: { label: "Certificate", icon: Award, tone: "bg-syn-string/12 text-syn-string", action: "View the certificate" },
};

const typeMeta = (type: string) => TYPE_META[type] ?? TYPE_META.GENERAL;

/** Few enough that the list and the open message sit side by side without the list scrolling far. */
const PAGE_SIZE = 6;

/** Tailwind's `lg` — where the list and the message stand side by side. */
const SIDE_BY_SIDE = "(min-width: 64rem)";

function TypeTile({ type, size = "md" }: { type: string; size?: "md" | "lg" }) {
    const { icon: Icon, tone } = typeMeta(type);
    return (
        <span
            aria-hidden
            className={cn(
                "grid shrink-0 place-items-center rounded-md",
                size === "lg" ? "size-12 [&_svg]:size-6" : "size-9 [&_svg]:size-4.5",
                tone,
            )}
        >
            <Icon />
        </span>
    );
}

/**
 * The student's full-page notification inbox (`/dashboard/announcements`),
 * laid out as a notice board: the list on the left — an icon, the title, two
 * lines of the message, when it came — and the one picked, in full, on the
 * right; numbered pages under both. `notificationService.list` is already
 * scoped to "my notifications" on the API side. The staff consoles use the
 * shared staff inbox instead (`components/shared/inbox/Inbox`, as `AdminInbox`
 * and `MentorInbox`).
 *
 * The page and the open message live in the address (`?page=5&id=…`), so a
 * link can open one directly and Back steps through pages. Opening one by
 * click or by link marks it read; the first row, shown by default, isn't.
 *
 * The header bell (`NotificationsDropdown`) covers the same data at a
 * glance; this is for reading one in full without it scrolling out of a
 * 384px popover.
 */
export default function AnnouncementsView() {
    // `useSearchParams` leaves this part to the browser; until then, the loading board.
    return (
        <Suspense fallback={<BoardSkeleton />}>
            <AnnouncementsBoard />
        </Suspense>
    );
}

function AnnouncementsBoard() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const boardRef = useRef<HTMLDivElement>(null);
    const detailRef = useRef<HTMLDivElement>(null);

    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "", 10) || 1);
    const idParam = searchParams.get("id");

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["notifications", "list", page],
        queryFn: () => notificationService.list({ page, limit: PAGE_SIZE }),
        placeholderData: keepPreviousData,
    });

    const { data: unread } = useQuery({
        queryKey: ["notifications", "unread-count"],
        queryFn: notificationService.unreadCount,
    });
    const unreadCount = unread?.count ?? 0;

    const notifications = useMemo(() => data?.data ?? [], [data]);
    const meta = data?.meta;

    // The one in the address, else the page's first — a blank right pane when
    // the list clearly isn't empty reads as broken.
    const selected = notifications.find((item) => item.id === idParam) ?? notifications[0] ?? null;

    const goTo = (next: { page: number; id: string | null }, mode: "push" | "replace") => {
        const params = new URLSearchParams();
        if (next.id) params.set("id", next.id);
        if (next.page > 1) params.set("page", String(next.page));
        const query = params.toString();
        router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
    };

    // An address past the last page (a stale link, or the list got shorter): the last page.
    const totalPages = meta?.totalPages;
    const pastTheEnd = totalPages !== undefined && page > Math.max(totalPages, 1);
    useEffect(() => {
        if (pastTheEnd) goTo({ page: Math.max(totalPages ?? 1, 1), id: null }, "replace");
        // `goTo` is rebuilt every render; only these values decide whether to move.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pastTheEnd, totalPages]);

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    const { mutate: markRead } = useMutation({
        mutationFn: (id: string) => notificationService.markRead(id),
        onSuccess: invalidate,
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update that.")),
    });

    const markAllRead = useMutation({
        mutationFn: notificationService.markAllRead,
        onSuccess: () => {
            toast.success("All caught up.");
            invalidate();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't mark them read.")),
    });

    // Opened on purpose (a click, or a link with `?id=`) and still unread: mark
    // it read, once — the list refetches after, and the ref keeps the gap
    // between from sending it twice.
    const requested = useRef(new Set<string>());
    const openedUnreadId = notifications.find((item) => item.id === idParam && !item.isRead)?.id;
    useEffect(() => {
        if (!openedUnreadId || requested.current.has(openedUnreadId)) return;
        requested.current.add(openedUnreadId);
        markRead(openedUnreadId, { onError: () => requested.current.delete(openedUnreadId) });
    }, [openedUnreadId, markRead]);

    const open = (notification: AppNotification) => {
        goTo({ page, id: notification.id }, "replace");
        // Stacked on a phone, the message is under the whole list: bring it up.
        if (!window.matchMedia(SIDE_BY_SIDE).matches) {
            detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    const changePage = (next: number) => {
        goTo({ page: next, id: null }, "push");
        const top = boardRef.current?.getBoundingClientRect().top;
        if (top !== undefined && top < 0) scrollPageTo(window.scrollY + top - 96);
    };

    if (isLoading || pastTheEnd) return <BoardSkeleton />;

    if (notifications.length === 0) {
        return (
            <EditorWindow tone="light" tabs={[{ name: "announcements.md", label: "Announcements", active: true }]} className="shadow-card">
                <h1 className="sr-only">Announcements</h1>
                <div className="px-6 py-16 text-center">
                    <span className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-secondary text-muted-foreground">
                        <Bell className="size-6" aria-hidden />
                    </span>
                    <p className="font-semibold">No announcements yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        We&apos;ll post new modules, assignment feedback and support sessions here.
                    </p>
                </div>
            </EditorWindow>
        );
    }

    const selectedMeta = selected ? typeMeta(selected.type) : null;

    return (
        <div ref={boardRef} className="space-y-8">
            <h1 className="sr-only">Announcements</h1>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: the list */}
                <EditorWindow
                    tone="light"
                    tabs={[{ name: "announcements.md", label: "Announcements", active: true }]}
                    actions={
                        unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-primary"
                                onClick={() => markAllRead.mutate()}
                                isLoading={markAllRead.isPending}
                            >
                                <CheckCheck /> Mark all read
                            </Button>
                        )
                    }
                    status={
                        <>
                            <span>{unreadCount > 0 ? `${unreadCount} unread` : "All read"}</span>
                            {meta && <span>Page {meta.page} of {Math.max(meta.totalPages, 1)}</span>}
                        </>
                    }
                    className="shadow-card"
                >
                    <ul
                        className={cn("divide-y divide-border transition-opacity", isFetching && !isLoading && "opacity-60")}
                        aria-busy={isFetching}
                    >
                        {notifications.map((notification) => {
                            const isActive = notification.id === selected?.id;
                            return (
                                <li key={notification.id}>
                                    <button
                                        type="button"
                                        onClick={() => open(notification)}
                                        aria-current={isActive || undefined}
                                        className={cn(
                                            "relative flex w-full gap-4 px-5 py-5 text-left transition-colors sm:px-6",
                                            isActive ? "bg-secondary" : "hover:bg-secondary/60",
                                        )}
                                    >
                                        {isActive && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
                                        <TypeTile type={notification.type} />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-start justify-between gap-3">
                                                <span className="font-semibold leading-snug">{notification.title}</span>
                                                {!notification.isRead && (
                                                    <span className="mt-0.5 shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase leading-none text-primary">
                                                        New
                                                    </span>
                                                )}
                                            </span>
                                            <span className="mt-1.5 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                                                {notification.message}
                                            </span>
                                            <time
                                                dateTime={notification.createdAt}
                                                className="mt-2.5 block font-mono text-xs text-muted-foreground"
                                            >
                                                {formatDateTime(notification.createdAt)}
                                            </time>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </EditorWindow>

                {/* Right: the one picked, in full */}
                <div ref={detailRef} className="scroll-mt-24">
                    {selected && selectedMeta && (
                        <EditorWindow
                            tone="light"
                            tabs={[{ name: `${selected.type.toLowerCase()}.md`, label: selectedMeta.label, active: true }]}
                            status={
                                <>
                                    <span className="truncate">From {selected.sender?.name ?? "Half Coders"}</span>
                                    <span>{selectedMeta.label}</span>
                                </>
                            }
                            className="h-full shadow-card"
                        >
                            <article key={selected.id} className="animate-in fade-in px-6 py-8 duration-300 motion-reduce:animate-none sm:px-10 sm:py-10">
                                <header className="flex flex-col items-center text-center">
                                    <TypeTile type={selected.type} size="lg" />
                                    <h2 className="mt-4 text-2xl font-bold leading-snug text-balance">{selected.title}</h2>
                                    <time dateTime={selected.createdAt} className="mt-2 font-mono text-xs text-muted-foreground">
                                        {formatDateTime(selected.createdAt)}
                                    </time>
                                </header>

                                <hr className="my-6 border-dashed border-border" />

                                <p className="whitespace-pre-wrap leading-relaxed wrap-break-word">{linkifyMessage(selected.message)}</p>

                                {selected.link && (
                                    <Button asChild variant="brand" className="mt-8">
                                        <Link href={selected.link}>
                                            {selectedMeta.action} <ArrowRight />
                                        </Link>
                                    </Button>
                                )}
                            </article>
                        </EditorWindow>
                    )}
                </div>
            </div>

            <Pagination meta={meta} disabled={isFetching} onPage={changePage} />
        </div>
    );
}

/** Numbered pages, centred under the board: ‹ 1 … 4 5 6 … 34 ›. */
function Pagination({ meta, disabled, onPage }: { meta: ApiMeta | undefined; disabled: boolean; onPage: (page: number) => void }) {
    if (!meta || meta.totalPages <= 1) return null;
    const { page, totalPages } = meta;
    const square = "grid size-9 place-items-center rounded-md border font-mono text-sm tabular-nums transition-colors sm:size-10";

    return (
        <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pages">
            <button
                type="button"
                className={cn(square, "border-border bg-card hover:border-primary/40 hover:bg-secondary disabled:pointer-events-none disabled:opacity-40")}
                disabled={page <= 1 || disabled}
                onClick={() => onPage(page - 1)}
                aria-label="Previous page"
            >
                <ChevronLeft className="size-4" />
            </button>

            {paginationRange(page, totalPages).map((entry, index) =>
                entry === "…" ? (
                    <span key={`dots-${index}`} className="grid size-9 place-items-center text-sm text-muted-foreground sm:size-10">
                        …
                    </span>
                ) : (
                    <button
                        key={entry}
                        type="button"
                        aria-current={entry === page ? "page" : undefined}
                        aria-label={`Page ${entry}`}
                        disabled={disabled && entry !== page}
                        onClick={() => entry !== page && onPage(entry)}
                        className={cn(
                            square,
                            entry === page
                                ? "border-primary bg-primary font-semibold text-primary-foreground"
                                : "border-border bg-card hover:border-primary/40 hover:bg-secondary",
                        )}
                    >
                        {entry}
                    </button>
                ),
            )}

            <button
                type="button"
                className={cn(square, "border-border bg-card hover:border-primary/40 hover:bg-secondary disabled:pointer-events-none disabled:opacity-40")}
                disabled={page >= totalPages || disabled}
                onClick={() => onPage(page + 1)}
                aria-label="Next page"
            >
                <ChevronRight className="size-4" />
            </button>
        </nav>
    );
}

/** The board while the first page loads: the same two windows, rows and a message sketched in. */
function BoardSkeleton() {
    return (
        <div className="grid gap-6 lg:grid-cols-2" aria-busy aria-label="Loading announcements">
            <EditorWindow tone="light" tabs={[{ name: "announcements.md", label: "Announcements", active: true }]} className="shadow-card">
                <div className="divide-y divide-border">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex gap-4 px-5 py-5 sm:px-6">
                            <Skeleton className="size-9 rounded-md" />
                            <div className="flex-1 space-y-2.5">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-4/5" />
                                <Skeleton className="h-3 w-28" />
                            </div>
                        </div>
                    ))}
                </div>
            </EditorWindow>

            <EditorWindow tone="light" tabs={[{ name: "message.md", label: "Message", active: true }]} className="hidden shadow-card lg:flex">
                <div className="px-10 py-10">
                    <Skeleton className="mx-auto size-12 rounded-md" />
                    <Skeleton className="mx-auto mt-4 h-6 w-1/2" />
                    <Skeleton className="mx-auto mt-3 h-3 w-32" />
                    <SkeletonLines lines={5} className="mt-10" />
                </div>
            </EditorWindow>
        </div>
    );
}
