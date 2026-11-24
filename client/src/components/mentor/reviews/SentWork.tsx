"use client";

import { Copy, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { linkify } from "@/lib/linkify";
import { privateFileHref } from "@/lib/privateFile";
import { submissionFileName } from "@/lib/submissionFiles";

/**
 * A hand-in exactly as the student sent it: their text as they typed it —
 * line breaks and all, nothing split out or reworded; links can be clicked —
 * then any files they attached.
 */
export default function SentWork({ content, submissionUrl, fileUrls }: { content: string | null; submissionUrl: string | null; fileUrls: string[] }) {
    const text = content ?? "";
    // Older hand-ins kept the link apart from the text: put it back where it was typed, on top.
    const shown = submissionUrl && !text.includes(submissionUrl) ? [submissionUrl, text].filter(Boolean).join("\n\n") : text;

    if (!shown.trim() && fileUrls.length === 0) {
        return <p className="text-sm text-muted-foreground">Nothing written and nothing attached.</p>;
    }

    return (
        <div className="space-y-3">
            {shown.trim() && (
                <div className="relative rounded-card border border-border bg-secondary/30">
                    <p className="whitespace-pre-wrap wrap-break-word px-4 py-3 pr-12 text-sm leading-relaxed">{linkify(shown)}</p>
                    <button
                        type="button"
                        aria-label="Copy what they wrote"
                        title="Copy"
                        onClick={() => {
                            void navigator.clipboard?.writeText(shown).then(
                                () => toast.success("Copied."),
                                () => toast.error("Couldn't copy — select it instead."),
                            );
                        }}
                        className="absolute right-2 top-2 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                        <Copy className="size-4" aria-hidden />
                    </button>
                </div>
            )}

            {fileUrls.length > 0 && (
                <ul className="divide-y divide-border rounded-card border border-border">
                    {fileUrls.map((file) => (
                        <li key={file}>
                            <a
                                href={privateFileHref(file)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40"
                            >
                                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="min-w-0 flex-1 truncate">{submissionFileName(file)}</span>
                                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
