import status from "http-status";
import { CourseStatus, CourseType } from "../../generated/prisma/enums";
import AppError from "../errorHelpers/AppError";

/**
 * Bootcamp batches — pure rules, no database. Each batch has an enrolment
 * window and the dates it runs. Enrolment is open only inside a window: the
 * present batch's, or the next batch's, which may open while the present one
 * is still running. An unset bound keeps the original rule — a batch takes
 * enrolments until it starts, and the next batch from when the present one
 * ends. When the present batch ends, the next becomes the present one.
 *
 * The scheduler writes the hand-over down (`CourseService.rollOverBatches`),
 * but these rules apply it on read as well, so the gap between ticks never
 * shows a finished batch. A traditional course has no batches: always open.
 * The client mirrors this in `lib/courseBatch.ts`.
 */

export type BatchDates = {
    enrollmentStartsAt: Date | null;
    enrollmentEndsAt: Date | null;
    startsAt: Date | null;
    endsAt: Date | null;
    nextEnrollmentStartsAt: Date | null;
    nextEnrollmentEndsAt: Date | null;
    nextStartsAt: Date | null;
    nextEndsAt: Date | null;
};

export type CourseBatches = BatchDates & { courseType: CourseType; status: CourseStatus };

export const BATCH_FIELDS = [
    "enrollmentStartsAt",
    "enrollmentEndsAt",
    "startsAt",
    "endsAt",
    "nextEnrollmentStartsAt",
    "nextEnrollmentEndsAt",
    "nextStartsAt",
    "nextEndsAt",
] as const;

/** The columns `assertEnrollmentOpen` reads, for a Prisma `select`. */
export const ENROLLMENT_RULE_SELECT = {
    courseType: true,
    status: true,
    enrollmentStartsAt: true,
    enrollmentEndsAt: true,
    startsAt: true,
    endsAt: true,
    nextEnrollmentStartsAt: true,
    nextEnrollmentEndsAt: true,
    nextStartsAt: true,
    nextEndsAt: true,
} as const;

type Batch = {
    enrollmentStartsAt: Date | null;
    enrollmentEndsAt: Date | null;
    startsAt: Date | null;
    endsAt: Date | null;
};

type Window = { opensAt: Date | null; closesAt: Date | null };

/** The present and next batch as of `now` — a finished present batch already replaced by the next. */
export const batchesAsOf = (dates: BatchDates, now = new Date()) => {
    const present: Batch = {
        enrollmentStartsAt: dates.enrollmentStartsAt,
        enrollmentEndsAt: dates.enrollmentEndsAt,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt,
    };
    const next: Batch | null = dates.nextStartsAt
        ? {
            enrollmentStartsAt: dates.nextEnrollmentStartsAt,
            enrollmentEndsAt: dates.nextEnrollmentEndsAt,
            startsAt: dates.nextStartsAt,
            endsAt: dates.nextEndsAt,
        }
        : null;
    if (next && present.endsAt && present.endsAt <= now) return { present: next, next: null };
    return { present, next };
};

/** When each batch takes enrolments, with unset bounds filled in by the original rule. */
const enrollmentWindows = ({ present, next }: { present: Batch; next: Batch | null }): Window[] => [
    { opensAt: present.enrollmentStartsAt, closesAt: present.enrollmentEndsAt ?? present.startsAt },
    ...(next
        ? [{ opensAt: next.enrollmentStartsAt ?? present.endsAt, closesAt: next.enrollmentEndsAt ?? next.startsAt }]
        : []),
];

const isInside = ({ opensAt, closesAt }: Window, now: Date) =>
    (!opensAt || opensAt <= now) && (!closesAt || now < closesAt);

export const isEnrollmentOpen = (course: CourseBatches, now = new Date()) => {
    if (course.courseType !== CourseType.BOOTCAMP) return true;
    // Unpublishing takes a bootcamp off sale, whatever its dates say.
    if (course.status !== CourseStatus.PUBLISHED) return false;
    return enrollmentWindows(batchesAsOf(course, now)).some((window) => isInside(window, now));
};

const bangladeshTime = (date: Date) =>
    date.toLocaleString("en-GB", {
        timeZone: "Asia/Dhaka",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

export const assertEnrollmentOpen = (course: CourseBatches, now = new Date()) => {
    if (isEnrollmentOpen(course, now)) return;
    if (course.status !== CourseStatus.PUBLISHED) {
        throw new AppError(status.CONFLICT, "This course is no longer taking enrolments.");
    }
    const opensAt = enrollmentWindows(batchesAsOf(course, now))
        .map((window) => window.opensAt)
        .filter((date): date is Date => date !== null && date > now)
        .sort((a, b) => a.getTime() - b.getTime())[0];
    throw new AppError(
        status.CONFLICT,
        opensAt
            ? `Enrolment isn't open right now. It opens on ${bangladeshTime(opensAt)} (Bangladesh time).`
            : "Enrolment for this batch has closed. The next batch hasn't been announced yet.",
    );
};

/**
 * Checks the dates a course is about to be saved with, one message per field
 * (the client runs the same list in `lib/courseBatch.ts`). Each window and
 * batch ends after it starts, and a batch stops taking enrolments by the time
 * it ends. A next batch needs the present one to end — that is when it takes
 * over — and starts after it; its enrolment opens once the present batch's
 * has closed, so a student is never enrolling in two batches at once.
 */
export const batchDateIssues = (dates: BatchDates): { field: keyof BatchDates; message: string }[] => {
    const {
        enrollmentStartsAt, enrollmentEndsAt, startsAt, endsAt,
        nextEnrollmentStartsAt, nextEnrollmentEndsAt, nextStartsAt, nextEndsAt,
    } = dates;
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
        .find((field) => dates[field]);
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
};

const FIELD_LABELS: Record<keyof BatchDates, string> = {
    enrollmentStartsAt: "Present batch, enrolment opens",
    enrollmentEndsAt: "Present batch, enrolment closes",
    startsAt: "Present batch, starts",
    endsAt: "Present batch, ends",
    nextEnrollmentStartsAt: "Next batch, enrolment opens",
    nextEnrollmentEndsAt: "Next batch, enrolment closes",
    nextStartsAt: "Next batch, starts",
    nextEndsAt: "Next batch, ends",
};

export const assertBatchDates = (dates: BatchDates) => {
    const [issue] = batchDateIssues(dates);
    if (issue) throw new AppError(status.BAD_REQUEST, `${FIELD_LABELS[issue.field]}: ${issue.message}.`);
};
