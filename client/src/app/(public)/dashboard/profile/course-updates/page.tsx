"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { ProfileEmptyState } from "@/components/profile/ProfileEmptyState";
import { ProfilePageHeader } from "@/components/profile/ProfilePageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
import { notificationService } from "@/services";

const COURSE_UPDATE_TYPES = new Set(["COURSE", "MODULE"]);

/**
 * Not a real spec in the reference screenshots (no visible content for this
 * sidebar entry) — a minimal, sensible stand-in: course/module-related items
 * from the existing notification feed, filtered client-side. No new backend.
 */
export default function CourseUpdatesPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["notifications", "course-updates"],
        queryFn: () => notificationService.list({ limit: 30 }),
    });

    const markRead = useMutation({
        mutationFn: (id: string) => notificationService.markRead(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    });

    const updates = (data?.data ?? []).filter((notification) => COURSE_UPDATE_TYPES.has(notification.type));

    return (
        <div className="space-y-6">
            <ProfilePageHeader
                icon={RefreshCw}
                title="Course Updates"
                description="New modules, milestones and course changes for the courses you're enrolled in."
            />

            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-20 rounded-card" />
                    <Skeleton className="h-20 rounded-card" />
                </div>
            ) : updates.length === 0 ? (
                <ProfileEmptyState
                    icon={RefreshCw}
                    title="No course updates yet"
                    description="When a course you're taking gets a new module or changes, you'll see it here."
                />
            ) : (
                <ol className="relative space-y-3">
                    {/* The feed's spine. */}
                    <span aria-hidden className="absolute bottom-4 left-[1.375rem] top-4 w-px bg-border" />
                    {updates.map((update) => {
                        const content = (
                            <div className="flex items-start gap-4">
                                <span
                                    className={cn(
                                        "relative grid size-11 shrink-0 place-items-center rounded-md ring-4 ring-background",
                                        update.isRead ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground shadow-sm",
                                    )}
                                >
                                    <RefreshCw className="size-4" />
                                </span>
                                <div
                                    className={cn(
                                        "min-w-0 flex-1 rounded-card border p-4 shadow-card transition-[border-color,box-shadow]",
                                        update.isRead
                                            ? "border-border bg-card"
                                            : "border-primary/30 bg-primary/3",
                                        (update.link || !update.isRead) && "hover:border-primary/40 hover:shadow-panel",
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="font-semibold leading-snug">{update.title}</p>
                                        {!update.isRead && (
                                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-primary">
                                                New
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{update.message}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(update.createdAt)}</p>
                                </div>
                            </div>
                        );

                        return (
                            <li key={update.id}>
                                {update.link ? (
                                    <Link href={update.link} onClick={() => !update.isRead && markRead.mutate(update.id)}>
                                        {content}
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        className="block w-full text-left"
                                        onClick={() => !update.isRead && markRead.mutate(update.id)}
                                    >
                                        {content}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}
