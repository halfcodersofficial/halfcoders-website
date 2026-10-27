"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatDateTime } from "@/lib/utils";
import { notificationService } from "@/services";

/** Each console keeps its own full inbox at its own prefix — see `lib/access.ts`. */
const ANNOUNCEMENTS_HREF: Record<string, string> = {
    STUDENT: "/dashboard/announcements",
    MENTOR: "/mentor/notifications",
    ADMIN: "/admin/notifications",
    SUPER_ADMIN: "/admin/notifications",
};

const TYPE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    ASSIGNMENT: "warning",
    SUPPORT: "default",
    PAYMENT: "success",
    CERTIFICATE: "success",
    COURSE: "default",
    MODULE: "secondary",
    SYSTEM: "secondary",
    GENERAL: "secondary",
};

/**
 * The bell's whole inbox — no `/dashboard/notifications` page behind it. A
 * student's list is short enough (modules, feedback, support sessions) that a
 * panel handles it end to end; a dedicated page would just be an extra click
 * to see the same dozen rows.
 *
 * The list query only runs once the panel is actually open — polling it on
 * every page for every signed-in student would outweigh what it's for.
 *
 * `variant="icon"` is the circular header trigger; `variant="row"` is the
 * full-width row the mobile drawer's other links use.
 */
export default function NotificationsDropdown({
    unreadCount,
    variant = "icon",
}: {
    unreadCount: number;
    variant?: "icon" | "row";
}) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();
    const { user } = useSession();
    const announcementsHref = user ? ANNOUNCEMENTS_HREF[user.role] : undefined;

    const { data, isLoading } = useQuery({
        queryKey: ["notifications", "list"],
        queryFn: () => notificationService.list({ limit: 4 }),
        enabled: open,
    });

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

    const notifications = data?.data ?? [];

    return (
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
            <DropdownMenu.Trigger asChild>
                {variant === "icon" ? (
                    <button
                        type="button"
                        className="relative rounded-full p-2 transition-colors hover:bg-secondary"
                        aria-label={
                            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
                        }
                    >
                        <Bell className="size-5" />
                        {unreadCount > 0 && (
                            <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[0.9375rem] font-medium transition-colors hover:bg-surface"
                    >
                        <span className="flex items-center gap-3">
                            <Bell className="size-4 text-muted-foreground" aria-hidden /> Notifications
                        </span>
                        {unreadCount > 0 && (
                            <span className="grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>
                )}
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={10}
                    className="z-50 w-88 max-w-[90vw] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                    style={{ boxShadow: "var(--shadow-panel)" }}
                    // Clicking "Mark all read" would otherwise close the whole
                    // panel along with it — fine for "open this link", wrong for
                    // "clear these while I keep reading the rest".
                    onCloseAutoFocus={(event) => event.preventDefault()}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div>
                            <p className="font-semibold">Notifications</p>
                            <p className="text-xs text-muted-foreground">
                                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
                            </p>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={() => markAllRead.mutate()}
                                disabled={markAllRead.isPending}
                                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-secondary disabled:opacity-50"
                            >
                                <CheckCheck className="size-3.5" /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto p-1.5">
                        {isLoading ? (
                            <div className="space-y-2 p-2">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <Skeleton key={index} className="h-14" />
                                ))}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <Bell className="mx-auto mb-2 size-8 text-muted-foreground" />
                                <p className="text-sm font-medium">Nothing here yet.</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    We&apos;ll tell you about new modules, assignment feedback and
                                    support sessions.
                                </p>
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {notifications.map((notification) => {
                                    const body = (
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <p
                                                    className={cn(
                                                        "truncate text-sm font-medium",
                                                        !notification.isRead && "text-primary",
                                                    )}
                                                >
                                                    {notification.title}
                                                </p>
                                                <Badge
                                                    variant={TYPE_VARIANT[notification.type] ?? "secondary"}
                                                    className="shrink-0 text-[10px]"
                                                >
                                                    {notification.type}
                                                </Badge>
                                                {!notification.isRead && (
                                                    <span
                                                        className="size-1.5 shrink-0 rounded-full bg-primary"
                                                        aria-label="Unread"
                                                    />
                                                )}
                                            </div>
                                            <p className="line-clamp-2 text-xs text-muted-foreground">
                                                {notification.message}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {formatDateTime(notification.createdAt)}
                                            </p>
                                        </div>
                                    );

                                    const rowClassName = cn(
                                        "flex gap-2 rounded-lg p-2.5 transition-colors hover:bg-secondary",
                                        !notification.isRead && "bg-primary/5",
                                    );

                                    return (
                                        <li key={notification.id}>
                                            {notification.link ? (
                                                <DropdownMenu.Item asChild className="outline-none">
                                                    <Link
                                                        href={notification.link}
                                                        className={cn(rowClassName, "cursor-pointer")}
                                                        onClick={() => {
                                                            if (!notification.isRead) {
                                                                markRead.mutate(notification.id);
                                                            }
                                                        }}
                                                    >
                                                        {body}
                                                    </Link>
                                                </DropdownMenu.Item>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={cn(rowClassName, "w-full text-left")}
                                                    onClick={() => {
                                                        if (!notification.isRead) {
                                                            markRead.mutate(notification.id);
                                                        }
                                                    }}
                                                >
                                                    {body}
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {announcementsHref && (
                        <DropdownMenu.Item asChild className="outline-none">
                            <Link
                                href={announcementsHref}
                                className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-secondary"
                            >
                                View all announcements
                            </Link>
                        </DropdownMenu.Item>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
