"use client";

import { formatDistanceToNow } from "date-fns";
import {
    Award,
    BookOpen,
    ClipboardCheck,
    ClipboardList,
    CreditCard,
    Dumbbell,
    Headphones,
    ListChecks,
    LogIn,
    ShieldAlert,
    UserPlus,
    type LucideIcon,
} from "lucide-react";
import { StatusPill } from "@/components/admin/StatusPill";
import { DEVICE_ICONS, placeLabel, SIGN_IN_METHOD_LABEL } from "@/lib/device";
import { cn, formatBDT, formatTime } from "@/lib/utils";
import type { StudentActivityEntry, StudentActivityKind } from "@/types/admin.types";
import { GATEWAY_LABEL, percentTone } from "./format";

/** Each kind of activity: its icon, the words before its title, and its colour (an editor's syntax colours). */
export const ACTIVITY_KIND: Record<StudentActivityKind, { icon: LucideIcon; verb: string; tone: string; label: string }> = {
    lesson: { icon: BookOpen, verb: "Finished lesson", tone: "bg-syn-func/10 text-syn-func", label: "Lessons" },
    practice: { icon: Dumbbell, verb: "Finished practice day", tone: "bg-syn-func/10 text-syn-func", label: "Practice days" },
    submission: { icon: ClipboardList, verb: "Handed in", tone: "bg-syn-string/10 text-syn-string", label: "Work handed in" },
    review: { icon: ClipboardCheck, verb: "Got marks on", tone: "bg-syn-string/10 text-syn-string", label: "Marks received" },
    quiz: { icon: ListChecks, verb: "Took quiz", tone: "bg-syn-keyword/10 text-syn-keyword", label: "Quizzes" },
    support: { icon: Headphones, verb: "Joined support", tone: "bg-syn-tag/10 text-syn-tag", label: "Support visits" },
    enrolled: { icon: UserPlus, verb: "Enrolled in", tone: "bg-syn-number/10 text-syn-number", label: "Enrolments" },
    certificate: { icon: Award, verb: "Got a certificate for", tone: "bg-syn-number/10 text-syn-number", label: "Certificates" },
    payment: { icon: CreditCard, verb: "Paid for", tone: "bg-syn-number/10 text-syn-number", label: "Payments" },
    signin: { icon: LogIn, verb: "Signed in on", tone: "bg-secondary text-muted-foreground", label: "Sign-ins" },
    refused: { icon: ShieldAlert, verb: "Turned away by the device limit on", tone: "bg-destructive/10 text-destructive", label: "Turned away" },
};

/** The groups the activity page filters by. */
export const ACTIVITY_FILTERS: { id: string; label: string; kinds: StudentActivityKind[] }[] = [
    { id: "all", label: "Everything", kinds: [] },
    { id: "learning", label: "Lessons & practice", kinds: ["lesson", "practice"] },
    { id: "assignments", label: "Assignments", kinds: ["submission", "review"] },
    { id: "quizzes", label: "Quizzes", kinds: ["quiz"] },
    { id: "support", label: "Support", kinds: ["support"] },
    { id: "money", label: "Enrolments & payments", kinds: ["enrolled", "certificate", "payment"] },
    { id: "signins", label: "Sign-ins", kinds: ["signin", "refused"] },
];

/**
 * One thing a student did, on one line: what and where, then the finer
 * detail — the course, the marks, who marked it, the device and place of a
 * sign-in. A finished quiz opens its answers. `compact` (the overview) shows
 * how long ago; the activity page, where entries sit under their day, the time.
 */
export function ActivityRow({
    entry,
    compact = false,
    onOpenQuiz,
}: {
    entry: StudentActivityEntry;
    compact?: boolean;
    onOpenQuiz?: (attemptId: string, title: string) => void;
}) {
    const kind = ACTIVITY_KIND[entry.kind];
    const Icon = kind.icon;
    const DeviceIcon = entry.device ? DEVICE_ICONS[entry.device.deviceType] : null;
    const place = entry.device ? placeLabel(entry.device.place) : null;
    const opensQuiz = Boolean(entry.quizAttemptId && onOpenQuiz);

    const meta = [
        entry.where,
        entry.course && !["enrolled", "certificate", "payment"].includes(entry.kind) ? entry.course.title : null,
        entry.by && entry.kind === "review" ? `marked by ${entry.by.name}` : null,
        entry.by && entry.kind === "support" ? `with ${entry.by.name}` : null,
    ].filter(Boolean);

    const body = (
        <>
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", kind.tone)}>
                <Icon className="size-4" aria-hidden />
            </span>

            <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm leading-snug">
                    <span className="text-muted-foreground">{kind.verb} </span>
                    <span className={cn("font-medium wrap-break-word", opensQuiz && "group-hover:underline")}>{entry.title}</span>
                </p>

                {meta.length > 0 && <p className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</p>}

                {entry.device && DeviceIcon && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <DeviceIcon className="size-3.5" aria-hidden />
                        {place ?? "Place not known yet"}
                        {entry.device.ipAddress && <span className="font-mono">{entry.device.ipAddress}</span>}
                        {entry.device.place?.network && <span>· {entry.device.place.network}</span>}
                        {entry.method && <span>· {SIGN_IN_METHOD_LABEL[entry.method] ?? entry.method}</span>}
                        {Boolean(entry.signedOutOthers) && (
                            <span className="font-medium text-warning-ink">
                                · signed {entry.signedOutOthers} other {entry.signedOutOthers === 1 ? "device" : "devices"} out
                            </span>
                        )}
                    </p>
                )}

                {!compact && entry.detail && entry.kind !== "lesson" && (
                    <p className="text-xs text-muted-foreground wrap-break-word">
                        {entry.kind === "support" ? `Asked about: ${entry.detail}` : entry.kind === "practice" ? `“${entry.detail}”` : entry.detail}
                    </p>
                )}
                {!compact && entry.detail && entry.kind === "lesson" && <p className="truncate text-xs text-muted-foreground">{entry.detail}</p>}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                {entry.score && (
                    <span className="text-sm">
                        <span className={cn("font-semibold tabular-nums", percentTone(entry.score.percent))}>
                            {entry.score.percent !== null ? `${entry.score.percent}%` : "—"}
                        </span>
                        <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{entry.score.label}</span>
                    </span>
                )}
                {entry.amount !== undefined && <span className="text-sm font-semibold tabular-nums">{formatBDT(entry.amount)}</span>}
                {!compact && entry.kind === "payment" && entry.status && (
                    <span className="text-xs text-muted-foreground">{GATEWAY_LABEL[entry.status] ?? entry.status}</span>
                )}
                {!compact && (entry.kind === "submission" || entry.kind === "review") && entry.status && <StatusPill kind="submission" value={entry.status} />}
                {!compact && entry.kind === "support" && entry.status && <StatusPill kind="supportQueue" value={entry.status} />}
                <time dateTime={entry.at} className="text-xs tabular-nums text-muted-foreground" title={new Date(entry.at).toLocaleString("en-GB")}>
                    {compact ? formatDistanceToNow(new Date(entry.at), { addSuffix: true }) : formatTime(entry.at)}
                </time>
            </div>
        </>
    );

    if (opensQuiz) {
        return (
            <button
                type="button"
                onClick={() => onOpenQuiz?.(entry.quizAttemptId as string, entry.title)}
                title="See their answers"
                className="group flex w-full gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {body}
            </button>
        );
    }
    return <div className="flex gap-3 px-2 py-2.5">{body}</div>;
}
