"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The chrome around a live preview: a sticky panel that sits beside the form
 * it mirrors.
 *
 * Sticky with its own scrollbar, because these forms are taller than the
 * viewport and a preview that scrolls away is one you have to hunt for after
 * every edit. Collapsible, because sometimes the full width is wanted back
 * for editing.
 */
interface PreviewPanelProps {
    title: string;
    /** What is being previewed, and where it will actually appear. */
    description: ReactNode;
    /**
     * From `xl`, fill a fixed-height grid cell instead of sticking to the
     * viewport — for an editor laid out as two equal panes. Only the preview
     * itself scrolls; the heading stays put.
     */
    fill?: boolean;
    children: ReactNode;
}

export default function PreviewPanel({ title, description, fill = false, children }: PreviewPanelProps) {
    const [open, setOpen] = useState(true);
    const t = useT();

    return (
        <aside
            className={
                fill
                    ? "min-w-0 xl:min-h-0"
                    : "xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto"
            }
        >
            <Card className={cn("shadow-card", fill && open && "xl:flex xl:h-full xl:flex-col")}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2">
                            <Eye className="size-4" /> {title}
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setOpen((current) => !current)}
                        aria-expanded={open}
                        aria-label={open ? t("Hide preview", "প্রিভিউ লুকান") : t("Show preview", "প্রিভিউ দেখান")}
                    >
                        {open ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                </CardHeader>

                {open && (
                    // Positioned for the same reason as the editor's body: an
                    // absolute element inside must scroll here, not stretch the page.
                    <CardContent className={cn(fill && "xl:relative xl:min-h-0 xl:flex-1 xl:overflow-y-auto")}>
                        {children}
                    </CardContent>
                )}
            </Card>
        </aside>
    );
}

/** Shared side-by-side layout: form on the left, preview panel on the right. */
export const previewGrid =
    "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,460px)]";
