import { CourseSummaryCard, CourseSummaryRow, SegmentBar, since } from "@/components/admin/CourseSummary";
import ProgressRing from "@/components/shared/ProgressRing";
import type { AdminEnrollmentCourse } from "@/types/admin.types";
import type { EnrollmentStatus } from "@/types/api.types";

/** How each enrolment status is drawn on the Enrolments screens, in bar order. */
export const ENROLLMENT_TONE: { status: EnrollmentStatus; label: string; fill: string }[] = [
    { status: "COMPLETED", label: "completed", fill: "bg-success" },
    { status: "ACTIVE", label: "learning", fill: "bg-primary" },
    { status: "EXPIRED", label: "expired", fill: "bg-muted-foreground/50" },
    { status: "CANCELLED", label: "cancelled", fill: "bg-destructive/70" },
];

export const enrollmentFill = (status: EnrollmentStatus) =>
    ENROLLMENT_TONE.find((tone) => tone.status === status)?.fill ?? "bg-muted-foreground/40";

/** A course's students as one bar split by where they stand. */
export function EnrollmentStatusBar({
    counts,
    legend = true,
    short = false,
    className,
}: {
    counts: AdminEnrollmentCourse["counts"];
    legend?: boolean;
    short?: boolean;
    className?: string;
}) {
    return (
        <SegmentBar
            segments={ENROLLMENT_TONE.map((tone) => ({
                key: tone.status,
                count: counts[tone.status],
                label: tone.label,
                fill: tone.fill,
            }))}
            legend={legend}
            short={short}
            emptyLabel="No students yet"
            className={className}
        />
    );
}

/** Students who can still open the course. */
export const withAccess = (summary: AdminEnrollmentCourse) => summary.counts.ACTIVE + summary.counts.COMPLETED;

const lastJoined = (summary: AdminEnrollmentCourse) => since("Last enrolled", summary.lastEnrolledAt, "No students yet");

/** A course on the Enrolments overview, card layout. */
export function EnrollmentCourseCard({ summary, href }: { summary: AdminEnrollmentCourse; href: string }) {
    const students = withAccess(summary);
    return (
        <CourseSummaryCard
            course={summary.course}
            href={href}
            figure={
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">Students</p>
                        <p className="text-xl font-bold tabular-nums tracking-tight">
                            {students}
                            {summary.certificates > 0 && (
                                <span className="ml-1.5 text-[0.6875rem] font-medium tracking-normal text-muted-foreground">
                                    · {summary.certificates} certified
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-right text-[0.625rem] font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
                            Avg
                            <br />
                            progress
                        </span>
                        <ProgressRing value={summary.averageProgress} size={42} stroke={4}>
                            <span className="text-[0.625rem] font-bold tabular-nums">{summary.averageProgress}%</span>
                        </ProgressRing>
                    </div>
                </div>
            }
            bar={<EnrollmentStatusBar counts={summary.counts} short />}
            note={lastJoined(summary)}
        />
    );
}

/** The same course as one row, for the list layout. */
export function EnrollmentCourseRow({ summary, href }: { summary: AdminEnrollmentCourse; href: string }) {
    const students = withAccess(summary);
    return (
        <CourseSummaryRow
            course={summary.course}
            href={href}
            badge={
                students > 0 && (
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        avg progress
                        <ProgressRing value={summary.averageProgress} size={36} stroke={3.5}>
                            <span className="text-[0.5625rem] font-bold tabular-nums text-foreground">{summary.averageProgress}%</span>
                        </ProgressRing>
                    </span>
                )
            }
            figure={
                <>
                    <p className="font-bold tabular-nums">
                        {students} {students === 1 ? "student" : "students"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {summary.certificates > 0 ? `${summary.certificates} certified` : `${summary.counts.total} enrolled in all`}
                    </p>
                </>
            }
            bar={<EnrollmentStatusBar counts={summary.counts} legend={false} />}
            note={lastJoined(summary)}
        />
    );
}
