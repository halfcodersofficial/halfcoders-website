import { CourseSummaryCard, CourseSummaryRow, SegmentBar, since } from "@/components/admin/CourseSummary";
import { formatDateTime } from "@/lib/utils";
import type { AdminSupportCourse } from "@/types/admin.types";

type Phase = "live" | "upcoming" | "held" | "cancelled";

/** How each session phase is drawn on the Support screens, in bar order. */
export const SUPPORT_TONE: { phase: Phase; label: string; fill: string }[] = [
    { phase: "live", label: "live now", fill: "bg-success" },
    { phase: "upcoming", label: "upcoming", fill: "bg-primary" },
    { phase: "held", label: "held", fill: "bg-muted-foreground/50" },
    { phase: "cancelled", label: "cancelled", fill: "bg-destructive/60" },
];

/** A course's sessions as one bar split by phase. */
export function SupportPhaseBar({
    counts,
    legend = true,
    short = false,
}: {
    counts: AdminSupportCourse["counts"];
    legend?: boolean;
    short?: boolean;
}) {
    return (
        <SegmentBar
            segments={SUPPORT_TONE.map((tone) => ({ key: tone.phase, count: counts[tone.phase], label: tone.label, fill: tone.fill }))}
            legend={legend}
            short={short}
            emptyLabel="No sessions yet"
        />
    );
}

/** A green "Live now" pill with a pulsing dot — over a card's picture, or in a row. */
export function LiveNowBadge() {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            Live now
        </span>
    );
}

/** "Live — Rahim", "Next 15 Oct 2026, 21:00", or when one last ran. */
export const supportNote = (summary: AdminSupportCourse) => {
    if (summary.next?.isLive) return `Live now — ${summary.next.mentorName}`;
    if (summary.next) return `Next ${formatDateTime(summary.next.startTime)}`;
    return since("Last held", summary.lastHeldAt, "No sessions yet");
};

/** A course on the Support overview, card layout. */
export function SupportCourseCard({ summary, href }: { summary: AdminSupportCourse; href: string }) {
    return (
        <CourseSummaryCard
            course={summary.course}
            href={href}
            badge={summary.counts.live > 0 && <LiveNowBadge />}
            figure={
                <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">Upcoming</p>
                        <p className="text-xl font-bold tabular-nums tracking-tight">
                            {summary.counts.upcoming}
                            <span className="ml-1.5 text-[0.6875rem] font-medium tracking-normal text-muted-foreground">
                                · {summary.counts.held} held
                            </span>
                        </p>
                    </div>
                    <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        <span className="block font-semibold text-foreground">{summary.joined}</span>
                        joined
                    </span>
                </div>
            }
            bar={<SupportPhaseBar counts={summary.counts} short />}
            note={supportNote(summary)}
        />
    );
}

/** The same course as one row, for the list layout. */
export function SupportCourseRow({ summary, href }: { summary: AdminSupportCourse; href: string }) {
    return (
        <CourseSummaryRow
            course={summary.course}
            href={href}
            badge={summary.counts.live > 0 && <LiveNowBadge />}
            figure={
                <>
                    <p className="font-bold tabular-nums">{summary.counts.upcoming} upcoming</p>
                    <p className="text-xs text-muted-foreground">{summary.counts.held} held · {summary.joined} joined</p>
                </>
            }
            bar={<SupportPhaseBar counts={summary.counts} legend={false} />}
            note={supportNote(summary)}
        />
    );
}
