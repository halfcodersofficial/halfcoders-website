import { localDateTimeToISO, toLocalDateTimeValue } from "@/components/ui/date-time";
import { BATCH_FIELDS, type BatchDates } from "@/lib/courseBatch";

/**
 * The batch dates between the API's ISO instants and the editor's pickers
 * ("YYYY-MM-DDTHH:mm" in the admin's own time, "" for none). Client only —
 * the picker helpers live in a client module.
 */
export type BatchFormValues = Record<(typeof BATCH_FIELDS)[number], string>;

export const EMPTY_BATCH_VALUES = Object.fromEntries(BATCH_FIELDS.map((field) => [field, ""])) as BatchFormValues;

export const batchFormValues = (course: BatchDates): BatchFormValues =>
    Object.fromEntries(
        BATCH_FIELDS.map((field) => {
            const value = course[field];
            return [field, value ? toLocalDateTimeValue(new Date(value)) : ""];
        }),
    ) as BatchFormValues;

/** `null` clears a date on save; `undefined` would leave the stored one. */
export const batchPayload = (values: BatchFormValues) =>
    Object.fromEntries(
        BATCH_FIELDS.map((field) => [field, values[field] ? localDateTimeToISO(values[field]) : null]),
    ) as Record<(typeof BATCH_FIELDS)[number], string | null>;
