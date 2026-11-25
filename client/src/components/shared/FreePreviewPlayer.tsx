"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import LessonVideoPlayer from "@/components/learn/LessonVideoPlayer";

interface FreePreviewPlayerProps {
    video: { title: string; youtubeVideoId: string } | null;
    onClose: () => void;
}

/**
 * The modal a free-preview lesson opens in from the public course page.
 *
 * Radix's dialog for the parts that are easy to get wrong: focus moves into
 * the dialog and back out on close, Escape and the overlay both dismiss it,
 * and the page behind is marked inert for screen readers. The player is only
 * mounted while open, so closing actually stops the video.
 *
 * It's the lesson player, as inside the course: a preview is one of the
 * course's own lessons, so it gets the same cover over YouTube — no title,
 * channel or "Watch on YouTube" link to take the video away from.
 */
export default function FreePreviewPlayer({ video, onClose }: FreePreviewPlayerProps) {
    return (
        <Dialog.Root open={video !== null} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-black shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=open]:zoom-in-95"
                    aria-describedby={undefined}
                >
                    <div className="flex items-center justify-between gap-3 bg-card px-4 py-3">
                        <Dialog.Title className="min-w-0 truncate text-sm font-semibold">
                            <span className="mr-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                                Free preview
                            </span>
                            {video?.title}
                        </Dialog.Title>
                        <Dialog.Close
                            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            aria-label="Close the preview"
                        >
                            <X className="size-4" />
                        </Dialog.Close>
                    </div>

                    {video && <LessonVideoPlayer key={video.youtubeVideoId} youtubeVideoId={video.youtubeVideoId} title={video.title} autoPlay />}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
