import z from "zod";

/**
 * Plain-language wording for every validation issue a schema didn't word
 * itself — "Description is required." instead of Zod's "Invalid input:
 * expected string, received null".
 *
 * Installed once at startup as Zod's global `customError`, which Zod consults
 * only after the schema's own message: `.min(3, "Title must be at least 3
 * characters")` still wins. The message reaches the user as the toast text
 * (see `handleZodError`), so it must make sense on its own, without a field
 * highlighted next to it — hence the field name up front. The technical
 * detail (code, path, expected type) stays on the issue for the logs.
 */

/** "courseId" → "Course", "scheduledAt" → "Scheduled at". The last named key wins. */
const fieldLabel = (path: readonly PropertyKey[] | undefined): string | null => {
    const key = [...(path ?? [])].reverse().find((segment): segment is string => typeof segment === "string");
    if (!key) return null;

    const words = key
        .replace(/Id$/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
};

const EXPECTED: Record<string, string> = {
    string: "must be text",
    number: "must be a number",
    int: "must be a whole number",
    bigint: "must be a whole number",
    boolean: "must be yes or no",
    date: "must be a valid date",
    array: "must be a list",
    object: "is in the wrong format",
};

const FORMAT: Record<string, string> = {
    email: "must be a valid email address",
    url: "must be a valid link",
    datetime: "must be a valid date and time",
    date: "must be a valid date",
    time: "must be a valid time",
};

/** "2,000 characters" — the same grouping as the forms' character counters. */
const plural = (count: number, word: string) => `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;

export const friendlyZodMessage = (issue: z.core.$ZodRawIssue): string => {
    const label = fieldLabel(issue.path);
    if (!label) return "Some of the details you entered aren't valid. Please check them and try again.";

    switch (issue.code) {
        case "invalid_type":
            if (issue.input === undefined || issue.input === null) return `${label} is required.`;
            return `${label} ${EXPECTED[issue.expected] ?? "has an invalid value"}.`;

        case "too_small": {
            const min = Number(issue.minimum);
            switch (issue.origin) {
                case "string":
                    return min <= 1 ? `${label} is required.` : `${label} must be at least ${plural(min, "character")}.`;
                case "number":
                case "int":
                case "bigint":
                    return `${label} must be ${issue.inclusive ? "at least" : "more than"} ${min.toLocaleString("en-US")}.`;
                case "array":
                case "set":
                    return `${label} needs at least ${plural(min, "item")}.`;
                case "date":
                    return `${label} is too early.`;
                default:
                    return `${label} is too small.`;
            }
        }

        case "too_big": {
            const max = Number(issue.maximum);
            switch (issue.origin) {
                case "string":
                    return `${label} can be at most ${plural(max, "character")}.`;
                case "number":
                case "int":
                case "bigint":
                    return `${label} must be ${issue.inclusive ? "at most" : "less than"} ${max.toLocaleString("en-US")}.`;
                case "array":
                case "set":
                    return `${label} can have at most ${plural(max, "item")}.`;
                case "date":
                    return `${label} is too late.`;
                default:
                    return `${label} is too large.`;
            }
        }

        case "invalid_format":
            return `${label} ${FORMAT[issue.format] ?? "isn't in the right format"}.`;

        case "invalid_value":
            return `${label} isn't one of the allowed options.`;

        case "not_multiple_of":
            return `${label} must be a multiple of ${Number(issue.divisor)}.`;

        default:
            return `${label} has an invalid value.`;
    }
};

export const installFriendlyZodMessages = () => z.config({ customError: friendlyZodMessage });
