"use client";

import { FileText, Maximize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody } from "@/components/ui/modal";
import { renderLightMarkdown } from "@/lib/lightMarkdown";

interface ReadingLessonProps {
    title: string;
    /** The lesson's text, in the light markdown lessons are written in. */
    content: string;
}

/**
 * A text lesson, in a box the same shape and size as the video player, so the
 * page doesn't jump from one lesson to the next. What doesn't fit fades out
 * under a "See more" button, which opens the whole message in a big popup.
 * A short message that fits has no fade and no button.
 */
export default function ReadingLesson({ title, content }: ReadingLessonProps) {
    const clipRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [overflowing, setOverflowing] = useState(false);
    const [open, setOpen] = useState(false);

    // Escaped and link-restricted by renderLightMarkdown.
    const html = useMemo(() => renderLightMarkdown(content), [content]);
    const readingTime = `Reading · ${Math.max(1, Math.round(content.trim().split(/\s+/).length / 200))} min`;

    // Whether the text runs past the box — measured again when the box
    // resizes (window, sidebar) or the text grows (a font loading in).
    useEffect(() => {
        const clip = clipRef.current;
        const text = textRef.current;
        if (!clip || !text) return;
        const measure = () => setOverflowing(text.offsetHeight > clip.clientHeight + 1);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(clip);
        observer.observe(text);
        return () => observer.disconnect();
    }, [html]);

    return (
        <>
            {/* The player's shape: 16:9 from `sm` up. A phone gets a taller
                4:3 box, so it shows more than three lines before "See more". */}
            <article className="relative mx-auto flex aspect-4/3 w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-card shadow-panel ring-1 ring-border sm:aspect-video">
                <p className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-8 sm:pb-4 sm:pt-6">
                    <FileText className="size-4" aria-hidden /> {readingTime}
                </p>

                <div ref={clipRef} className="min-h-0 flex-1 overflow-hidden">
                    <div ref={textRef} className="px-4 pb-4 sm:px-8 sm:pb-6">
                        <div className="max-w-3xl text-[15px] leading-relaxed wrap-break-word" dangerouslySetInnerHTML={{ __html: html }} />
                    </div>
                </div>

                {overflowing && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-28 items-end justify-end bg-linear-to-t from-card via-card/90 to-transparent px-4 pb-4 sm:h-32 sm:px-6 sm:pb-5">
                        <Button
                            variant="brand-outline"
                            size="sm"
                            className="pointer-events-auto bg-card shadow-sm"
                            aria-haspopup="dialog"
                            onClick={() => setOpen(true)}
                        >
                            See more <Maximize2 aria-hidden />
                        </Button>
                    </div>
                )}
            </article>

            <Modal open={open} onOpenChange={setOpen} size="xl" title={title} description={readingTime}>
                <ModalBody className="sm:px-8 sm:py-6">
                    <div className="max-w-3xl text-[15px] leading-relaxed wrap-break-word" dangerouslySetInnerHTML={{ __html: html }} />
                </ModalBody>
            </Modal>
        </>
    );
}
