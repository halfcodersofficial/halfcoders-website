"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Crown, Medal } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CourseSummaryHeader, since } from "@/components/admin/CourseSummary";
import DataShell from "@/components/admin/DataShell";
import { leaderboardNote, MEDAL, TopThree, xp, XpSourceBar } from "@/components/admin/leaderboard/LeaderboardCourseCard";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { leaderboardService } from "@/services";
import { adminService } from "@/services/admin";
import type { AdminLeaderboardCourse } from "@/types/admin.types";

const PAGE_SIZE = 25;

/** Gold crown, silver and bronze medals, then the number. */
function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return <Crown className={cn("size-5", MEDAL[0].text)} aria-label="1st" />;
    if (rank === 2) return <Medal className={cn("size-5", MEDAL[1].text)} aria-label="2nd" />;
    if (rank === 3) return <Medal className={cn("size-5", MEDAL[2].text)} aria-label="3rd" />;
    return <span className="font-mono text-sm tabular-nums text-muted-foreground">{rank}</span>;
}

/**
 * One course's board: its roll-up on top, the top three on a podium, then
 * every ranked student in order — each opening their admin profile. The
 * order is the board's own (XP, then who got there first), the same one
 * students see.
 */
export default function AdminLeaderboardCoursePage() {
    const { courseId } = useParams<{ courseId: string }>();
    const [page, setPage] = useState(1);

    const summaryQuery = useQuery({
        queryKey: ["admin", "leaderboard-course", courseId],
        queryFn: () => adminService.leaderboardCourse(courseId),
    });

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "leaderboard", courseId, page],
        queryFn: () => leaderboardService.forCourse(courseId, { page, limit: PAGE_SIZE }),
    });

    const summary = summaryQuery.data;
    const rows = data?.data ?? [];
    // Bars are drawn against the leader, so first place fills its track.
    const leaderXp = summary?.top[0]?.totalXp ?? rows[0]?.totalXp ?? 0;

    if (summaryQuery.isError) {
        return (
            <div className="space-y-5">
                <BackButton href="/admin/leaderboard" label="All courses" />
                <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
                    <p className="font-medium">This course couldn&apos;t be found.</p>
                    <p className="mt-1 text-sm text-muted-foreground">It may have been removed. Go back to pick another course.</p>
                </div>
            </div>
        );
    }

    return (
        <DataShell
            header={
                <div className="space-y-4">
                    <BackButton href="/admin/leaderboard" label="All courses" />
                    {summary ? <CourseHeader summary={summary} /> : <Skeleton className="h-72 rounded-2xl" />}
                </div>
            }
            isLoading={isLoading}
            skeleton={
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 rounded-xl" />
                    ))}
                </div>
            }
            isEmpty={rows.length === 0}
            emptyMessage="Nobody has earned XP on this course yet."
            emptyHint="Students earn it by finishing lessons, quizzes, assignments, practice days and support sessions."
            meta={data?.meta}
            onPage={setPage}
        >
            <div className="space-y-6">
                {page === 1 && summary && summary.top.length > 0 && <Podium top={summary.top} />}

                <ol className="space-y-2">
                    {rows.map((row) => (
                        <li key={row.student.id}>
                            <Link
                                href={`/admin/students/${row.student.id}`}
                                className={cn(
                                    "group flex items-center gap-4 rounded-xl border bg-card p-3 pr-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    row.rank <= 3 ? "border-border bg-linear-to-r from-[#d9a441]/6 to-transparent" : "border-border",
                                )}
                            >
                                <span className="grid w-8 shrink-0 place-items-center">
                                    <RankBadge rank={row.rank} />
                                </span>
                                <Avatar src={row.student.image} name={row.student.name} size={36} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{row.student.name}</span>
                                    <span aria-hidden className="mt-1.5 block h-1.5 max-w-md overflow-hidden rounded-full bg-secondary">
                                        <span
                                            className={cn("block h-full rounded-full", row.rank <= 3 ? MEDAL[row.rank - 1].fill : "bg-brand")}
                                            style={{ width: `${leaderXp > 0 ? Math.max(2, (row.totalXp / leaderXp) * 100) : 0}%` }}
                                        />
                                    </span>
                                </span>
                                <span className="shrink-0 text-right font-semibold tabular-nums">
                                    {xp(row.totalXp)}
                                    <span className="ml-1 text-xs font-normal text-muted-foreground">XP</span>
                                </span>
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </li>
                    ))}
                </ol>
            </div>
        </DataShell>
    );
}

function CourseHeader({ summary }: { summary: AdminLeaderboardCourse }) {
    return (
        <CourseSummaryHeader
            course={summary.course}
            details={
                <span className="inline-flex items-center gap-2">
                    <TopThree top={summary.top} size={26} />
                    {leaderboardNote(summary)}
                </span>
            }
            stats={[
                { label: "Ranked", value: String(summary.ranked), hint: "Students with XP" },
                { label: "Total XP", value: xp(summary.totalXp), hint: "Earned on this course" },
                { label: "Average", value: xp(summary.averageXp), hint: "XP per ranked student" },
                {
                    label: "This week",
                    value: `+${xp(summary.xpThisWeek)}`,
                    hint: since("Last earned", summary.lastXpAt, "No XP yet"),
                },
            ]}
            bar={<XpSourceBar bySource={summary.bySource} />}
        />
    );
}

/** The top three on steps: second, first, third — first tallest, crowned. */
function Podium({ top }: { top: AdminLeaderboardCourse["top"] }) {
    const byRank = new Map(top.map((row) => [row.rank, row]));
    const order = [2, 1, 3];
    const step = { 1: "h-24", 2: "h-16", 3: "h-12" } as Record<number, string>;

    return (
        <section aria-label="Top three" className="rounded-2xl border border-border bg-card px-4 pb-0 pt-6 shadow-sm sm:px-8">
            <ol className="mx-auto grid max-w-xl grid-cols-3 items-end gap-3 sm:gap-5">
                {order.map((rank) => {
                    const row = byRank.get(rank);
                    const medal = MEDAL[rank - 1];
                    return (
                        <li key={rank} className="flex min-w-0 flex-col items-center text-center">
                            {row ? (
                                <Link
                                    href={`/admin/students/${row.student.id}`}
                                    className="group flex min-w-0 max-w-full flex-col items-center rounded-lg px-1 pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {rank === 1 && <Crown className={cn("mb-1 size-6", medal.text)} aria-hidden />}
                                    <span className={cn("rounded-full ring-4", medal.ring)}>
                                        <Avatar src={row.student.image} name={row.student.name} size={rank === 1 ? 64 : 52} />
                                    </span>
                                    <span className="mt-3 block max-w-full truncate text-sm font-semibold group-hover:text-primary">
                                        {row.student.name}
                                    </span>
                                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                        {xp(row.totalXp)} XP
                                    </span>
                                </Link>
                            ) : (
                                <span className="pb-3 text-xs text-muted-foreground">—</span>
                            )}
                            <span
                                className={cn(
                                    "grid w-full place-items-center rounded-t-xl border-t-4 bg-secondary/60 text-2xl font-bold tabular-nums",
                                    step[rank],
                                    rank === 1 ? "border-[#d9a441]" : rank === 2 ? "border-[#9ca3af]" : "border-[#b45309]",
                                    medal.text,
                                )}
                            >
                                {rank}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
