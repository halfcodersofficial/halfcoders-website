import { Crown, TrendingUp } from "lucide-react";
import { CourseSummaryCard, CourseSummaryRow, SegmentBar, since } from "@/components/admin/CourseSummary";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AdminLeaderboardCourse, XpGroup } from "@/types/admin.types";

/** Gold, silver and bronze — the board's own medal colours (ring and text). */
export const MEDAL = [
    { ring: "ring-[#d9a441]", text: "text-[#d9a441]", fill: "bg-[#d9a441]" },
    { ring: "ring-[#9ca3af]", text: "text-[#9ca3af]", fill: "bg-[#9ca3af]" },
    { ring: "ring-[#b45309]", text: "text-[#b45309]", fill: "bg-[#b45309]" },
];

/** How each XP source is drawn on the Leaderboard screens, in bar order. */
export const XP_TONE: { group: XpGroup; label: string; shortLabel: string; fill: string }[] = [
    { group: "lessons", label: "XP from lessons", shortLabel: "lesson XP", fill: "bg-primary" },
    { group: "assignments", label: "XP from assignments", shortLabel: "assignment XP", fill: "bg-amber-500" },
    { group: "practice", label: "XP from practice", shortLabel: "practice XP", fill: "bg-violet-500" },
    { group: "support", label: "XP from support", shortLabel: "support XP", fill: "bg-success" },
    { group: "milestones", label: "XP from milestones", shortLabel: "milestone XP", fill: "bg-sky-400" },
];

export const xp = (n: number) => n.toLocaleString("en-US");

/** A course's XP split by the work that earned it. */
export function XpSourceBar({
    bySource,
    legend = true,
    short = false,
}: {
    bySource: AdminLeaderboardCourse["bySource"];
    legend?: boolean;
    short?: boolean;
}) {
    return (
        <SegmentBar
            segments={XP_TONE.map((tone) => ({
                key: tone.group,
                count: bySource[tone.group],
                label: tone.label,
                shortLabel: tone.shortLabel,
                fill: tone.fill,
            }))}
            legend={legend}
            short={short}
            emptyLabel="No XP yet"
        />
    );
}

/** The top three as overlapping avatars ringed gold, silver, bronze — the leader on top. */
export function TopThree({ top, size = 30 }: { top: AdminLeaderboardCourse["top"]; size?: number }) {
    if (top.length === 0) return null;
    return (
        <span className="flex -space-x-1" aria-label={`Top: ${top.map((row) => row.student.name).join(", ")}`}>
            {top.map((row, index) => (
                <span
                    key={row.student.id}
                    title={`#${row.rank} ${row.student.name} — ${xp(row.totalXp)} XP`}
                    className={cn("rounded-full ring-2", MEDAL[index].ring)}
                    style={{ zIndex: 3 - index }}
                >
                    <Avatar src={row.student.image} name={row.student.name} size={size} />
                </span>
            ))}
        </span>
    );
}

/** "+1,240 XP this week" over a card's picture, when the board moved. */
function ThisWeekBadge({ amount }: { amount: number }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-success shadow-sm">
            <TrendingUp className="size-3.5" aria-hidden />+{xp(amount)} XP this week
        </span>
    );
}

/** "Leader: Rahim · 2,400 XP", or when XP was last earned. */
export const leaderboardNote = (summary: AdminLeaderboardCourse) => {
    const leader = summary.top[0];
    if (leader) return `Leader: ${leader.student.name} · ${xp(leader.totalXp)} XP`;
    return since("Last XP", summary.lastXpAt, "No XP earned yet");
};

/** A course on the Leaderboard overview, card layout. */
export function LeaderboardCourseCard({ summary, href }: { summary: AdminLeaderboardCourse; href: string }) {
    return (
        <CourseSummaryCard
            course={summary.course}
            href={href}
            badge={summary.xpThisWeek > 0 && <ThisWeekBadge amount={summary.xpThisWeek} />}
            figure={
                <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">Ranked</p>
                        <p className="text-xl font-bold tabular-nums tracking-tight">
                            {summary.ranked}
                            <span className="ml-1.5 text-[0.6875rem] font-medium tracking-normal text-muted-foreground">
                                · {xp(summary.totalXp)} XP
                            </span>
                        </p>
                    </div>
                    <TopThree top={summary.top} size={28} />
                </div>
            }
            bar={<XpSourceBar bySource={summary.bySource} short />}
            note={leaderboardNote(summary)}
        />
    );
}

/** The same course as one row, for the list layout. */
export function LeaderboardCourseRow({ summary, href }: { summary: AdminLeaderboardCourse; href: string }) {
    const leader = summary.top[0];
    return (
        <CourseSummaryRow
            course={summary.course}
            href={href}
            badge={
                leader && (
                    <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <Crown className={cn("size-4 shrink-0", MEDAL[0].text)} aria-hidden />
                        <TopThree top={summary.top} size={26} />
                    </span>
                )
            }
            figure={
                <>
                    <p className="font-bold tabular-nums">{summary.ranked} ranked</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{xp(summary.totalXp)} XP</p>
                </>
            }
            bar={<XpSourceBar bySource={summary.bySource} legend={false} />}
            note={leaderboardNote(summary)}
        />
    );
}
