"use client";

import { FileText, ImageIcon, Paperclip, UploadCloud, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/httpClient";
import { privateFileHref } from "@/lib/privateFile";
import {
    isImageFile,
    SUBMISSION_FILE_MAX_BYTES,
    SUBMISSION_FILE_MAX_COUNT,
    SUBMISSION_FILE_TYPES,
    submissionFileName,
} from "@/lib/submissionFiles";
import { cn } from "@/lib/utils";
import { assignmentService } from "@/services";

export interface AttachedFile {
    url: string;
    name: string;
}

/** A link already stored on a hand-in, as an attached file. */
export const attachedFrom = (url: string): AttachedFile => ({ url, name: submissionFileName(url) });

/**
 * The files on a hand-in: drop them in or pick them — PDFs and images, up to
 * five, 5 MB each — uploaded privately straight away, then attached when the
 * student submits. Each can be taken off again before then.
 */
export default function SubmissionFiles({
    assignmentId,
    files,
    onChange,
    disabled = false,
}: {
    assignmentId: string;
    files: AttachedFile[];
    onChange: (files: AttachedFile[]) => void;
    disabled?: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [over, setOver] = useState(false);
    const room = SUBMISSION_FILE_MAX_COUNT - files.length;

    const add = async (picked: File[]) => {
        if (picked.length === 0) return;
        if (picked.length > room) {
            toast.error(room > 0 ? `You can attach ${room} more ${room === 1 ? "file" : "files"}.` : "That's the most files a hand-in can have.");
            return;
        }
        const wrongType = picked.find((file) => !SUBMISSION_FILE_TYPES.includes(file.type));
        if (wrongType) {
            toast.error(`“${wrongType.name}” isn't a PDF or an image (PNG, JPEG, WebP).`);
            return;
        }
        const tooBig = picked.find((file) => file.size > SUBMISSION_FILE_MAX_BYTES);
        if (tooBig) {
            toast.error(`“${tooBig.name}” is over 5 MB.`);
            return;
        }

        setProgress(0);
        try {
            const uploaded = await assignmentService.uploadFiles(assignmentId, picked, setProgress);
            onChange([...files, ...uploaded]);
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Couldn't upload that. Try again."));
        } finally {
            setProgress(null);
            if (input.current) input.current.value = "";
        }
    };

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        setOver(false);
        if (!disabled && progress === null) void add([...event.dataTransfer.files]);
    };

    return (
        <div className="space-y-2">
            {files.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {files.map((file) => (
                        <li key={file.url} className="flex items-center gap-3 px-3 py-2 text-sm">
                            {isImageFile(file.url) || /\.(png|jpe?g|webp)$/i.test(file.name) ? (
                                <ImageIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            ) : (
                                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            )}
                            <a href={privateFileHref(file.url)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                                {file.name}
                            </a>
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => onChange(files.filter((entry) => entry.url !== file.url))}
                                    aria-label={`Remove ${file.name}`}
                                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {!disabled && room > 0 && (
                <div
                    onDragOver={(event) => {
                        event.preventDefault();
                        setOver(true);
                    }}
                    onDragLeave={() => setOver(false)}
                    onDrop={onDrop}
                    className={cn(
                        "flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors",
                        over ? "border-primary bg-primary/5" : "border-border",
                    )}
                >
                    {progress === null ? (
                        <>
                            <button
                                type="button"
                                onClick={() => input.current?.click()}
                                className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 font-medium transition-colors hover:bg-secondary/70"
                            >
                                <Paperclip className="size-4" aria-hidden /> Attach files
                            </button>
                            <span className="text-xs text-muted-foreground">
                                or drop them here · PDF or images, up to {room} more, 5 MB each
                            </span>
                        </>
                    ) : (
                        <span className="flex w-full items-center gap-3 text-xs text-muted-foreground">
                            <UploadCloud className="size-4 shrink-0 animate-pulse text-primary" aria-hidden />
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                                <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                            </span>
                            Uploading… {progress}%
                        </span>
                    )}
                    <input
                        ref={input}
                        type="file"
                        multiple
                        accept={SUBMISSION_FILE_TYPES.join(",")}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden
                        onChange={(event) => void add([...(event.target.files ?? [])])}
                    />
                </div>
            )}
        </div>
    );
}
