"use client";

import { ExternalLink, EyeOff, Pencil, Radio } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import { STATE_LABEL, type Filed } from "./recordingState";
import { publishLabel, usePublishRecording } from "./usePublishRecording";

/**
 * A recording, played as students will see it, with where it stands and the
 * one thing to do about it — make it live, or hide it — plus the way into its
 * course's manager to edit or move it.
 */
export default function RecordingPreview({
    filed,
    courseTitle,
    students,
    manageHref,
    onClose,
}: {
    filed: Filed | null;
    courseTitle: string;
    students: number;
    manageHref: string;
    onClose: () => void;
}) {
    const publish = usePublishRecording();

    return (
        <Modal
            open={filed !== null}
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            title={filed?.recording.title ?? "Recording"}
            description={filed ? `${courseTitle} · ${filed.topic.title}` : undefined}
        >
            {filed && (
                <>
                    <ModalBody className="space-y-4">
                        <div className="aspect-video overflow-hidden rounded-lg bg-black">
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${filed.recording.youtubeVideoId}?rel=0&modestbranding=1`}
                                title={filed.recording.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="size-full"
                            />
                        </div>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span
                                className={cn(
                                    "rounded-full px-2 py-0.5 font-semibold",
                                    filed.state === "live" ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                                )}
                            >
                                {STATE_LABEL[filed.state]}
                            </span>
                            {filed.recording.duration > 0 && <span className="tabular-nums">{formatDuration(filed.recording.duration)}</span>}
                            <span>Added {formatDate(filed.recording.createdAt)}</span>
                            {filed.state === "live" && (
                                <span>
                                    Watched by <span className="font-semibold tabular-nums text-foreground">{filed.recording._count.watches}</span> of {students}
                                </span>
                            )}
                        </p>
                        {filed.recording.description && <p className="whitespace-pre-line text-sm">{filed.recording.description}</p>}
                        {filed.state === "waiting" && (
                            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                                It&apos;s published, but its topic isn&apos;t — students can&apos;t see it until the topic goes live.
                            </p>
                        )}
                    </ModalBody>
                    <ModalFooter className="flex-wrap">
                        <Button asChild variant="ghost" className="mr-auto">
                            <Link href={manageHref}>
                                <Pencil /> Edit in course
                            </Link>
                        </Button>
                        <Button asChild variant="ghost">
                            <a href={filed.recording.youtubeUrl} target="_blank" rel="noopener noreferrer">
                                YouTube <ExternalLink />
                            </a>
                        </Button>
                        {filed.state === "live" ? (
                            <Button
                                variant="outline"
                                isLoading={publish.isPending}
                                onClick={() => publish.mutate({ filed, hide: true }, { onSuccess: onClose })}
                            >
                                {!publish.isPending && <EyeOff />} Hide from students
                            </Button>
                        ) : (
                            <Button isLoading={publish.isPending} onClick={() => publish.mutate({ filed }, { onSuccess: onClose })}>
                                {!publish.isPending && <Radio />} {publishLabel(filed)}
                            </Button>
                        )}
                    </ModalFooter>
                </>
            )}
        </Modal>
    );
}
