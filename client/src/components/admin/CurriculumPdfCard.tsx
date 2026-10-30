"use client";

import { useMutation } from "@tanstack/react-query";
import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useFileDrop, validatePdfFile } from "@/components/admin/usePdfDrop";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { privateFileHref } from "@/lib/privateFile";
import { cn, formatDateTime } from "@/lib/utils";
import { adminService } from "@/services/admin";

/**
 * The static, pre-enrolment roadmap PDF — deliberately its own card, separate
 * from the "Curriculum" nav button above (the live milestone/module editor).
 * Uploading, replacing or removing this file never touches milestone/module
 * publish state, and publishing content never touches this file.
 */
export default function CurriculumPdfCard({
    courseId,
    curriculumPdfUrl,
    curriculumPdfFileName,
    curriculumPdfUpdatedAt,
    onChanged,
}: {
    courseId: string;
    curriculumPdfUrl: string | null;
    curriculumPdfFileName: string | null;
    curriculumPdfUpdatedAt: string | null;
    onChanged: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    const upload = useMutation({
        mutationFn: (file: File) => adminService.uploadCurriculumPdf(courseId, file),
        onSuccess: () => {
            toast.success("Curriculum PDF uploaded.");
            onChanged();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't upload the PDF.")),
    });

    const remove = useMutation({
        mutationFn: () => adminService.removeCurriculumPdf(courseId),
        onSuccess: () => {
            toast.success("Curriculum PDF removed.");
            onChanged();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't remove the PDF.")),
    });

    const busy = upload.isPending || remove.isPending;

    const handleFile = (file: File) => {
        const error = validatePdfFile(file);
        if (error) {
            toast.error(error);
            return;
        }
        upload.mutate(file);
    };

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) handleFile(file);
    };

    const { dragActive, dropHandlers } = useFileDrop(handleFile, busy);

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
                The roadmap a student downloads from the course listing before enrolling — a single PDF you
                upload, independent of the milestone/module curriculum. Signed-in visitors can download it;
                guests are asked to create an account first.
            </p>

            {curriculumPdfUrl ? (
                <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-4 shadow-card">
                    <FileText className="size-6 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                        <a
                            href={privateFileHref(curriculumPdfUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate font-medium text-primary hover:underline"
                        >
                            {curriculumPdfFileName ?? "curriculum.pdf"}
                        </a>
                        <p className="text-xs text-muted-foreground">
                            {curriculumPdfUpdatedAt
                                ? `Updated ${formatDateTime(curriculumPdfUpdatedAt)}`
                                : "Uploaded"}
                        </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            isLoading={upload.isPending}
                            onClick={() => inputRef.current?.click()}
                        >
                            <Upload /> Replace
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            isLoading={remove.isPending}
                            className="text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                                if (
                                    await confirmAction({
                                        title: "Remove the curriculum PDF?",
                                        text: "Students won't be able to download a roadmap for this course until a new one is uploaded.",
                                        confirmText: "Remove PDF",
                                    })
                                ) {
                                    remove.mutate();
                                }
                            }}
                        >
                            <Trash2 /> Remove
                        </Button>
                    </div>
                </div>
            ) : (
                <div
                    {...dropHandlers}
                    className={cn(
                        "rounded-md border border-dashed p-6 text-center transition-colors",
                        dragActive ? "border-primary bg-primary/5" : "border-border",
                    )}
                >
                    <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
                    <p className="text-sm font-medium">No curriculum PDF uploaded yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Drag and drop a PDF here, or browse — students who click
                        &ldquo;Curriculum&rdquo; on the listing page see a &ldquo;not available
                        yet&rdquo; message until one is uploaded.
                    </p>
                    <Button
                        type="button"
                        className="mt-4"
                        disabled={busy}
                        isLoading={upload.isPending}
                        onClick={() => inputRef.current?.click()}
                    >
                        <Upload /> Upload PDF
                    </Button>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onChange}
            />
        </div>
    );
}
