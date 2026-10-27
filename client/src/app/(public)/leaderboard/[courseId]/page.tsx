"use client";

import { useQuery } from "@tanstack/react-query";
import { Crown, Medal, Trophy } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { leaderboardService } from "@/services";

/** Gold / silver / bronze for the top three, plain rank below. */
const RankBadge = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Crown className="size-5 text-medal-gold" aria-label="1st" />;
    if (rank === 2) return <Medal className="size-5 text-medal-silver" aria-label="2nd" />;
    if (rank === 3) return <Medal className="size-5 text-medal-bronze" aria-label="3rd" />;
    return <span className="w-5 text-center font-mono text-sm text-muted-foreground">{rank}</span>;
};

export default function LeaderboardPage() {
    const { courseId } = useParams<{ courseId: string }>();
    const { isStudent, user } = useSession();
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ["leaderboard", courseId, page],
        queryFn: () => leaderboardService.forCourse(courseId, { page, limit: 25 }),
    });

    // Ranks are earned by learning, so only a student has one; the board
    // itself is public and staff read it like anyone else.
    const { data: myRank } = useQuery({
        queryKey: ["leaderboard", courseId, "me"],
        queryFn: () => leaderboardService.myRank(courseId),
        enabled: isStudent,
    });

    const rows = data?.data ?? [];
    const meta = data?.meta;

    return (
        <div className="container-page max-w-3xl space-y-6 py-12">
            <header className="flex flex-wrap items-start gap-x-3 gap-y-4">
                <div className="basis-full">
                    <BackButton href="/dashboard" label="Dashboard" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Leaderboard</h1>
                    <p className="mt-1 text-muted-foreground">
                        XP earned from lessons, assignments, practice and support.
                    </p>
                </div>
            </header>

            {myRank && (
                <Card className="border-primary/30 bg-primary/5 shadow-sm">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="flex items-center gap-3">
                            <Trophy className="size-6 text-primary" />
                            <div>
                                <p className="font-semibold">
                                    {myRank.rank ? `You're #${myRank.rank}` : "Not ranked yet"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {myRank.rank
                                        ? `of ${myRank.totalStudents} student${myRank.totalStudents === 1 ? "" : "s"}`
                                        : "Complete a lesson to get on the board."}
                                </p>
                            </div>
                        </div>
                        <span className="text-2xl font-bold">
                            {myRank.totalXp.toLocaleString()}{" "}
                            <span className="text-sm font-normal text-muted-foreground">XP</span>
                        </span>
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="h-14" />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <Card className="shadow-sm">
                    <CardContent className="py-16 text-center">
                        <Trophy className="mx-auto mb-3 size-10 text-muted-foreground" />
                        <p className="font-medium">Nobody has earned XP on this course yet.</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Be the first — finish a lesson to get on the board.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="shadow-sm">
                    <CardContent className="p-0">
                        <ul className="divide-y divide-border">
                            {rows.map((row) => {
                                const isMe = row.student.id === user?.id;

                                return (
                                    <li
                                        key={row.student.id}
                                        className={cn(
                                            "flex items-center gap-3 p-4 transition-colors",
                                            isMe
                                                ? "bg-primary/5"
                                                : row.rank <= 3
                                                    ? "bg-accent/5"
                                                    : "hover:bg-secondary/30",
                                        )}
                                    >
                                        <RankBadge rank={row.rank} />
                                        <Avatar src={row.student.image} name={row.student.name} size={36} />

                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                            {row.student.name}
                                            {isMe && <Badge className="ml-2">You</Badge>}
                                        </span>

                                        <span className="shrink-0 font-semibold tabular-nums">
                                            {row.totalXp.toLocaleString()}
                                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                                                XP
                                            </span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {meta && meta.totalPages > 1 && (
                <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="px-3 text-sm text-muted-foreground">
                        Page {meta.page} of {meta.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= meta.totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                    </Button>
                </nav>
            )}
        </div>
    );
}
