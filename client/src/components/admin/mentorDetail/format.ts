/** "45 min", "5.5 h" or "3.2 days" — however a review turnaround reads best. */
export const formatHours = (hours: number) =>
    hours < 1 ? `${Math.round(hours * 60)} min` : hours < 48 ? `${hours} h` : `${Math.round((hours / 24) * 10) / 10} days`;

/** Whole hours between two instants, to one decimal — never negative. */
export const hoursBetween = (from: string, to: string) =>
    Math.max(0, Math.round(((new Date(to).getTime() - new Date(from).getTime()) / 3_600_000) * 10) / 10);
