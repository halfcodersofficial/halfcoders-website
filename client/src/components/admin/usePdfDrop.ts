"use client";

import { useState, type DragEvent } from "react";

export const PDF_MAX_BYTES = 5 * 1024 * 1024;

/** `undefined` when the file passes; otherwise the message to show the admin. */
export function validatePdfFile(file: File): string | undefined {
    if (file.type !== "application/pdf") return "Choose a PDF file.";
    if (file.size > PDF_MAX_BYTES) return "File must be 5 MB or smaller.";
    return undefined;
}

/**
 * Drag-and-drop for a single-file drop zone — a PDF or an image. Returns
 * `dragActive` (to style the zone while something is being dragged over it)
 * and the handlers to spread onto the container — validating the dropped file
 * and doing anything with it stays the caller's job, same as the
 * `<input type="file">` path already is.
 */
export function useFileDrop(onFile: (file: File) => void, disabled = false) {
    const [dragActive, setDragActive] = useState(false);

    return {
        dragActive,
        dropHandlers: {
            onDragOver: (event: DragEvent<HTMLElement>) => {
                event.preventDefault();
                if (!disabled) setDragActive(true);
            },
            onDragLeave: () => setDragActive(false),
            onDrop: (event: DragEvent<HTMLElement>) => {
                event.preventDefault();
                setDragActive(false);
                if (disabled) return;
                const file = event.dataTransfer.files?.[0];
                if (file) onFile(file);
            },
        },
    };
}
