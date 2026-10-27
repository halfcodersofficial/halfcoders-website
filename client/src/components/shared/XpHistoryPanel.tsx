"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Award,
    BookOpen,
    CalendarClock,
    ClipboardCheck,
    FileText,
    Flag,
    HelpCircle,
    Info,
    Trophy,
    X,
    type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Modal, ModalBody } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { leaderboardService } from "@/services";
import type { XpHistoryEntry, XpSource } from "@/types/domain.types";

const SOURCE_META: Record<XpSource, { label: string; icon: LucideIcon }> = {
    VIDEO_COMPLETE: { label: "Lesson completed", icon: BookOpen },
    ASSIGNMENT_SUBMIT: { label: "Assignment submitted", icon: FileText },
    ASSIGNMENT_SCORE: { label: "Assignment scored", icon: Award },
    PRACTICE_COMPLETE: { label: "Practice completed", icon: ClipboardCheck },
    MODULE_COMPLETE: { label: "Module completed", icon: ClipboardCheck },
    MILESTONE_COMPLETE: { label: "Milestone completed", icon: Flag },
    COURSE_COMPLETE: { label: "Course completed", icon: Trophy },
    SUPPORT_PARTICIPATION: { label: "Support session attended", icon: CalendarClock },
};

const EARN_RULES: { source: XpSource; blurb: string }[] = [
    { source: "VIDEO_COMPLETE", blurb: "Finish a lesson video." },
    { source: "PRACTICE_COMPLETE", blurb: "Complete a practice day." },
    { source: "ASSIGNMENT_SUBMIT", blurb: "Submit an assignment." },
    { source: "ASSIGNMENT_SCORE", blurb: "Score well on a reviewed assignment." },
    { source: "MODULE_COMPLETE", blurb: "Finish every lesson in a module." },
    { source: "MILESTONE_COMPLETE", blurb: "Clear a full milestone." },
    { source: "COURSE_COMPLETE", blurb: "Complete an entire course." },
    { source: "SUPPORT_PARTICIPATION", blurb: "Join a live support session." },
];

/**
 * The header's XP badge opens this — a history of every award (already
 * tracked server-side via `XpTransaction`, exposed at `GET /leaderboard/
 * my-xp`) plus a short explainer of how XP is earned. No spend/redeem side
 * — Half Coders' XP isn't a spendable currency, unlike the Programming Hero
 * reference this was modelled on.
 */
export function XpHistoryPanel({
    open,
    onOpenChange,
    totalXp,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    totalXp: number | undefined;
}) {
    const [showEarnInfo, setShowEarnInfo] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["leaderboard", "my-xp"],
        queryFn: () => leaderboardService.myXp({ limit: 30 }),
        enabled: open,
    });

    const entries = data?.data ?? [];

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <span className="inline-flex items-center gap-2">
                    <Trophy className="size-5 text-primary" /> Your XP
                </span>
            }
        >
            <div className="border-y border-border px-6 py-5 text-center">
                <p className="text-3xl font-bold tabular-nums">{(totalXp ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">Total XP earned</p>
                <button
                    type="button"
                    onClick={() => setShowEarnInfo(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary/70"
                >
                    <HelpCircle className="size-3.5" /> How do I earn XP?
                </button>
            </div>

            <ModalBody>
                <p className="mb-3 text-sm font-semibold text-muted-foreground">Recent activity</p>

                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-14" />
                        <Skeleton className="h-14" />
                        <Skeleton className="h-14" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="py-10 text-center">
                        <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" />
                        <p className="font-medium">No XP yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Finish a lesson to start earning.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {entries.map((entry) => (
                            <XpHistoryRow key={entry.id} entry={entry} />
                        ))}
                    </ul>
                )}
            </ModalBody>

            {showEarnInfo && <EarnInfoModal onClose={() => setShowEarnInfo(false)} />}
        </Modal>
    );
}

function XpHistoryRow({ entry }: { entry: XpHistoryEntry }) {
    const meta = SOURCE_META[entry.source];

    return (
        <li className="flex items-start gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <meta.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{meta.label}</p>
                {entry.course && <p className="truncate text-xs text-muted-foreground">{entry.course.title}</p>}
                {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-success">+{entry.points}</span>
        </li>
    );
}

function EarnInfoModal({ onClose }: { onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-60 grid place-items-center bg-black/40 p-4" onClick={onClose}>
            <div
                className="w-full max-w-sm rounded-md border border-border bg-card p-5 text-card-foreground shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-3 flex items-center justify-between">
                    <p className="flex items-center gap-2 font-semibold">
                        <Info className="size-4 text-primary" /> How you earn XP
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                    >
                        <X className="size-4" />
                    </button>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {EARN_RULES.map((rule) => {
                        const Icon = SOURCE_META[rule.source].icon;
                        return (
                            <li key={rule.source} className="flex items-start gap-2.5">
                                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                                <span>{rule.blurb}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
