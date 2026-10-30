"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ClipboardCheck, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { StatusPill, statusLabel } from "@/components/admin/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { privateFileHref } from "@/lib/privateFile";
import { cn, formatDateTime } from "@/lib/utils";
import type { Marker, StudentSubmission } from "@/types/admin.types";
import { marksLabel, percentLabel, percentTone, roleLabel, weekLabel } from "./format";

const RESULTS = [
    { value: "", label: "All results" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "NEEDS_REVISION", label: "Needs revision" },
    { value: "REJECTED", label: "Rejected" },
    { value: "UNDER_REVIEW", label: "Under review" },
    { value: "SUBMITTED", label: "Waiting for marks" },
];

/**
 * Every assignment the student has handed in, across their courses: the
 * marks, who gave them and when. Open one for the feedback, what they
 * submitted, and each time it was marked.
 */
export function StudentSubmissions({
    submissions,
    courses,
    missed,
}: {
    submissions: StudentSubmission[];
    courses: { id: string; title: string }[];
    /** Closed without a submission, across their courses. */
    missed: number;
}) {
    const [courseId, setCourseId] = useState("");
    const [status, setStatus] = useState("");

    if (submissions.length === 0) {
        return (
            <div className="rounded-card border border-dashed border-border p-10 text-center">
                <ClipboardCheck className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-medium">No assignments submitted yet.</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    {missed > 0
                        ? `${missed} ${missed === 1 ? "assignment has" : "assignments have"} closed without a submission — the Courses tab shows which.`
                        : "Each assignment they hand in shows up here, with the marks and who gave them."}
                </p>
            </div>
        );
    }

    const shown = submissions.filter(
        (submission) =>
            (!courseId || submission.assignment.course.id === courseId) && (!status || submission.status === status),
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                {courses.length > 1 && (
                    <div className="w-full sm:w-64">
                        <Select value={courseId} onChange={(event) => setCourseId(event.target.value)} aria-label="Course">
                            <option value="">All courses</option>
                            {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                    {course.title}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}
                <div className="w-full sm:w-48">
                    <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Result">
                        {RESULTS.map((result) => (
                            <option key={result.value} value={result.value}>
                                {result.label}
                            </option>
                        ))}
                    </Select>
                </div>
                <p className="text-sm text-muted-foreground sm:ml-auto">
                    {shown.length} of {submissions.length} {submissions.length === 1 ? "submission" : "submissions"}
                    {missed > 0 && ` · ${missed} missed`}
                </p>
            </div>

            {shown.length === 0 ? (
                <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Nothing matches these filters.
                </p>
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-card">
                    {shown.map((submission) => (
                        <li key={submission.id}>
                            <SubmissionRow submission={submission} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function SubmissionRow({ submission }: { submission: StudentSubmission }) {
    const { assignment } = submission;

    return (
        <details className="group">
            <summary className="grid cursor-pointer list-none grid-cols-1 gap-3 px-4 py-3.5 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1.6fr)_6.5rem_8.5rem_minmax(0,1.2fr)_1.25rem] md:items-center [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                    <p className="truncate font-medium" title={assignment.title}>
                        {assignment.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={assignment.course.title}>
                        {weekLabel(assignment.course.milestoneLabel, assignment.milestone.order)} · {assignment.course.title}
                    </p>
                </div>

                <Marks submission={submission} />

                <div>
                    <StatusPill kind="submission" value={submission.status} />
                </div>

                <MarkedBy submission={submission} />

                <ChevronDown
                    className="hidden size-4 text-muted-foreground transition-transform group-open:rotate-180 md:block"
                    aria-hidden
                />
            </summary>

            <SubmissionDetail submission={submission} className="border-t border-border bg-secondary/20" />
        </details>
    );
}

/** The marks as "88 / 100" over the percentage, or where the work stands without them. */
export function Marks({ submission }: { submission: StudentSubmission }) {
    if (submission.score === null) {
        return <p className="text-sm text-muted-foreground">No marks yet</p>;
    }
    return (
        <div>
            <p className="text-base font-semibold tabular-nums">{marksLabel(submission)}</p>
            <p className={cn("text-xs font-medium tabular-nums", percentTone(submission.percent))}>
                {percentLabel(submission.percent)}
                {submission.late && <span className="font-normal text-muted-foreground"> · late cap</span>}
            </p>
        </div>
    );
}

/** Who marked it last, and when — or how long it has been waiting. */
export function MarkedBy({ submission }: { submission: StudentSubmission }) {
    if (!submission.reviewedBy || !submission.reviewedAt) {
        return (
            <p className="text-sm text-muted-foreground">
                Submitted {formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })}
            </p>
        );
    }
    return (
        <div className="flex min-w-0 items-center gap-2.5">
            <Avatar src={submission.reviewedBy.image} name={submission.reviewedBy.name} size={30} />
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{submission.reviewedBy.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {roleLabel(submission.reviewedBy.role)} · {formatDistanceToNow(new Date(submission.reviewedAt), { addSuffix: true })}
                </p>
            </div>
        </div>
    );
}

type TimelineEntry = { at: string; by: Marker | null; label: string; score: number | null };

/**
 * The submission's life, oldest first: each marking with who did it, and the
 * latest hand-in. A resubmission moves `submittedAt` and clears the marks, so
 * a hand-in after an earlier marking reads as "Resubmitted". The change
 * history only goes back so far; when it has nothing, the submission's own
 * latest marks stand in.
 */
const timeline = (submission: StudentSubmission): TimelineEntry[] => {
    const markings: TimelineEntry[] = submission.history.length
        ? submission.history.map((entry) => ({
            at: entry.at,
            by: entry.by,
            label: entry.status ? statusLabel("submission", entry.status) : "Marked",
            score: entry.score,
        }))
        : submission.reviewedAt
            ? [{
                at: submission.reviewedAt,
                by: submission.reviewedBy,
                label: statusLabel("submission", submission.status),
                score: submission.score,
            }]
            : [];
    const handedIn = new Date(submission.submittedAt).getTime();
    const resubmitted = markings.some((entry) => new Date(entry.at).getTime() < handedIn);
    return [
        ...markings,
        { at: submission.submittedAt, by: null, label: resubmitted ? "Resubmitted" : "Submitted", score: null },
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
};

/** Feedback, the work itself, the dates, and every marking with who gave it. */
export function SubmissionDetail({ submission, className }: { submission: StudentSubmission; className?: string }) {
    const { assignment } = submission;
    const entries = timeline(submission);
    // Marked before, handed in again, not marked since.
    const awaitingRemark = !submission.reviewedAt && submission.history.length > 0;

    return (
        <div className={cn("grid gap-6 px-4 py-4 lg:grid-cols-2", className)}>
            <div className="min-w-0 space-y-4">
                <Block title="Feedback">
                    {submission.feedback ? (
                        <p className="whitespace-pre-line text-sm wrap-break-word">{submission.feedback}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground">No written feedback.</p>
                    )}
                </Block>

                <Block title="What they submitted">
                    {submission.content && (
                        <p className="max-h-48 overflow-y-auto whitespace-pre-line rounded-md border border-border bg-card px-3 py-2 text-sm wrap-break-word">
                            {submission.content}
                        </p>
                    )}
                    {(submission.submissionUrl || submission.fileUrls.length > 0) && (
                        <div className="flex flex-wrap gap-2">
                            {submission.submissionUrl && (
                                <Button asChild variant="outline" size="sm">
                                    <a href={submission.submissionUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink /> Submitted link
                                    </a>
                                </Button>
                            )}
                            {submission.fileUrls.map((url, index) => (
                                <Button key={url} asChild variant="outline" size="sm">
                                    <a href={privateFileHref(url)} target="_blank" rel="noopener noreferrer">
                                        <FileText /> File {index + 1}
                                    </a>
                                </Button>
                            ))}
                        </div>
                    )}
                    {!submission.content && !submission.submissionUrl && submission.fileUrls.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nothing attached.</p>
                    )}
                </Block>

                <dl className="space-y-1.5 text-sm">
                    <Fact label="Deadline">{assignment.deadline ? formatDateTime(assignment.deadline) : "None"}</Fact>
                    <Fact label="Out of">
                        {submission.late
                            ? `${submission.maxScore} (late — full marks are ${assignment.totalMarks})`
                            : assignment.totalMarks}
                    </Fact>
                    <Fact label="Course">
                        <Link href={`/admin/courses/${assignment.course.id}`} className="hover:underline">
                            {assignment.course.title}
                        </Link>
                    </Fact>
                </dl>
            </div>

            <Block title={`Marking history${awaitingRemark ? " · waiting for new marks" : ""}`}>
                <ol className="relative space-y-4 border-l border-border pl-5">
                    {entries.map((entry, index) => (
                        <li key={index} className="relative">
                            <span
                                className={cn(
                                    "absolute -left-[1.6rem] top-1 size-2.5 rounded-full ring-4 ring-card",
                                    entry.by ? "bg-primary" : "bg-muted-foreground/50",
                                )}
                                aria-hidden
                            />
                            <p className="text-sm">
                                <span className="font-medium">{entry.label}</span>
                                {entry.score !== null && (
                                    <span className="tabular-nums"> · {entry.score} marks</span>
                                )}
                            </p>
                            <p className="text-xs tabular-nums text-muted-foreground">{formatDateTime(entry.at)}</p>
                            {entry.by && (
                                <p className="mt-1.5 flex items-center gap-2 text-xs">
                                    <Avatar src={entry.by.image} name={entry.by.name} size={20} />
                                    <span>
                                        by <span className="font-medium">{entry.by.name}</span>{" "}
                                        <span className="text-muted-foreground">({roleLabel(entry.by.role)})</span>
                                    </span>
                                </p>
                            )}
                        </li>
                    ))}
                </ol>
                {submission.history.length === 0 && submission.reviewedAt && (
                    <p className="text-xs text-muted-foreground">
                        Earlier markings, if any, predate the change history.
                    </p>
                )}
            </Block>
        </div>
    );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">{title}</p>
            {children}
        </div>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 wrap-break-word">{children}</dd>
        </div>
    );
}
