/**
 * Bootcamp batches, by the API's rules (server `utils/courseBatch.ts`). Each
 * batch has an enrolment window and the dates it runs, and enrolment is open
 * only inside a window: the present batch's, or the next batch's, which may
 * open while the present one is still running. An unset bound keeps the
 * original rule — a batch takes enrolments until it starts, and the next one
 * from when the present one ends. When the present batch ends, the next
 * becomes the present one. A traditional course has no batches.
 *
 * `hooks/useCourseBatches` keeps this current on a page, so the Enrol button
 * opens and closes on its own at the right moment.
 */

type Instant = string | Date | null;

export interface BatchDates {
    enrollmentStartsAt: Instant;
    enrollmentEndsAt: Instant;
    startsAt: Instant;
    endsAt: Instant;
    nextEnrollmentStartsAt: Instant;
    nextEnrollmentEndsAt: Instant;
    nextStartsAt: Instant;
    nextEndsAt: Instant;
}

export const BATCH_FIELDS = [
    "enrollmentStartsAt",
    "enrollmentEndsAt",
    "startsAt",
    "endsAt",
    "nextEnrollmentStartsAt",
    "nextEnrollmentEndsAt",
    "nextStartsAt",
    "nextEndsAt",
] as const satisfies readonly (keyof BatchDates)[];

/** What the enrol controls need from a course: its type and its batch dates. */
export interface BatchSchedule extends BatchDates {
    courseType: string;
}

/** Just the schedule, so a server page hands its client components a few dates rather than the whole course. */
export const scheduleOf = (course: BatchSchedule): BatchSchedule => ({
    courseType: course.courseType,
    enrollmentStartsAt: course.enrollmentStartsAt,
    enrollmentEndsAt: course.enrollmentEndsAt,
    startsAt: course.startsAt,
    endsAt: course.endsAt,
    nextEnrollmentStartsAt: course.nextEnrollmentStartsAt,
    nextEnrollmentEndsAt: course.nextEnrollmentEndsAt,
    nextStartsAt: course.nextStartsAt,
    nextEndsAt: course.nextEndsAt,
});

export interface EnrollmentWindow {
    opensAt: Date | null;
    closesAt: Date | null;
}

export interface Batch {
    startsAt: Date | null;
    endsAt: Date | null;
    /** Whether the admin set either end of the window, rather than leaving it to the rule. */
    hasOwnWindow: boolean;
    /** When it takes enrolments, unset ends filled in by the rule. */
    enrollment: EnrollmentWindow;
}

export interface CourseBatches {
    present: Batch;
    next: Batch | null;
    enrollmentOpen: boolean;
    /** While open, the batch an enrolment made now joins. */
    enrollingInto: "present" | "next" | null;
    /** While open: when enrolment closes, if it does. */
    closesAt: Date | null;
    /** While closed: when it opens again, if a window says so. */
    opensAt: Date | null;
    /** The next moment any of the above changes. */
    changesAt: Date | null;
}

/** An ISO instant, or the editor's local "YYYY-MM-DDTHH:mm"; "" and junk are no date. */
const toDate = (value: Instant) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const isInside = ({ opensAt, closesAt }: EnrollmentWindow, now: Date) =>
    (!opensAt || opensAt <= now) && (!closesAt || now < closesAt);

/** The earliest of `dates` after `now`. */
const firstAfter = (now: Date, dates: (Date | null | undefined)[]) =>
    dates
        .filter((date): date is Date => Boolean(date) && date! > now)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

/** The batches as of `now`, a finished present batch already replaced by the next. `null` off bootcamp. */
export function courseBatches(courseType: string, dates: BatchDates, now = new Date()): CourseBatches | null {
    if (courseType !== "BOOTCAMP") return null;

    type Raw = { enrollmentStartsAt: Date | null; enrollmentEndsAt: Date | null; startsAt: Date | null; endsAt: Date | null };
    let present: Raw = {
        enrollmentStartsAt: toDate(dates.enrollmentStartsAt),
        enrollmentEndsAt: toDate(dates.enrollmentEndsAt),
        startsAt: toDate(dates.startsAt),
        endsAt: toDate(dates.endsAt),
    };
    const nextStartsAt = toDate(dates.nextStartsAt);
    let next: Raw | null = nextStartsAt
        ? {
            enrollmentStartsAt: toDate(dates.nextEnrollmentStartsAt),
            enrollmentEndsAt: toDate(dates.nextEnrollmentEndsAt),
            startsAt: nextStartsAt,
            endsAt: toDate(dates.nextEndsAt),
        }
        : null;
    const handOverAt = next ? present.endsAt : null;
    if (next && present.endsAt && present.endsAt <= now) {
        present = next;
        next = null;
    }

    const presentWindow = { opensAt: present.enrollmentStartsAt, closesAt: present.enrollmentEndsAt ?? present.startsAt };
    const nextWindow = next
        ? { opensAt: next.enrollmentStartsAt ?? present.endsAt, closesAt: next.enrollmentEndsAt ?? next.startsAt }
        : null;
    const asBatch = (raw: Raw, enrollment: EnrollmentWindow): Batch => ({
        startsAt: raw.startsAt,
        endsAt: raw.endsAt,
        hasOwnWindow: Boolean(raw.enrollmentStartsAt || raw.enrollmentEndsAt),
        enrollment,
    });

    const enrollingInto = isInside(presentWindow, now)
        ? "present"
        : nextWindow && isInside(nextWindow, now)
            ? "next"
            : null;
    const enrollmentOpen = enrollingInto !== null;

    return {
        present: asBatch(present, presentWindow),
        next: next && nextWindow ? asBatch(next, nextWindow) : null,
        enrollmentOpen,
        enrollingInto,
        closesAt: enrollingInto === "present" ? presentWindow.closesAt : enrollingInto === "next" ? nextWindow!.closesAt : null,
        opensAt: enrollmentOpen ? null : firstAfter(now, [presentWindow.opensAt, nextWindow?.opensAt]),
        changesAt: firstAfter(now, [
            presentWindow.opensAt,
            presentWindow.closesAt,
            nextWindow?.opensAt,
            nextWindow?.closesAt,
            present.startsAt,
            handOverAt,
        ]),
    };
}

/** Whether there's a batch worth showing: a present one with dates or a window of its own, or a next one. */
export const hasBatchDates = (batches: CourseBatches | null): batches is CourseBatches =>
    Boolean(batches && (batches.present.startsAt || batches.present.hasOwnWindow || batches.next));

/**
 * Batch times as the platform states them: Bangladesh time, whatever the
 * reader's or the server's clock says — so a server-rendered page and the
 * browser that hydrates it print the same thing, and a UTC server doesn't
 * put a midnight start on the day before.
 */
const BD_DATE: Intl.DateTimeFormatOptions = { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" };

export const formatBatchDate = (date: Date) => date.toLocaleDateString("en-GB", BD_DATE);

export const formatBatchDateTime = (date: Date) =>
    date.toLocaleString("en-GB", { ...BD_DATE, hour: "numeric", minute: "2-digit", hour12: true });

/**
 * The same checks the API makes on save, one message per field. Each window
 * and batch ends after it starts, and a batch stops taking enrolments by the
 * time it ends. A next batch needs the present one to end — that is when it
 * takes over — and starts after it; its enrolment opens once the present
 * batch's has closed, so a student is never enrolling in two batches at once.
 */
export function batchDateIssues(dates: BatchDates): { field: keyof BatchDates; message: string }[] {
    const enrollmentStartsAt = toDate(dates.enrollmentStartsAt);
    const enrollmentEndsAt = toDate(dates.enrollmentEndsAt);
    const startsAt = toDate(dates.startsAt);
    const endsAt = toDate(dates.endsAt);
    const nextEnrollmentStartsAt = toDate(dates.nextEnrollmentStartsAt);
    const nextEnrollmentEndsAt = toDate(dates.nextEnrollmentEndsAt);
    const nextStartsAt = toDate(dates.nextStartsAt);
    const nextEndsAt = toDate(dates.nextEndsAt);
    const issues: { field: keyof BatchDates; message: string }[] = [];
    const fail = (field: keyof BatchDates, message: string) => issues.push({ field, message });

    // The present batch.
    if (endsAt && !startsAt) fail("endsAt", "Set when the batch starts first");
    if (startsAt && endsAt && endsAt <= startsAt) fail("endsAt", "The batch must end after it starts");
    if (enrollmentStartsAt && enrollmentEndsAt && enrollmentEndsAt <= enrollmentStartsAt) {
        fail("enrollmentEndsAt", "Enrolment must close after it opens");
    }
    if (enrollmentStartsAt && !enrollmentEndsAt && startsAt && startsAt <= enrollmentStartsAt) {
        fail("enrollmentStartsAt", "Enrolment must open before the batch starts, or set when it closes");
    }
    if (enrollmentEndsAt && endsAt && enrollmentEndsAt > endsAt) {
        fail("enrollmentEndsAt", "Enrolment must close by the time the batch ends");
    }

    // The next batch.
    const firstNextField = (["nextEnrollmentStartsAt", "nextEnrollmentEndsAt", "nextStartsAt", "nextEndsAt"] as const)
        .find((field) => toDate(dates[field]));
    if (firstNextField && !endsAt) {
        fail(firstNextField, "Set when the present batch ends first — that is when the next batch takes over");
    }
    if ((nextEnrollmentStartsAt || nextEnrollmentEndsAt || nextEndsAt) && !nextStartsAt) {
        fail("nextStartsAt", "Set when the next batch starts");
    }
    if (nextStartsAt && endsAt && nextStartsAt <= endsAt) {
        fail("nextStartsAt", "The next batch must start after the present batch ends");
    }
    if (nextStartsAt && nextEndsAt && nextEndsAt <= nextStartsAt) fail("nextEndsAt", "The batch must end after it starts");
    if (nextEnrollmentStartsAt && nextEnrollmentEndsAt && nextEnrollmentEndsAt <= nextEnrollmentStartsAt) {
        fail("nextEnrollmentEndsAt", "Enrolment must close after it opens");
    }
    if (nextEnrollmentStartsAt && !nextEnrollmentEndsAt && nextStartsAt && nextStartsAt <= nextEnrollmentStartsAt) {
        fail("nextEnrollmentStartsAt", "Enrolment must open before the batch starts, or set when it closes");
    }
    if (nextEnrollmentEndsAt && !nextEnrollmentStartsAt && endsAt && nextEnrollmentEndsAt <= endsAt) {
        fail("nextEnrollmentEndsAt", "With no opening time, enrolment opens when the present batch ends — close it after that");
    }
    if (nextEnrollmentEndsAt && nextEndsAt && nextEnrollmentEndsAt > nextEndsAt) {
        fail("nextEnrollmentEndsAt", "Enrolment must close by the time the batch ends");
    }
    const presentCloses = enrollmentEndsAt ?? startsAt;
    if (nextEnrollmentStartsAt && presentCloses && nextEnrollmentStartsAt < presentCloses) {
        fail("nextEnrollmentStartsAt", "The next batch's enrolment must open after the present batch's closes");
    }
    return issues;
}
