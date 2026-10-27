"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Dumbbell } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/httpClient";
import { renderLightMarkdown } from "@/lib/lightMarkdown";
import { formatDateTime } from "@/lib/utils";
import { practiceService } from "@/services";

export default function PracticeDayPage() {
    const { slug, practiceDayId } = useParams<{ slug: string; practiceDayId: string }>();
    const queryClient = useQueryClient();
    const [note, setNote] = useState("");

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["practice", practiceDayId],
        queryFn: () => practiceService.get(practiceDayId),
    });

    useEffect(() => {
        if (data?.completion?.note) setNote(data.completion.note);
    }, [data?.completion?.note]);

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ["practice", practiceDayId] });
        void queryClient.invalidateQueries({ queryKey: ["learning", slug] });
    };

    const complete = useMutation({
        mutationFn: () => practiceService.complete(practiceDayId, note.trim() || undefined),
        onSuccess: () => {
            toast.success("Nice work — practice day marked complete.");
            invalidate();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't save that.")),
    });

    const uncomplete = useMutation({
        mutationFn: () => practiceService.uncomplete(practiceDayId),
        onSuccess: () => {
            toast.success("Marked as not complete.");
            invalidate();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update that.")),
    });

    if (isLoading) {
        return (
            <div className="container-page max-w-3xl space-y-4 py-10">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="container-page grid min-h-[70dvh] max-w-md place-items-center text-center">
                <div>
                    <AlertTriangle className="mx-auto mb-3 size-10 text-muted-foreground" />
                    <p className="font-medium">Can&apos;t open this practice day</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "It may not be published yet.")}
                    </p>
                    <Button asChild variant="outline" className="mt-6">
                        <Link href={`/learn/${slug}`}>Back to course</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-background">
            <header className="border-b border-border">
                <div className="container-page flex h-16 items-center gap-3">
                    <BackButton href={`/learn/${slug}`} label="Back to course" compact />
                    <div className="min-w-0">
                        <h1 className="truncate font-semibold">{data.title}</h1>
                        <p className="truncate text-xs text-muted-foreground">
                            Milestone {String(data.milestone.order).padStart(2, "0")} · {data.course.title}
                        </p>
                    </div>
                </div>
            </header>

            <div className="container-page max-w-3xl space-y-6 py-10">
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="warning">
                        <Dumbbell className="size-3" /> Practice day
                    </Badge>
                    {data.isCompleted && (
                        <Badge variant="success">
                            <CheckCircle2 className="size-3" /> Completed
                        </Badge>
                    )}
                </div>

                <Card className="shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        {data.description && (
                            <p className="whitespace-pre-line text-sm text-muted-foreground">
                                {data.description}
                            </p>
                        )}

                        {data.instructions && (
                            <div className="border-t border-border pt-4">
                                <h2 className="mb-2 font-semibold">What to do</h2>
                                <div
                                    className="text-sm leading-relaxed text-muted-foreground"
                                    // Escaped and link-restricted by renderLightMarkdown.
                                    dangerouslySetInnerHTML={{ __html: renderLightMarkdown(data.instructions) }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Practice is self-marked — there's nothing to hand in and no
                    mentor review, which is the point of it being practice. */}
                <Card className="shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <div className="space-y-1.5">
                            <Label htmlFor="note">
                                Notes for yourself{" "}
                                <span className="font-normal text-muted-foreground">(optional)</span>
                            </Label>
                            <Textarea
                                id="note"
                                rows={4}
                                maxLength={2000}
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                placeholder="What you practised, what still feels shaky…"
                            />
                        </div>

                        {data.isCompleted ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <Button onClick={() => complete.mutate()} isLoading={complete.isPending}>
                                    Save notes
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => uncomplete.mutate()}
                                    isLoading={uncomplete.isPending}
                                >
                                    Mark as not complete
                                </Button>
                                {data.completion && (
                                    <span className="text-xs text-muted-foreground">
                                        Completed {formatDateTime(data.completion.completedAt)}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <Button size="lg" onClick={() => complete.mutate()} isLoading={complete.isPending}>
                                <CheckCircle2 className="size-4" />
                                Mark as complete
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
