"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import MaterialList from "@/components/learn/MaterialList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/httpClient";
import { linkify } from "@/lib/linkify";
import { formatDateTime } from "@/lib/utils";
import { practiceService } from "@/services";
import type { CourseLearning, LearningMilestone } from "@/types/domain.types";

type PracticeDay = LearningMilestone["practiceDays"][number];

/**
 * A practice day's own page in the player, its last stop: what it's for, its
 * lessons (each opens in the player, like a module's), a note to self and the
 * button that marks the day done. Practice is self-marked — nothing to hand
 * in, no mentor review.
 */
export default function PracticePane({
    slug,
    practice,
    isPreview,
    onOpenMaterial,
    onCompleted,
}: {
    slug: string;
    practice: PracticeDay;
    /** Staff previewing the course — there's nothing to mark. */
    isPreview: boolean;
    onOpenMaterial: (materialId: string) => void;
    /** After it's marked done: on to whatever comes next. */
    onCompleted: () => void;
}) {
    const queryClient = useQueryClient();
    const [note, setNote] = useState("");

    // Only the note comes from here — the rest is already in the course.
    const { data: detail } = useQuery({
        queryKey: ["practice", practice.id],
        queryFn: () => practiceService.get(practice.id),
        enabled: !isPreview,
    });

    useEffect(() => {
        setNote(detail?.completion?.note ?? "");
    }, [detail?.completion?.note, practice.id]);

    /** Shows the new state in the course at once; the refetch confirms it. */
    const setDone = (isCompleted: boolean) => {
        queryClient.setQueryData<CourseLearning>(
            ["learning", slug],
            (current) =>
                current && {
                    ...current,
                    curriculum: current.curriculum.map((milestone) => ({
                        ...milestone,
                        practiceDays: milestone.practiceDays.map((day) => (day.id === practice.id ? { ...day, isCompleted } : day)),
                    })),
                },
        );
        void queryClient.invalidateQueries({ queryKey: ["practice", practice.id] });
        void queryClient.invalidateQueries({ queryKey: ["learning", slug] });
    };

    const complete = useMutation({
        mutationFn: () => practiceService.complete(practice.id, note.trim() || undefined),
        onSuccess: () => {
            const wasDone = practice.isCompleted;
            setDone(true);
            if (wasDone) {
                toast.success("Notes saved.");
            } else {
                toast.success("Nice work — practice day done.");
                onCompleted();
            }
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that.")),
    });

    const uncomplete = useMutation({
        mutationFn: () => practiceService.uncomplete(practice.id),
        onSuccess: () => {
            setDone(false);
            toast.success("Marked as not done.");
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that.")),
    });

    const completedAt = detail?.completion?.completedAt ?? practice.completedAt;

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">
                        <Dumbbell className="size-3" /> Practice day
                    </Badge>
                    {practice.isCompleted && (
                        <Badge variant="success">
                            <CheckCircle2 className="size-3" /> Done
                        </Badge>
                    )}
                </div>
                <h2 className="mt-3 text-xl font-bold leading-tight wrap-break-word">{practice.title}</h2>
                {practice.description && (
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground wrap-break-word">{linkify(practice.description)}</p>
                )}
            </div>

            <MaterialList materials={practice.materials} onOpen={onOpenMaterial} intro="Work through these, then mark the day done below." />

            {isPreview ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Students write a note to themselves here and mark the day done — nothing to hand in.
                </p>
            ) : (
                <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
                    <div className="space-y-1.5">
                        <Label htmlFor="practice-note">
                            Notes for yourself <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                            id="practice-note"
                            rows={4}
                            maxLength={2000}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="What you practised, what still feels shaky…"
                        />
                    </div>

                    {practice.isCompleted ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <Button onClick={() => complete.mutate()} isLoading={complete.isPending}>
                                Save notes
                            </Button>
                            <Button variant="outline" onClick={() => uncomplete.mutate()} isLoading={uncomplete.isPending}>
                                Mark as not done
                            </Button>
                            {completedAt && <span className="text-xs text-muted-foreground">Done {formatDateTime(completedAt)}</span>}
                        </div>
                    ) : (
                        <Button size="lg" onClick={() => complete.mutate()} isLoading={complete.isPending}>
                            {!complete.isPending && <CheckCircle2 className="size-4" />}
                            Mark the day done
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
