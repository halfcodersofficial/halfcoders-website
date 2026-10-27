/**
 * A line that opens with a count — "4 Exams", "3 Programming Assignments",
 * "1:1 Support Session", "20+ Lessons", Bangla digits too. Up to three
 * digits, so a year ("2026 Batch") is left alone.
 */
const LEADING_COUNT = /^([0-9০-৯]{1,3}(?::[0-9০-৯]{1,3})?\+?)\s+(\S.*)$/;

/**
 * Splits the count off the front of a course-page line, so it can be set
 * apart: how many exams, lessons or sessions is what a buyer compares between
 * courses. `count` is null when the line doesn't start with one.
 */
export const splitLeadingCount = (text: string): { count: string | null; rest: string } => {
    const match = LEADING_COUNT.exec(text.trim());
    return match ? { count: match[1], rest: match[2] } : { count: null, rest: text };
};
