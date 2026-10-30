import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatDateTime } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/api.types";
import type { MentorDashboard } from "@/types/mentor.types";
import { reviewHref } from "./ReviewPanel";

const STATUS: Record<SubmissionStatus, { label: string; tone: string }> = {
    SUBMITTED: { label: "Waiting", tone: "bg-primary/10 text-primary" },
    UNDER_REVIEW: { label: "In review", tone: "bg-primary/10 text-primary" },
    ACCEPTED: { label: "Accepted", tone: "bg-success/10 text-success" },
    NEEDS_REVISION: { label: "Changes asked", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    REJECTED: { label: "Rejected", tone: "bg-destructive/10 text-destructive" },
};

/** The newest hand-ins across the mentor's courses, each opening on itself in the review queue. */
export default function LatestSubmissions({ submissions }: { submissions: MentorDashboard["recentSubmissions"] }) {
    return (
        <section aria-labelledby="latest-title" className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <header className="border-b border-border px-5 py-4 bg-surface">
                <h2 id="latest-title" className="text-lg font-semibold tracking-tight">
                    Latest hand-ins
                </h2>
            </header>

            {submissions.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Nothing handed in yet — assignments show up here as students submit them.
                </p>
            ) : (
                <ol className="grid gap-x-8 px-5 py-2 md:grid-cols-2">
                    {submissions.slice(0, 6).map((submission) => {
                        const status = STATUS[submission.status];
                        return (
                            <li key={submission.id}>
                                {/* Newest first in the queue, so it's on the first page. */}
                                <Link
                                    href={reviewHref(submission, "&sort=desc")}
                                    className="-mx-2 flex gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-secondary/40"
                                >
                                    <Avatar name={submission.student.name} size={32} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm leading-snug text-muted-foreground">
                                            <strong className="font-semibold text-foreground">{submission.student.name}</strong> handed in{" "}
                                            <strong className="font-semibold text-foreground">{submission.assignment.title}</strong>
                                        </span>
                                        <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                                            <time dateTime={submission.submittedAt} title={formatDateTime(submission.submittedAt)} className="shrink-0">
                                                {formatDistanceToNowStrict(new Date(submission.submittedAt), { addSuffix: true })}
                                            </time>
                                            <span className={cn("shrink-0 rounded-sm px-2 py-px font-medium", status.tone)}>{status.label}</span>
                                            <span className="truncate">{submission.assignment.course.title}</span>
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
