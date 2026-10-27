"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";

type Line = { key: string; id?: string; title: string; description: string; maxPoints: string };

let nextKey = 0;
const blank = (): Line => ({ key: `new-${(nextKey += 1)}`, title: "", description: "", maxPoints: "" });

/**
 * How an assignment is marked, line by line. The lines' points add up to the
 * assignment's marks; a mentor then scores each line and the mark is their
 * sum. Students see the lines before they hand in, and the breakdown after.
 * No lines means one overall score, as before.
 */
export default function RubricEditor({ assignmentId }: { assignmentId: string }) {
    const queryClient = useQueryClient();
    const key = ["staff", "rubric", assignmentId];
    const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => curriculumAuthoring.getRubric(assignmentId) });
    const [lines, setLines] = useState<Line[]>([]);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!data) return;
        setLines(data.criteria.map((line) => ({ key: line.id, id: line.id, title: line.title, description: line.description ?? "", maxPoints: String(line.maxPoints) })));
        setDirty(false);
    }, [data]);

    const save = useMutation({
        mutationFn: () =>
            curriculumAuthoring.setRubric(
                assignmentId,
                lines.map((line) => ({ id: line.id, title: line.title.trim(), description: line.description.trim() || undefined, maxPoints: Number(line.maxPoints) })),
            ),
        onSuccess: (saved) => {
            queryClient.setQueryData(key, saved);
            toast.success(saved.criteria.length ? "Rubric saved." : "Rubric removed — it's marked with one score again.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't save the rubric.")),
    });

    const change = (index: number, patch: Partial<Line>) => {
        setLines((current) => current.map((line, at) => (at === index ? { ...line, ...patch } : line)));
        setDirty(true);
    };
    const move = (index: number, by: number) => {
        setLines((current) => {
            const next = [...current];
            const [line] = next.splice(index, 1);
            next.splice(index + by, 0, line);
            return next;
        });
        setDirty(true);
    };
    const removeLine = (index: number) => {
        setLines((current) => current.filter((_, at) => at !== index));
        setDirty(true);
    };

    if (isLoading || !data) return <Skeleton className="h-40 rounded-2xl" />;

    const total = data.totalMarks;
    const sum = lines.reduce((acc, line) => acc + (Number(line.maxPoints) || 0), 0);
    const complete = lines.every((line) => line.title.trim().length >= 2 && Number(line.maxPoints) >= 1);
    const balanced = lines.length === 0 || sum === total;
    const droppingScored = data.marked && data.criteria.some((line) => !lines.some((kept) => kept.id === line.id));

    const onSave = async () => {
        if (
            droppingScored &&
            !(await confirmAction({
                title: "Drop lines that have marks on them?",
                text: "Hand-ins already marked keep their scores, but the points given on the lines you removed go with them.",
                confirmText: "Save anyway",
            }))
        )
            return;
        save.mutate();
    };

    return (
        <section aria-labelledby="rubric-title" className="rounded-2xl border border-border bg-card shadow-sm">
            <header className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6", lines.length > 0 && "border-b border-border")}>
                <div>
                    <h2 id="rubric-title" className="flex items-center gap-2 font-semibold">
                        <ListChecks className="size-4 text-primary" aria-hidden /> Marking rubric
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {lines.length === 0 ? `Marked with one score out of ${total}. Add lines to mark it part by part.` : "Students see these lines, and their points on each once marked."}
                    </p>
                </div>
                {lines.length > 0 && (
                    <p className={cn("text-sm font-semibold tabular-nums", balanced ? "text-success" : "text-amber-700 dark:text-amber-400")}>
                        {sum} / {total}
                    </p>
                )}
            </header>

            {lines.length > 0 && (
                <ol className="divide-y divide-border">
                    {lines.map((line, index) => (
                        <li key={line.key} className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-start sm:px-6">
                            <div className="space-y-2">
                                <Input value={line.title} onChange={(event) => change(index, { title: event.target.value })} placeholder="e.g. Design" aria-label={`Line ${index + 1}: what's marked`} maxLength={160} />
                                <Input
                                    value={line.description}
                                    onChange={(event) => change(index, { description: event.target.value })}
                                    placeholder="What full marks looks like (optional)"
                                    aria-label={`Line ${index + 1}: what full marks looks like`}
                                    maxLength={500}
                                    className="text-xs"
                                />
                            </div>
                            <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={line.maxPoints}
                                onChange={(event) => change(index, { maxPoints: event.target.value })}
                                placeholder="Points"
                                aria-label={`Line ${index + 1}: points`}
                            />
                            <div className="flex gap-1">
                                <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                                    <ArrowUp className="size-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={index === lines.length - 1} onClick={() => move(index, 1)}>
                                    <ArrowDown className="size-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${index + 1}`} onClick={() => removeLine(index)}>
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setLines((current) => [...current, blank()]);
                        setDirty(true);
                    }}
                >
                    <Plus /> Add a line
                </Button>
                <div className="flex items-center gap-3">
                    {!balanced && <p className="text-xs text-amber-700 dark:text-amber-400">The lines must add up to {total}.</p>}
                    <Button type="button" size="sm" disabled={!dirty || !balanced || !complete} isLoading={save.isPending} onClick={() => void onSave()}>
                        {lines.length === 0 && data.criteria.length > 0 ? "Remove the rubric" : "Save rubric"}
                    </Button>
                </div>
            </footer>
        </section>
    );
}
