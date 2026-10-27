"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { downloadFrom } from "@/lib/download";
import { getApiErrorMessage } from "@/lib/httpClient";

/**
 * Downloads a list as a CSV — the API builds it from the same filters,
 * search and order the list is showing, so the file matches the screen.
 */
export default function ExportCsvButton({
    path,
    params,
    label = "Export CSV",
    variant = "brand-outline",
    disabled = false,
}: {
    path: string;
    params?: Record<string, unknown>;
    label?: string;
    variant?: ButtonProps["variant"];
    disabled?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        try {
            await downloadFrom(path, params);
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Couldn't export that list. Try again."));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Button type="button" variant={variant} onClick={() => void run()} isLoading={busy} disabled={disabled}>
            {!busy && <Download />} {label}
        </Button>
    );
}
