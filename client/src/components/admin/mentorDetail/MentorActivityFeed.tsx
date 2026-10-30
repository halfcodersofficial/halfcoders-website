"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
    BookOpen,
    CalendarRange,
    Clapperboard,
    ClipboardCheck,
    ClipboardList,
    Dumbbell,
    Headphones,
    HelpCircle,
    History,
    Layers,
    ListChecks,
    Paperclip,
    PlayCircle,
    Route,
    UserRound,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DEVICE_ICONS, deviceLabel } from "@/lib/device";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatDate, formatTime } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { MentorActivityEntry } from "@/types/admin.types";

const PAGE_SIZE = 30;

const ENTITY_ICONS: Record<string, LucideIcon> = {
    course: BookOpen,
    week: CalendarRange,
    module: Layers,
    lesson: PlayCircle,
    quiz: ListChecks,
    question: HelpCircle,
    assignment: ClipboardList,
    material: Paperclip,
    practice: Dumbbell,
    outlineWeek: Route,
    outlineItem: Route,
    supportSession: Headphones,
    conceptualTopic: Clapperboard,
    conceptualSession: Clapperboard,
    queueEntry: UserRound,
    submission: ClipboardCheck,
};

/** "curriculumPdf" → "curriculum PDF", "isPublished" → "published". */
const fieldName = (field: string) =>
    field
        .replace(/^is(?=[A-Z])/, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .replace(/\b(pdf|url)\b/g, (word) => word.toUpperCase());

const dayHeading = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return formatDate(date);
};

const detailLine = (entry: MentorActivityEntry) => {
    const detail = entry.detail;
    if (!detail) return null;
    const parts: string[] = [];
    if (detail.fields?.length) parts.push(`Changed ${detail.fields.map(fieldName).join(", ")}`);
    if (detail.status) parts.push(`Status: ${detail.status.replace(/_/g, " ").toLowerCase()}`);
    if (typeof detail.score === "number") parts.push(`Score: ${detail.score}`);
    return parts.length > 0 ? parts.join(" · ") : null;
};

interface MentorActivityFeedProps {
    mentorId: string;
    courses: { id: string; title: string }[];
    /** Show only the first few entries, with no filter or paging. */
    preview?: number;
}

/**
 * The mentor's change history: every lesson, module, quiz, assignment, review
 * and support-session change, newest first, grouped by day. Only what has
 * happened since the history was switched on — see StaffActivity.
 */
export function MentorActivityFeed({ mentorId, courses, preview }: MentorActivityFeedProps) {
    const [courseId, setCourseId] = useState("");

    const query = useInfiniteQuery({
        queryKey: ["admin", "mentor", mentorId, "activity", { courseId, limit: preview ?? PAGE_SIZE }],
        queryFn: ({ pageParam }) =>
            adminService.mentorActivity(mentorId, {
                page: pageParam,
                limit: preview ?? PAGE_SIZE,
                courseId: courseId || undefined,
            }),
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    });

    const entries = query.data?.pages.flatMap((page) => page.data) ?? [];
    const total = query.data?.pages[0]?.meta?.total ?? 0;

    // Consecutive entries on the same day share a heading.
    const groups: { heading: string; entries: MentorActivityEntry[] }[] = [];
    for (const entry of entries) {
        const heading = dayHeading(entry.createdAt);
        const last = groups[groups.length - 1];
        if (last?.heading === heading) last.entries.push(entry);
        else groups.push({ heading, entries: [entry] });
    }

    return (
        <div className="space-y-4">
            {!preview && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        {query.isSuccess && `${total} ${total === 1 ? "change" : "changes"} recorded`}
                    </p>
                    {courses.length > 0 && (
                        <div className="w-full sm:w-64">
                            <Select
                                value={courseId}
                                onChange={(event) => setCourseId(event.target.value)}
                                aria-label="Filter by course"
                            >
                                <option value="">All courses</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.title}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    )}
                </div>
            )}

            {query.isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: preview ?? 5 }).map((_, index) => (
                        <Skeleton key={index} className="h-14" />
                    ))}
                </div>
            ) : query.isError ? (
                <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {getApiErrorMessage(query.error, "Couldn't load the change history.")}
                </p>
            ) : entries.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-8 text-center">
                    <History className="mx-auto size-6 text-muted-foreground" aria-hidden />
                    <p className="mt-3 font-medium">{courseId ? "No changes in this course yet." : "No changes recorded yet."}</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                        Lessons, modules, quizzes, assignments, reviews and support sessions this mentor changes
                        appear here from now on. Earlier work isn&apos;t in the history.
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    {groups.map((group) => (
                        <section key={group.heading + group.entries[0].id}>
                            <h3 className="mb-2 text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">
                                {group.heading}
                            </h3>
                            <ol className="divide-y divide-border rounded-md border border-border bg-card">
                                {group.entries.map((entry) => {
                                    const Icon = ENTITY_ICONS[entry.entityType ?? ""] ?? History;
                                    const DeviceIcon = DEVICE_ICONS[entry.device.deviceType];
                                    const detail = detailLine(entry);
                                    return (
                                        <li key={entry.id} className="flex gap-3 px-4 py-3">
                                            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                                <Icon className="size-4" aria-hidden />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm wrap-break-word">{entry.summary}</p>
                                                {detail && (
                                                    <p className="mt-0.5 text-xs text-muted-foreground wrap-break-word">{detail}</p>
                                                )}
                                                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    {entry.course && (
                                                        <Link
                                                            href={`/admin/courses/${entry.course.id}`}
                                                            className="max-w-full truncate font-medium text-foreground/80 hover:underline"
                                                        >
                                                            {entry.course.title}
                                                        </Link>
                                                    )}
                                                    <span className="flex items-center gap-1" title={entry.ipAddress ?? undefined}>
                                                        <DeviceIcon className="size-3.5" aria-hidden />
                                                        {deviceLabel(entry.device)}
                                                        {entry.ipAddress && ` · ${entry.ipAddress}`}
                                                    </span>
                                                </p>
                                            </div>
                                            <time
                                                dateTime={entry.createdAt}
                                                className="shrink-0 text-xs tabular-nums text-muted-foreground"
                                            >
                                                {formatTime(entry.createdAt)}
                                            </time>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    ))}

                    {!preview && query.hasNextPage && (
                        <div className="flex justify-center">
                            <Button
                                variant="outline"
                                onClick={() => void query.fetchNextPage()}
                                isLoading={query.isFetchingNextPage}
                            >
                                Load older changes
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
