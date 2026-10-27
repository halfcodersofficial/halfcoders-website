import axios from "axios";
import httpClient from "@/lib/httpClient";

/** Hands the browser a file to save, under `fileName`. */
export const saveFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};

type Cell = string | number | null | undefined;

/**
 * One CSV cell: quoted when it has to be, and never read as a formula — a
 * name typed as "=HYPERLINK(…)" is defused with an apostrophe (CSV
 * injection). A plain phone number like "+8801…" is left alone.
 */
const cell = (value: Cell) => {
    if (value === null || value === undefined) return "";
    let text = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text) && !/^\+[\d\s-]+$/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Rows to a CSV file, with the byte-order mark Excel needs to read Bangla as UTF-8. */
export const saveCsv = (fileName: string, rows: Cell[][]) =>
    saveFile(new Blob([`\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }), fileName);

/**
 * Downloads a file the API serves as an attachment and saves it under the
 * name the API gives. A refusal arrives as a Blob too — it's read back so the
 * API's own message ("narrow the list…") is what the caller shows.
 */
export const downloadFrom = async (path: string, params?: Record<string, unknown>, fallbackName = "export.csv") => {
    try {
        const response = await httpClient.get(path, { params, responseType: "blob" });
        const disposition = response.headers["content-disposition"] as string | undefined;
        saveFile(response.data as Blob, disposition?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
            let message: string | undefined;
            try {
                message = (JSON.parse(await error.response.data.text()) as { message?: string }).message;
            } catch {
                message = undefined;
            }
            if (message) throw new Error(message);
        }
        throw error;
    }
};
