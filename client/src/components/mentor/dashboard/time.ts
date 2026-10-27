/**
 * Clock and calendar helpers for the mentor dashboard. Everything is read in
 * Dhaka time, the same days the API buckets by — Dhaka is UTC+6 all year, with
 * no daylight saving, so a fixed offset is exact.
 */

export const DAY_MS = 86_400_000;
const DHAKA_OFFSET_MS = 6 * 3_600_000;
const DHAKA = "Asia/Dhaka";

/** "YYYY-MM-DD" — the Dhaka day an instant falls on. */
export const dhakaDayKey = (value: string | number | Date) =>
    new Date(new Date(value).getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);

/** Minutes since Dhaka midnight, 0–1439. */
export const minuteOfDhakaDay = (value: string | number | Date) =>
    Math.floor(((new Date(value).getTime() + DHAKA_OFFSET_MS) % DAY_MS) / 60_000);

/** "9:00 PM" */
export const clock = (value: string | number | Date) =>
    new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DHAKA });

/** A Dhaka day's name: "Wed", or "Wednesday" with `long`. */
export const weekdayOf = (key: string, long = false) =>
    new Date(`${key}T12:00:00+06:00`).toLocaleDateString("en-GB", { weekday: long ? "long" : "short", timeZone: DHAKA });

/** "15 October" */
export const dayMonthOf = (key: string) =>
    new Date(`${key}T12:00:00+06:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: DHAKA });

export const plural = (count: number, word: string, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

export const pad2 = (value: number) => String(value).padStart(2, "0");

/** How long since `since`, at the grain that matters: "40 min", "18 hours", "3 days". */
export const elapsed = (since: string | number | Date, now: number) => {
    const ms = Math.max(0, now - new Date(since).getTime());
    const days = Math.floor(ms / DAY_MS);
    if (days >= 1) return { text: plural(days, "day"), days };
    const hours = Math.floor(ms / 3_600_000);
    if (hours >= 1) return { text: plural(hours, "hour"), days: 0 };
    return { text: `${Math.max(1, Math.floor(ms / 60_000))} min`, days: 0 };
};

/** A median turnaround in hours, as a person would say it: "45 min", "6 h", "2.5 days". */
export const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)} h`;
    const days = hours / 24;
    return `${days < 10 ? Math.round(days * 10) / 10 : Math.round(days)} days`;
};
