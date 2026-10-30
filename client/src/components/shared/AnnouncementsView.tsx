"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { notificationService } from "@/services";
import type { AppNotification } from "@/types/domain.types";

export const TYPE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    ASSIGNMENT: "warning",
    SUPPORT: "default",
    PAYMENT: "success",
    CERTIFICATE: "success",
    COURSE: "default",
    MODULE: "secondary",
    SYSTEM: "secondary",
    GENERAL: "secondary",
};

const PAGE_SIZE = 12;

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

/**
 * A broadcast's message is free-text an admin typed, sometimes with a raw
 * URL in it ("More info: https://…") rather than the structured `link`
 * field. Turning those into real, new-tab anchors is what makes them usable
 * instead of just visually implying they're clickable.
 */
export const linkifyMessage = (text: string) =>
    text.split(URL_PATTERN).map((part, index) => {
        if (!part.startsWith("http://") && !part.startsWith("https://")) return part;

        const trailingMatch = part.match(TRAILING_PUNCTUATION);
        const trailing = trailingMatch ? trailingMatch[0] : "";
        const url = trailing ? part.slice(0, -trailing.length) : part;

        return (
            <span key={index}>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                    {url}
                </a>
                {trailing}
            </span>
        );
    });

/**
 * The student's full-page notification inbox (`/dashboard/announcements`): a
 * list on the left, the full message on the right — `notificationService.list`
 * is already scoped to "my notifications" on the API side. The staff consoles
 * use the shared staff inbox instead (`components/shared/inbox/Inbox`, as
 * `AdminInbox` and `MentorInbox`).
 *
 * The header bell (`NotificationsDropdown`) covers the same data at a
 * glance; this is for reading one in full without it scrolling out of a
 * 384px popover.
 */
export default function AnnouncementsView() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["notifications", "list", page],
        queryFn: () => notificationService.list({ page, limit: PAGE_SIZE }),
        placeholderData: keepPreviousData,
    });

    const notifications = useMemo(() => data?.data ?? [], [data]);
    const meta = data?.meta;
    const unreadCount = notifications.filter((item) => !item.isRead).length;

    // Land on the first row once a page finishes loading and nothing on it is
    // selected yet (first paint, or the old selection fell off this page) — a
    // blank right pane when the list clearly isn't empty reads as broken.
    useEffect(() => {
        if (isLoading) return;
        if (notifications.some((item) => item.id === selectedId)) return;
        setSelectedId(notifications[0]?.id ?? null);
    }, [isLoading, notifications, selectedId]);

    const selected = notifications.find((item) => item.id === selectedId) ?? null;

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    const markRead = useMutation({
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

    const select = (notification: AppNotification) => {
        setSelectedId(notification.id);
        if (!notification.isRead) markRead.mutate(notification.id);
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Announcements</h1>
                    <p className="mt-1 text-muted-foreground">
                        {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
                    </p>
                </div>

                {unreadCount > 0 && (
                    <Button variant="outline" onClick={() => markAllRead.mutate()} isLoading={markAllRead.isPending}>
                        <CheckCheck className="size-4" /> Mark all read
                    </Button>
                )}
            </header>

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
                {/* Left: the list */}
                <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
                    {isLoading ? (
                        <div className="space-y-2 p-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-20" />
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-10 text-center">
                            <Bell className="mx-auto mb-3 size-10 text-muted-foreground" />
                            <p className="font-medium">Nothing here yet.</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                We&apos;ll tell you about new modules, assignment feedback and support sessions.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-border">
                            {notifications.map((notification) => {
                                const isActive = notification.id === selectedId;
                                return (
                                    <li key={notification.id}>
                                        <button
                                            type="button"
                                            onClick={() => select(notification)}
                                            aria-current={isActive}
                                            className={cn(
                                                "block w-full border-l-2 px-4 py-3.5 text-left transition-colors hover:bg-secondary",
                                                isActive
                                                    ? "border-primary bg-primary/5"
                                                    : "border-transparent",
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className={cn(
                                                        "truncate font-medium",
                                                        !notification.isRead && "text-primary",
                                                    )}
                                                >
                                                    {notification.title}
                                                </span>
                                                {!notification.isRead && (
                                                    <span
                                                        className="size-1.5 shrink-0 rounded-full bg-primary"
                                                        aria-label="Unread"
                                                    />
                                                )}
                                            </span>
                                            <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                                                {notification.message}
                                            </span>
                                            <span className="mt-1.5 block text-xs text-muted-foreground">
                                                {formatDateTime(notification.createdAt)}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {meta && meta.totalPages > 1 && (
                        <nav
                            className="flex items-center justify-between gap-2 border-t border-border px-4 py-3"
                            aria-label="Pagination"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || isFetching}
                                onClick={() => setPage((current) => current - 1)}
                            >
                                <ChevronLeft /> Prev
                            </Button>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {meta.page} / {meta.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= meta.totalPages || isFetching}
                                onClick={() => setPage((current) => current + 1)}
                            >
                                Next <ChevronRight />
                            </Button>
                        </nav>
                    )}
                </div>

                {/* Right: the preview */}
                <div className="min-h-105 rounded-md border border-border bg-card p-6 shadow-card lg:sticky lg:top-6 lg:p-8">
                    {selected ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={TYPE_VARIANT[selected.type] ?? "secondary"}>{selected.type}</Badge>
                                <span className="text-sm text-muted-foreground">
                                    {formatDateTime(selected.createdAt)}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold">{selected.title}</h2>
                            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                                {linkifyMessage(selected.message)}
                            </p>
                        </div>
                    ) : (
                        <div className="flex h-full min-h-92.5 flex-col items-center justify-center text-center text-muted-foreground">
                            <Megaphone className="mb-3 size-10" />
                            <p className="font-medium text-foreground">Select an announcement</p>
                            <p className="mt-1 text-sm">Pick one from the list to read it here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
