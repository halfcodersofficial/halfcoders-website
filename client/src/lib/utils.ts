import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/**
 * Prices are whole Taka integers throughout — the API never sends fractional
 * currency, so there's nothing to round here.
 */
export const formatBDT = (amount: number): string =>
    `৳${amount.toLocaleString("en-BD")}`;

/** Seconds → "18:42", or "1:04:07" once past the hour. */
export const formatDuration = (totalSeconds: number): string => {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/** Rough reading of a total course length, for course cards. */
export const formatTotalHours = (totalSeconds: number): string => {
    const hours = totalSeconds / 3600;
    if (hours < 1) return `${Math.round(totalSeconds / 60)} min`;
    return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours`;
};

/** A milestone's length as "13h 32m" — always both units, for the curriculum sidebar. */
export const formatHoursMinutes = (totalSeconds: number): string => {
    const totalMinutes = Math.round(totalSeconds / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
};

export const formatDate = (value: string | Date): string =>
    new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

export const formatDateTime = (value: string | Date): string =>
    new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

export const formatTime = (value: string | Date): string =>
    new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "Jul 26" — the course outline table's Date column. */
export const formatOutlineDate = (value: string | Date): string =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** "8:00pm, Saturday" — the course outline table's Publish Date column. */
export const formatOutlineTime = (value: string | Date): string => {
    const date = new Date(value);
    const time = date
        .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
        .replace(" ", "")
        .toLowerCase();
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    return `${time}, ${weekday}`;
};

/** "#04" — the padded serial the support queue displays. */
export const formatQueueNumber = (n: number): string => `#${String(n).padStart(2, "0")}`;

/**
 * Level enum → the wording students see. Shared by the public course page and
 * the admin's student preview: if these two drift, the preview quietly stops
 * telling the truth, which is the one thing a preview must not do.
 */
export const LEVEL_LABEL: Record<string, string> = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
    ALL_LEVELS: "All levels",
};

/** The price a student actually pays. */
export const effectivePrice = (price: number, discountPrice: number | null): number =>
    discountPrice ?? price;

export const discountPercent = (price: number, discountPrice: number | null): number | null => {
    if (discountPrice === null || price <= 0 || discountPrice >= price) return null;
    return Math.round(((price - discountPrice) / price) * 100);
};

export const initials = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
