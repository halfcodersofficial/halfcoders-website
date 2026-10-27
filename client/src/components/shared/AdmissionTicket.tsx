"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, Download, Share2, Ticket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { admissionTicketFile, type AdmissionTicketDrawing } from "@/lib/admissionTicket";
import { SITE_DOMAIN } from "@/lib/brand";
import envConfig from "@/lib/envConfig";
import { cn } from "@/lib/utils";
import { admissionTicketService } from "@/services";
import type { MyAdmissionTicket } from "@/types/domain.types";

const siteHost = () => {
    try {
        return new URL(envConfig.siteUrl).host;
    } catch {
        return SITE_DOMAIN;
    }
};

/** What the canvas needs from a student's ticket as the API sends it. */
export const drawingOf = ({ ticket, learner, course }: MyAdmissionTicket): AdmissionTicketDrawing => ({
    ...ticket,
    learnerName: learner.name,
    learnerImage: learner.image,
    courseTitle: course.title,
    siteHost: siteHost(),
});

export const admissionTicketHost = siteHost;

/**
 * The ticket drawn to a PNG, redrawn when `drawing` changes (after `delayMs`
 * of quiet — the admin's preview redraws as they type). Keeps the last good
 * picture on screen while the next one is drawn.
 */
export function useAdmissionTicketPicture(drawing: AdmissionTicketDrawing | null, slug: string, delayMs = 0) {
    const [picture, setPicture] = useState<{ file: File; url: string } | null>(null);
    const [failed, setFailed] = useState(false);
    const urlRef = useRef<string | null>(null);
    const key = drawing ? JSON.stringify(drawing) : null;

    useEffect(() => {
        if (!key) return;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                const file = await admissionTicketFile(JSON.parse(key) as AdmissionTicketDrawing, slug);
                if (cancelled) return;
                const url = URL.createObjectURL(file);
                if (urlRef.current) URL.revokeObjectURL(urlRef.current);
                urlRef.current = url;
                setPicture({ file, url });
                setFailed(false);
            } catch {
                if (!cancelled) setFailed(true);
            }
        }, delayMs);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [key, slug, delayMs]);

    useEffect(
        () => () => {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        },
        [],
    );

    return { file: picture?.file ?? null, url: picture?.url ?? null, failed };
}

/** The drawn ticket, 4:5, with a placeholder of the same shape until it's ready. */
export function AdmissionTicketPicture({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
    return (
        <div className={cn("relative aspect-[4/5] overflow-hidden rounded-card bg-editor shadow-panel", className)}>
            {url ? (
                // A blob: URL drawn in the browser — next/image has nothing to optimise.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={alt} className="size-full object-cover" />
            ) : (
                <Skeleton className="size-full rounded-none" />
            )}
        </div>
    );
}

/**
 * Share (the phone's own sheet, straight into WhatsApp, Messenger, Facebook…),
 * download, and on a computer copy the picture to paste into a post. Share
 * and copy only show where the browser can do them.
 */
export function AdmissionTicketActions({ file, shareText, className }: { file: File | null; shareText: string; className?: string }) {
    const [canShare, setCanShare] = useState(false);
    const [canCopy, setCanCopy] = useState(false);

    useEffect(() => {
        setCanShare(Boolean(file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })));
        setCanCopy(typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function");
    }, [file]);

    const download = () => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const share = async () => {
        if (!file) return;
        try {
            await navigator.share({ files: [file], title: "My Half Coders admission ticket", text: shareText });
        } catch (error) {
            // Closing the share sheet isn't a failure.
            if ((error as DOMException)?.name !== "AbortError") toast.error("Couldn't open sharing here. Download it and share the picture instead.");
        }
    };

    const copy = async () => {
        if (!file) return;
        try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
            toast.success("Copied. Paste it into a post or a chat.");
        } catch {
            toast.error("Couldn't copy the picture. Download it instead.");
        }
    };

    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {canShare && (
                <Button type="button" onClick={share} disabled={!file}>
                    <Share2 /> Share
                </Button>
            )}
            <Button type="button" variant={canShare ? "outline" : "default"} onClick={download} disabled={!file}>
                <Download /> Download
            </Button>
            {canCopy && !canShare && (
                <Button type="button" variant="outline" onClick={copy} disabled={!file}>
                    <Copy /> Copy image
                </Button>
            )}
        </div>
    );
}

const shareTextOf = (ticket: MyAdmissionTicket) =>
    `I'm in! Just enrolled in ${ticket.course.title} at Half Coders. ${envConfig.siteUrl}/courses/${ticket.course.slug}`;

const ticketQuery = (courseId: string) => ({
    queryKey: ["admission-ticket", "mine", courseId],
    queryFn: () => admissionTicketService.mine(courseId),
    retry: false,
    staleTime: 5 * 60_000,
});

/** The picture beside what it is and what to do with it. */
function TicketBody({ ticket, compact = false }: { ticket: MyAdmissionTicket; compact?: boolean }) {
    const { file, url, failed } = useAdmissionTicketPicture(drawingOf(ticket), ticket.course.slug);

    return (
        <div className={cn("grid items-center gap-6", !compact && "md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:gap-8")}>
            <AdmissionTicketPicture
                url={url}
                alt={`Admission ticket for ${ticket.learner.name}, ${ticket.course.title}`}
                className={cn("w-full", compact ? "mx-auto max-w-sm" : "max-w-xs max-md:mx-auto")}
            />
            <div className="min-w-0">
                {!compact && (
                    <>
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Admission ticket</p>
                        <h2 className="mt-1 text-xl font-bold leading-snug">Your seat is confirmed. Here&apos;s your ticket.</h2>
                    </>
                )}
                <p className={cn("text-sm text-muted-foreground", !compact && "mt-2")}>
                    Save it, or share it with friends. It has your name{ticket.ticket.showPhoto ? " and profile photo" : ""} on it.
                </p>
                {failed ? (
                    <p className="mt-4 text-sm text-destructive">The ticket couldn&apos;t be drawn in this browser. Try another one.</p>
                ) : (
                    <AdmissionTicketActions file={file} shareText={shareTextOf(ticket)} className="mt-4" />
                )}
            </div>
        </div>
    );
}

/**
 * Right after enrolling (the paid receipt): the student's ticket, when the
 * course gives one. Nothing at all otherwise — no empty frame.
 */
export function AdmissionTicketPanel({ courseId, className }: { courseId: string; className?: string }) {
    const { data } = useQuery(ticketQuery(courseId));
    if (!data) return null;

    return (
        <section className={cn("rounded-card border border-border bg-card p-4 shadow-sm sm:p-6", className)}>
            <TicketBody ticket={data} />
        </section>
    );
}

/** On a dashboard course tile: opens the ticket again whenever they want it. */
export function AdmissionTicketButton({ courseId }: { courseId: string }) {
    const [open, setOpen] = useState(false);
    const { data, isLoading, isError } = useQuery({ ...ticketQuery(courseId), enabled: open });

    return (
        <>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                <Ticket /> Ticket
            </Button>
            <Modal open={open} onOpenChange={setOpen} title="Your admission ticket" size="md">
                <ModalBody>
                    {data ? (
                        <TicketBody ticket={data} compact />
                    ) : isError ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">This course doesn&apos;t have a ticket right now.</p>
                    ) : (
                        isLoading && <Skeleton className="mx-auto aspect-[4/5] w-full max-w-sm rounded-card" />
                    )}
                </ModalBody>
            </Modal>
        </>
    );
}
