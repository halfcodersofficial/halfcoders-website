import { Response } from "express";
import status from "http-status";
import AppError from "../errorHelpers/AppError";
import { IQueryParams } from "../interfaces/query.interface";

type Cell = string | number | boolean | Date | null | undefined;

/** More than this and the admin is asked to narrow the list first — an export is one request. */
export const EXPORT_ROW_CAP = 20_000;
const PAGE = 100;

/** Dhaka wall-clock time, as every other date in the console reads: "2026-10-16 14:30". */
const dhaka = (date: Date) => new Date(date.getTime() + 6 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");

/**
 * One cell: quoted when it has to be, and never read as a formula. Names,
 * titles and notes are typed by users, so a leading = + - @ (or tab/return)
 * is defused with an apostrophe (CSV injection) — except a plain phone
 * number like "+8801…", which can't be one.
 */
const cell = (value: Cell) => {
    if (value === null || value === undefined) return "";
    let text = value instanceof Date ? dhaka(value) : String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text) && !/^\+[\d\s-]+$/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** A CSV document, with the byte-order mark Excel needs to read Bangla names as UTF-8. */
export const toCsv = (header: string[], rows: Cell[][]) =>
    `\uFEFF${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}`;

/**
 * Every row a list would show for this query — fetched page by page through
 * the list's own service, so the file has exactly what the filtered, searched,
 * sorted screen has. Too many rows is refused up front rather than cut short.
 */
export const collectAll = async <T>(
    list: (query: IQueryParams) => Promise<{ data: T[]; meta?: { total: number; totalPages: number } }>,
    query: IQueryParams,
): Promise<T[]> => {
    const { page: _page, limit: _limit, ...filters } = query;
    const rows: T[] = [];
    for (let page = 1; ; page += 1) {
        const result = await list({ ...filters, page: String(page), limit: String(PAGE) });
        if (page === 1 && (result.meta?.total ?? 0) > EXPORT_ROW_CAP) {
            throw new AppError(
                status.BAD_REQUEST,
                `That's ${result.meta?.total.toLocaleString("en-US")} rows — narrow the list (a course, a status, a search) to ${EXPORT_ROW_CAP.toLocaleString("en-US")} or fewer and export again.`,
            );
        }
        rows.push(...result.data);
        if (result.data.length < PAGE || !result.meta || page >= result.meta.totalPages) return rows;
    }
};

/** Sends `csv` as a download named `<name>-<Dhaka date>.csv`. */
export const sendCsv = (res: Response, name: string, csv: string) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}-${dhaka(new Date()).slice(0, 10)}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(status.OK).send(csv);
};
