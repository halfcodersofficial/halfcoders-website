"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import {
    ArrowRight,
    Award,
    BookOpen,
    CheckCheck,
    ClipboardList,
    CreditCard,
    Headphones,
    Inbox as InboxIcon,
    Layers,
    Mail,
    MailOpen,
    Megaphone,
    Settings2,
    Trash2,
    type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { linkifyMessage } from "@/components/shared/AnnouncementsView";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ConsoleEyebrow from "@/components/shared/ConsoleEyebrow";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { notificationService } from "@/services";
import type { ApiMeta } from "@/types/api.types";
import type { AppNotification, UnreadCount } from "@/types/domain.types";

export interface InboxFilter {
    value: string;
    label: string;
    /** What the list asks the API for: `{ isRead: "false" }`, `{ type: [...] }`. */
    params: Record<string, string | string[]>;
    /** The unread types counted on the tab; "all" for the Unread tab, none for All. */
    counts?: string[] | "all";
    empty: { title: string; text: string };
}

export interface InboxConfig {
    title: string;
    /** After "3 unread · " in the header: what lands here. */
    blurb: string;
    /** The first is "everything". */
    filters: InboxFilter[];
    /** The primary action's words for a link — "Review them", "Open the payment". */
    actionFor: (notification: AppNotification) => string;
    /** Per-console names for a type, over the defaults. */
    types?: Partial<Record<string, TypeMeta>>;
    /** Live context under the message — what the notification is about, as it stands now. */
    Context?: ComponentType<{ notification: AppNotification }>;
}

interface TypeMeta {
    label: string;
    /** In a sentence: "2 course updates waiting". */
    noun: string;
    icon: LucideIcon;
}

const TYPES: Record<string, TypeMeta> = {
    PAYMENT: { label: "Payment", noun: "payment", icon: CreditCard },
    COURSE: { label: "Course", noun: "course update", icon: BookOpen },
    MODULE: { label: "Module", noun: "module update", icon: Layers },
    ASSIGNMENT: { label: "Assignment", noun: "assignment update", icon: ClipboardList },
    SUPPORT: { label: "Support", noun: "support update", icon: Headphones },
    CERTIFICATE: { label: "Certificate", noun: "certificate update", icon: Award },
    SYSTEM: { label: "System", noun: "system notice", icon: Settings2 },
    GENERAL: { label: "Announcement", noun: "announcement", icon: Megaphone },
};

const dayOf = (iso: string) => {
    const date = new Date(iso);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    if (differenceInCalendarDays(new Date(), date) < 7) return format(date, "EEEE");
    return format(date, "d MMMM yyyy");
};

/** Unread and under five minutes old — just arrived, most likely live over the socket. */
const isFresh = (notification: AppNotification) =>
    !notification.isRead && Date.now() - new Date(notification.createdAt).getTime() < 5 * 60_000;

type Page = { data: AppNotification[]; meta?: ApiMeta };

const Kbd = ({ children }: { children: ReactNode }) => (
    <kbd className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.6875rem]">{children}</kbd>
);

/**
 * A staff inbox — the admin's and the mentor's, from one component and a
 * config each: a day-by-day list beside a reading pane (inline under the row
 * on a phone), filter tabs that carry their own unread counts, and the one
 * thing to do about each notification a click away, with whatever live
 * context the console adds. Keyboard: ↑ ↓ / j k to move, o to open, u for
 * read/unread, Delete to delete. Live: the notification socket invalidates
 * `["notifications"]`, which every query here sits under.
 */
export default function Inbox({ config }: { config: InboxConfig }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [filterValue, setFilterValue] = useState(config.filters[0].value);
    const [selected, setSelected] = useState<AppNotification | null>(null);
    const filter = config.filters.find((entry) => entry.value === filterValue) ?? config.filters[0];
    const typeOf = (notification: AppNotification) => config.types?.[notification.type] ?? TYPES[notification.type] ?? TYPES.GENERAL;

    // Shared with the sidebar badge, so it's one request between them.
    const unread = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: notificationService.unreadCount });
    const unreadCount = unread.data?.count ?? 0;
    const tabCount = (entry: InboxFilter) =>
        entry.counts === "all" ? unreadCount : (entry.counts ?? []).reduce((sum, type) => sum + (unread.data?.byType?.[type] ?? 0), 0);

    const list = useInfiniteQuery({
        queryKey: ["notifications", "inbox", filter.value],
        queryFn: ({ pageParam }): Promise<Page> => notificationService.list({ page: pageParam, limit: 20, ...filter.params }),
        initialPageParam: 1,
        getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    });

    // Pages are counted from the newest, so one arriving between two page
    // loads shifts the next page by a row — drop the repeat.
    const items = useMemo(() => {
        const seen = new Set<string>();
        return (list.data?.pages.flatMap((page) => page.data) ?? []).filter((item) => !seen.has(item.id) && seen.add(item.id));
    }, [list.data]);

    // The open one, kept even after it leaves the list (read, under "Unread").
    const current = selected ? (items.find((item) => item.id === selected.id) ?? selected) : null;

    const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["notifications"] });

    /** Shows the change straight away, ahead of the refetch. */
    const showRead = (ids: string[] | "all", isRead: boolean) => {
        const touched = items.filter((item) => (ids === "all" || ids.includes(item.id)) && item.isRead !== isRead);
        queryClient.setQueriesData<InfiniteData<Page>>({ queryKey: ["notifications", "inbox"] }, (data) =>
            data
                ? {
                    ...data,
                    pages: data.pages.map((page) => ({
                        ...page,
                        data: page.data.map((item) => (ids === "all" || ids.includes(item.id) ? { ...item, isRead } : item)),
                    })),
                }
                : data,
        );
        queryClient.setQueryData<UnreadCount>(["notifications", "unread-count"], (count) => {
            if (!count) return count;
            if (ids === "all") return { count: 0, byType: {} };
            const byType = { ...count.byType };
            for (const item of touched) byType[item.type] = Math.max(0, (byType[item.type] ?? 0) + (isRead ? -1 : 1));
            return { count: Math.max(0, count.count + (isRead ? -touched.length : touched.length)), byType };
        });
    };

    const markRead = useMutation({
        mutationFn: (id: string) => notificationService.markRead(id),
        onMutate: (id) => showRead([id], true),
        onSettled: invalidate,
    });

    const markUnread = useMutation({
        mutationFn: (id: string) => notificationService.markUnread(id),
        onMutate: (id) => showRead([id], false),
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't mark that unread.")),
        onSettled: invalidate,
    });

    const markAllRead = useMutation({
        mutationFn: notificationService.markAllRead,
        onMutate: () => showRead("all", true),
        onSuccess: () => toast.success("All caught up."),
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't mark them read.")),
        onSettled: invalidate,
    });

    const remove = useMutation({
        mutationFn: (notification: AppNotification) => notificationService.remove(notification.id),
        onSuccess: (_result, notification) => {
            if (selected?.id === notification.id) {
                const index = items.findIndex((item) => item.id === notification.id);
                setSelected(items[index + 1] ?? items[index - 1] ?? null);
            }
            toast.success("Deleted.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't delete that.")),
        onSettled: invalidate,
    });

    const clearRead = useMutation({
        mutationFn: notificationService.clearRead,
        onSuccess: (count) => {
            if (selected?.isRead || (selected && !items.some((item) => item.id === selected.id))) setSelected(null);
            toast.success(count === 0 ? "Nothing read to clear." : `Cleared ${count} read notification${count === 1 ? "" : "s"}.`);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't clear them.")),
        onSettled: invalidate,
    });

    const select = (notification: AppNotification) => {
        setSelected(notification);
        if (!notification.isRead) markRead.mutate(notification.id);
    };

    const open = (notification: AppNotification) => {
        if (!notification.isRead) markRead.mutate(notification.id);
        if (notification.link) router.push(notification.link);
    };

    // "Later": back to unread, and closed, so reading on doesn't mark it again.
    const toggleRead = (notification: AppNotification) => {
        if (notification.isRead) {
            markUnread.mutate(notification.id);
            setSelected(null);
        } else {
            markRead.mutate(notification.id);
        }
    };

    const askClearRead = async () => {
        const confirmed = await confirmAction({
            title: "Clear everything you've read?",
            text: "Read notifications are deleted for good. Unread ones stay.",
            confirmText: "Clear read",
        });
        if (confirmed) clearRead.mutate();
    };

    // ↑ / ↓ (or k / j) walk the list; o opens, u flips read, Delete deletes.
    const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const rows = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-inbox-row]")];
        const from = rows.indexOf(document.activeElement as HTMLButtonElement);
        const focused = from >= 0 ? items.find((item) => item.id === rows[from].dataset.inboxRow) : undefined;

        if (focused && (event.key === "o" || event.key === "u" || event.key === "Delete")) {
            event.preventDefault();
            if (event.key === "o") open(focused);
            else if (event.key === "u") toggleRead(focused);
            else remove.mutate(focused);
            return;
        }

        const step = event.key === "ArrowDown" || event.key === "j" ? 1 : event.key === "ArrowUp" || event.key === "k" ? -1 : 0;
        if (!step) return;
        const target = rows[Math.min(rows.length - 1, Math.max(0, (from < 0 ? -1 : from) + step))];
        if (!target) return;
        event.preventDefault();
        target.focus();
        const notification = items.find((item) => item.id === target.dataset.inboxRow);
        if (notification) select(notification);
    };

    // Rows under day headings, the heading drawn where the day changes.
    const rows = items.map((item, index) => ({
        item,
        day: index === 0 || dayOf(items[index - 1].createdAt) !== dayOf(item.createdAt) ? dayOf(item.createdAt) : null,
    }));

    const pane = (notification: AppNotification, compact = false) => (
        <ReadingPane
            key={notification.id}
            notification={notification}
            meta={typeOf(notification)}
            action={notification.link ? config.actionFor(notification) : null}
            Context={config.Context}
            onOpen={() => open(notification)}
            onToggleRead={() => toggleRead(notification)}
            onDelete={() => remove.mutate(notification)}
            deleting={remove.isPending}
            compact={compact}
        />
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none">
                <div className="min-w-0">
                    <ConsoleEyebrow />
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{config.title}</h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                        {unreadCount > 0 ? <span className="font-medium text-foreground">{unreadCount} unread · </span> : "All caught up · "}
                        {config.blurb}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {unreadCount > 0 && (
                        <Button variant="outline" onClick={() => markAllRead.mutate()} isLoading={markAllRead.isPending}>
                            {!markAllRead.isPending && <CheckCheck />} Mark all read
                        </Button>
                    )}
                    <Button variant="ghost" onClick={askClearRead} isLoading={clearRead.isPending} className="text-muted-foreground">
                        {!clearRead.isPending && <Trash2 />} Clear read
                    </Button>
                </div>
            </header>

            <div role="group" aria-label="Filter" className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-md bg-secondary/60 p-1">
                {config.filters.map((option) => {
                    const count = tabCount(option);
                    const active = filter.value === option.value;
                    return (
                        <button
                            key={option.value || "all"}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setFilterValue(option.value)}
                            className={cn(
                                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {option.label}
                            {count > 0 && (
                                <span
                                    className={cn(
                                        "min-w-5 rounded-sm px-1.5 text-center text-[0.6875rem] font-semibold tabular-nums",
                                        active || option.counts === "all" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                                    )}
                                >
                                    {count > 99 ? "99+" : count}
                                    <span className="sr-only"> unread</span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
                <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                    {list.isLoading ? (
                        <div className="space-y-px p-2">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-16 rounded-md" />
                            ))}
                        </div>
                    ) : list.isError && !list.data ? (
                        // Only with nothing to show: a failed background refetch keeps the list.
                        <div className="p-10 text-center">
                            <p className="font-medium">Couldn&apos;t load your notifications.</p>
                            <Button variant="outline" className="mt-4" onClick={() => list.refetch()}>
                                Try again
                            </Button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="px-8 py-14 text-center">
                            <span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary/70">
                                <InboxIcon className="size-5 text-muted-foreground" aria-hidden />
                            </span>
                            <p className="mt-4 font-medium">{filter.empty.title}</p>
                            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{filter.empty.text}</p>
                        </div>
                    ) : (
                        <>
                            <ul aria-label={config.title} onKeyDown={onListKeyDown}>
                                {rows.map(({ item, day }) => (
                                    <li key={item.id}>
                                        {day && (
                                            <p className="border-b border-border bg-secondary/30 px-4 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                                                {day}
                                            </p>
                                        )}
                                        <InboxRow notification={item} meta={typeOf(item)} active={current?.id === item.id} onSelect={() => select(item)} />
                                        {current?.id === item.id && (
                                            <div className="border-b border-border bg-primary/3 px-4 py-4 lg:hidden">{pane(current, true)}</div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {list.hasNextPage && (
                                <div className="border-t border-border p-2">
                                    <Button variant="ghost" className="w-full" onClick={() => list.fetchNextPage()} isLoading={list.isFetchingNextPage}>
                                        Load older
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <aside aria-label="Reading pane" className="hidden min-h-96 rounded-card border border-border bg-card shadow-card lg:sticky lg:top-8 lg:block">
                    {current ? pane(current) : <IdlePane unreadCount={unreadCount} items={items} typeOf={typeOf} />}
                </aside>
            </div>
        </div>
    );
}

function InboxRow({
    notification,
    meta,
    active,
    onSelect,
}: {
    notification: AppNotification;
    meta: TypeMeta;
    active: boolean;
    onSelect: () => void;
}) {
    const Icon = meta.icon;
    const unread = !notification.isRead;

    return (
        <button
            type="button"
            data-inbox-row={notification.id}
            onClick={onSelect}
            aria-current={active || undefined}
            className={cn(
                "relative flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                active ? "bg-primary/6" : "hover:bg-secondary/50",
            )}
        >
            {unread && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
            <span
                className={cn(
                    "mt-0.5 grid size-9 shrink-0 place-items-center rounded-md",
                    unread ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
                )}
                title={meta.label}
            >
                <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-semibold" : "font-medium text-foreground/80")}>
                        {unread && <span className="sr-only">Unread: </span>}
                        {notification.title}
                    </span>
                    {isFresh(notification) && (
                        <span className="shrink-0 rounded-sm bg-primary px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide text-primary-foreground">
                            New
                        </span>
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{format(new Date(notification.createdAt), "HH:mm")}</span>
                </span>
                <span className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{notification.message}</span>
            </span>
        </button>
    );
}

function ReadingPane({
    notification,
    meta,
    action,
    Context,
    onOpen,
    onToggleRead,
    onDelete,
    deleting,
    compact = false,
}: {
    notification: AppNotification;
    meta: TypeMeta;
    action: string | null;
    Context?: ComponentType<{ notification: AppNotification }>;
    onOpen: () => void;
    onToggleRead: () => void;
    onDelete: () => void;
    deleting: boolean;
    compact?: boolean;
}) {
    const Icon = meta.icon;
    const size = compact ? "sm" : "default";

    return (
        <article className="animate-in fade-in duration-300 motion-reduce:animate-none">
            <div className={cn(!compact && "p-6 lg:p-8")}>
                {!compact && (
                    <>
                        <div className="flex items-center gap-3">
                            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                <Icon className="size-5" aria-hidden />
                            </span>
                            <p className="min-w-0 text-xs text-muted-foreground">
                                <span className="block font-semibold uppercase tracking-wider text-foreground">{meta.label}</span>
                                <time dateTime={notification.createdAt} title={formatDateTime(notification.createdAt)}>
                                    {formatDateTime(notification.createdAt)} · {formatDistanceToNowStrict(new Date(notification.createdAt), { addSuffix: true })}
                                </time>
                            </p>
                        </div>
                        <h2 className="mt-5 text-balance text-xl font-semibold leading-snug sm:text-2xl">{notification.title}</h2>
                        {notification.sender && (
                            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary/60 py-1 pl-1 pr-3 text-xs">
                                <Avatar src={notification.sender.image} name={notification.sender.name} size={20} />
                                <span>
                                    From <span className="font-medium">{notification.sender.name}</span>
                                </span>
                            </p>
                        )}
                    </>
                )}

                <p className={cn("whitespace-pre-wrap text-sm leading-relaxed text-foreground", !compact && "mt-4")}>
                    {linkifyMessage(notification.message)}
                </p>

                {Context && (
                    <div className={compact ? "mt-4" : "mt-6"}>
                        <Context notification={notification} />
                    </div>
                )}

                <div className={cn("flex flex-wrap items-center gap-2", compact ? "mt-4" : "mt-8")}>
                    {action && (
                        <Button size={size} onClick={onOpen}>
                            {action} <ArrowRight />
                        </Button>
                    )}
                    <Button variant="ghost" size={size} onClick={onToggleRead}>
                        {notification.isRead ? <Mail /> : <MailOpen />}
                        {notification.isRead ? "Mark unread" : "Mark read"}
                    </Button>
                    <Button
                        variant="ghost"
                        size={size}
                        onClick={onDelete}
                        isLoading={deleting}
                        className="text-destructive hover:bg-destructive/10"
                    >
                        {!deleting && <Trash2 />} Delete
                    </Button>
                </div>
            </div>

            {!compact && (
                <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-6 py-3 text-xs text-muted-foreground lg:px-8">
                    {action && (
                        <span>
                            <Kbd>o</Kbd> open
                        </span>
                    )}
                    <span>
                        <Kbd>u</Kbd> {notification.isRead ? "mark unread" : "mark read"}
                    </span>
                    <span>
                        <Kbd>Del</Kbd> delete
                    </span>
                    <span>
                        <Kbd>↑</Kbd> <Kbd>↓</Kbd> next
                    </span>
                </p>
            )}
        </article>
    );
}

/** With nothing open: where things stand, in a sentence, and how to move around. */
function IdlePane({
    unreadCount,
    items,
    typeOf,
}: {
    unreadCount: number;
    items: AppNotification[];
    typeOf: (notification: AppNotification) => TypeMeta;
}) {
    const unreadByType = items
        .filter((item) => !item.isRead)
        .reduce<Record<string, number>>((counts, item) => {
            const noun = typeOf(item).noun;
            counts[noun] = (counts[noun] ?? 0) + 1;
            return counts;
        }, {});
    const parts = Object.entries(unreadByType).map(([noun, count]) => `${count} ${noun}${count === 1 ? "" : "s"}`);

    return (
        <div className="flex h-full min-h-96 flex-col items-center justify-center p-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-secondary/70">
                <InboxIcon className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <p className="mt-4 font-medium">{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {parts.length > 0 ? `${parts.join(", ")} waiting. Pick one to read it.` : "Pick a notification to read it here."}
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> move between them · <Kbd>o</Kbd> open · <Kbd>u</Kbd> read / unread
            </p>
        </div>
    );
}
