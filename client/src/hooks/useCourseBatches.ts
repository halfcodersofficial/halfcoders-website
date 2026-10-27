"use client";

import { useEffect, useMemo, useState } from "react";
import { BATCH_FIELDS, courseBatches, type BatchSchedule } from "@/lib/courseBatch";

/** `setTimeout` can't wait longer than ~24.8 days; a longer wait re-checks daily instead. */
const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

const keyOf = (schedule: BatchSchedule) =>
    [
        schedule.courseType,
        ...BATCH_FIELDS.map((field) => {
            const value = schedule[field];
            return value instanceof Date ? value.toISOString() : (value ?? "");
        }),
    ].join("|");

/**
 * A bootcamp's batches as of now (`null` off bootcamp), kept current: it
 * re-checks the moment enrolment opens or closes, and when a sleeping tab
 * wakes, so the Enrol button turns on and off by itself — no refresh, and
 * nothing for an admin to toggle.
 *
 * `renderedAt` is when the server rendered the page. The first render uses it
 * so the markup matches the server's and hydration never mismatches; the real
 * clock takes over right after.
 */
export function useCourseBatches(schedule: BatchSchedule, renderedAt?: number) {
    const [now, setNow] = useState(() => renderedAt ?? Date.now());

    // Keyed on the values rather than the object, so a parent that rebuilds
    // the same dates every render doesn't restart the timer.
    const key = keyOf(schedule);
    const stable = useMemo(() => {
        const [courseType, ...values] = key.split("|");
        return {
            courseType,
            ...Object.fromEntries(BATCH_FIELDS.map((field, index) => [field, values[index] || null])),
        } as BatchSchedule;
    }, [key]);

    useEffect(() => {
        let timer: number | undefined;
        const check = () => {
            window.clearTimeout(timer);
            const current = Date.now();
            setNow(current);
            const changesAt = courseBatches(stable.courseType, stable, new Date(current))?.changesAt;
            if (changesAt) {
                // A beat past the boundary, so the re-check lands on the far side of it.
                timer = window.setTimeout(check, Math.min(changesAt.getTime() - current + 250, MAX_WAIT_MS));
            }
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") check();
        };

        check();
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [stable]);

    return courseBatches(schedule.courseType, schedule, new Date(now));
}
