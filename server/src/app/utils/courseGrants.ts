import { Prisma } from "../../generated/prisma/client";
import {
    CoursePricing,
    CourseStatus,
    EnrollmentStatus,
    GrantSource,
    NotificationType,
    RewardCondition,
} from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { activateEnrollment } from "../module/enrollment/enrollment.service";
import { createNotification } from "../module/notification/notification.service";
import { logger } from "./logger";

type Tx = Prisma.TransactionClient;

/**
 * Courses given rather than bought: the free courses a purchase earns through
 * an offer, the courses a reward gives for finishing in time, and the reward
 * courses an admin attaches to a main course (a `BonusCourse`). Each grant
 * is one `CourseGrant` row under a unique key (offer, reward or bonus,
 * student, course), so a repeated payment callback or a second completion can
 * never give a course twice. A student who already has the course is left alone.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** An offer, reward or bundle is live when it's switched on and inside its window, if it has one. */
export const isLive = (promo: { isActive: boolean; startsAt?: Date | null; endsAt?: Date | null }, at = new Date()) =>
    promo.isActive && (!promo.startsAt || promo.startsAt <= at) && (!promo.endsAt || promo.endsAt > at);

/**
 * When a student must finish by to earn a reward: its date, or so many days
 * after they enrolled, whichever comes first. Null when it has neither.
 */
export const rewardDeadline = (
    reward: { deadlineAt: Date | null; withinDays: number | null },
    enrolledAt?: Date | null,
): Date | null => {
    const byDays = reward.withinDays && enrolledAt ? new Date(enrolledAt.getTime() + reward.withinDays * DAY_MS) : null;
    if (reward.deadlineAt && byDays) return reward.deadlineAt < byDays ? reward.deadlineAt : byDays;
    return reward.deadlineAt ?? byDays;
};

export const HAS_ACCESS: EnrollmentStatus[] = [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED];

export type GivenCourse = { id: string; title: string; slug: string };

const grantableCourse = { id: true, title: true, slug: true, status: true, isDeleted: true } as const;

/**
 * Opens one course for one student for one reason. Returns false when there's
 * nothing to do: it was given before (and not taken back), or they already
 * have the course some other way.
 */
const giveCourse = async (
    tx: Tx,
    input: {
        studentId: string;
        course: { id: string; status: CourseStatus; isDeleted: boolean };
        source: GrantSource;
        offerId?: string;
        rewardId?: string;
        bonusId?: string;
        orderId?: string;
    },
) => {
    if (input.course.isDeleted || input.course.status !== CourseStatus.PUBLISHED) return false;

    const ids = { studentId: input.studentId, courseId: input.course.id };
    const key = input.offerId
        ? { offerId_studentId_courseId: { offerId: input.offerId, ...ids } }
        : input.bonusId
          ? { bonusId_studentId_courseId: { bonusId: input.bonusId, ...ids } }
          : { rewardId_studentId_courseId: { rewardId: input.rewardId!, ...ids } };

    const earlier = await tx.courseGrant.findUnique({ where: key, select: { revokedAt: true } });
    if (earlier && !earlier.revokedAt) return false;

    const enrollment = await tx.enrollment.findUnique({ where: { studentId_courseId: ids }, select: { status: true } });
    if (enrollment && HAS_ACCESS.includes(enrollment.status)) return false;

    const opened = await activateEnrollment(tx, ids);
    await tx.courseGrant.upsert({
        where: key,
        create: {
            ...ids,
            source: input.source,
            offerId: input.offerId,
            rewardId: input.rewardId,
            bonusId: input.bonusId,
            orderId: input.orderId,
            enrollmentId: opened.id,
        },
        // Earned again after a refund took it back.
        update: { revokedAt: null, orderId: input.orderId, enrollmentId: opened.id },
    });
    return true;
};

/**
 * The free courses a paid order earns, given inside the transaction that
 * settles it. Only an order for the offer's own course counts — not a
 * bundle's share — and only while the offer is live at the time of payment.
 */
export const grantOfferCourses = async (
    tx: Tx,
    order: { id: string; studentId: string; courseId: string; bundleOrderId: string | null },
    paidAt = new Date(),
): Promise<GivenCourse[]> => {
    if (order.bundleOrderId) return [];
    const offer = await tx.courseOffer.findUnique({
        where: { courseId: order.courseId },
        include: {
            course: { select: { pricing: true } },
            freeCourses: { orderBy: { order: "asc" }, include: { course: { select: grantableCourse } } },
        },
    });
    // Only while the course is paid: one made free since gives nothing away.
    if (!offer || !isLive(offer, paidAt) || offer.course.pricing !== CoursePricing.PAID) return [];

    const given: GivenCourse[] = [];
    for (const { course } of offer.freeCourses) {
        const opened = await giveCourse(tx, {
            studentId: order.studentId,
            course,
            source: GrantSource.OFFER,
            offerId: offer.id,
            orderId: order.id,
        });
        if (opened) given.push({ id: course.id, title: course.title, slug: course.slug });
    }
    if (given.length) logger.create("Offer courses granted", { orderId: order.id, courses: given.map((c) => c.id) });
    return given;
};

/**
 * A refund takes back the free courses that order earned: their enrolments
 * are cancelled (progress is kept) and the grants marked revoked, so paying
 * again later earns them again.
 */
export const revokeOfferGrants = async (tx: Tx, orderId: string, at = new Date()) => {
    const grants = await tx.courseGrant.findMany({
        where: { orderId, source: GrantSource.OFFER, revokedAt: null },
        select: { id: true, enrollmentId: true },
    });
    for (const grant of grants) {
        if (grant.enrollmentId) {
            await tx.enrollment.updateMany({
                where: { id: grant.enrollmentId, status: { in: HAS_ACCESS } },
                data: { status: EnrollmentStatus.CANCELLED },
            });
        }
        await tx.courseGrant.update({ where: { id: grant.id }, data: { revokedAt: at } });
    }
    return grants.length;
};

/** Tells the student what they were given and why — "free course" or, for one that comes with a main course, "reward course". */
export const announceGrants = async (studentId: string, given: GivenCourse[], why: string, noun = "free course") => {
    if (given.length === 0) return;
    const names = given.map((course) => `"${course.title}"`).join(", ");
    await createNotification({
        userId: studentId,
        title: given.length === 1 ? `A ${noun} is yours 🎁` : `${given.length} ${noun}s are yours 🎁`,
        message: `${why} You now have ${names}. Start any time.`,
        type: NotificationType.COURSE,
        link: given.length === 1 ? `/learn/${given[0].slug}` : "/dashboard",
    });
};

/**
 * Gives a course's completion reward when a student meets it: called when
 * the enrolment reaches 100% (`COURSE_COMPLETE`) and when its certificate is
 * issued (`CERTIFICATE`), with the moment that happened. Never throws — a
 * reward that can't be given must not undo the progress or the certificate.
 */
export const grantCompletionReward = async (enrollmentId: string, met: RewardCondition, at = new Date()) => {
    try {
        const enrollment = await prisma.enrollment.findUnique({
            where: { id: enrollmentId },
            select: { studentId: true, courseId: true, startedAt: true, status: true, course: { select: { title: true } } },
        });
        if (!enrollment || !HAS_ACCESS.includes(enrollment.status)) return;

        const reward = await prisma.completionReward.findUnique({
            where: { courseId: enrollment.courseId },
            include: { rewardCourses: { orderBy: { order: "asc" }, include: { course: { select: grantableCourse } } } },
        });
        if (!reward || !reward.isActive || reward.condition !== met) return;
        const deadline = rewardDeadline(reward, enrollment.startedAt);
        if (deadline && at > deadline) return;

        const given = await prisma.$transaction(async (tx) => {
            const opened: GivenCourse[] = [];
            for (const { course } of reward.rewardCourses) {
                const done = await giveCourse(tx, {
                    studentId: enrollment.studentId,
                    course,
                    source: GrantSource.REWARD,
                    rewardId: reward.id,
                });
                if (done) opened.push({ id: course.id, title: course.title, slug: course.slug });
            }
            return opened;
        });

        if (given.length) {
            logger.create("Completion reward granted", { enrollmentId, rewardId: reward.id, courses: given.map((c) => c.id) });
            await announceGrants(enrollment.studentId, given, `You finished "${enrollment.course.title}" in time.`);
        }
    } catch (error) {
        logger.error("Couldn't grant a completion reward", { enrollmentId, error });
    }
};

// ---------------------------------------------------------------------------
// Reward courses — given alongside a main course (`BonusCourse`)
// ---------------------------------------------------------------------------

type Bonus = { id: string; course: { id: string; title: string; slug: string; status: CourseStatus; isDeleted: boolean } };

export const bonusSelect = { id: true, course: { select: grantableCourse } } as const;

/** Opens one reward course for one student — the step under every way one is given. Whether it opened anything, as `giveCourse`. */
export const giveBonusCourse = (tx: Tx, studentId: string, bonus: Bonus) =>
    giveCourse(tx, { studentId, course: bonus.course, source: GrantSource.BONUS, bonusId: bonus.id });

/**
 * The reward courses that come with a main course a student has just got —
 * bought, enrolled in by an admin, or opened again: every one set for
 * everyone, and any given to them before that went when the main course did.
 * Inside the transaction that opened the main course; the caller announces
 * what it returns (`announceGrants`, as "reward course").
 */
export const grantBonusCourses = async (tx: Tx, studentId: string, mainCourseId: string): Promise<GivenCourse[]> => {
    const bonuses = await tx.bonusCourse.findMany({
        where: { mainCourseId, OR: [{ forEveryone: true }, { grants: { some: { studentId } } }] },
        orderBy: { createdAt: "asc" },
        select: bonusSelect,
    });

    const given: GivenCourse[] = [];
    for (const bonus of bonuses) {
        if (await giveBonusCourse(tx, studentId, bonus)) given.push({ id: bonus.course.id, title: bonus.course.title, slug: bonus.course.slug });
    }
    if (given.length) logger.create("Reward courses granted", { studentId, mainCourseId, courses: given.map((course) => course.id) });
    return given;
};

/**
 * Closes a reward course a student is losing with one main course — unless
 * another main course they still have brings it too, in which case it stays
 * open and its grant moves over to that one. The caller has already marked
 * or removed the grant it's losing.
 */
export const releaseBonusCourse = async (
    tx: Tx,
    grant: { studentId: string; courseId: string; enrollmentId: string | null; mainCourseId: string },
) => {
    const { studentId, courseId, enrollmentId } = grant;
    const elsewhere = await tx.bonusCourse.findFirst({
        where: {
            courseId,
            mainCourseId: { not: grant.mainCourseId },
            mainCourse: { enrollments: { some: { studentId, status: { in: HAS_ACCESS } } } },
            OR: [{ forEveryone: true }, { grants: { some: { studentId } } }],
        },
        select: { id: true },
    });
    if (elsewhere) {
        await tx.courseGrant.upsert({
            where: { bonusId_studentId_courseId: { bonusId: elsewhere.id, studentId, courseId } },
            create: { studentId, courseId, source: GrantSource.BONUS, bonusId: elsewhere.id, enrollmentId },
            update: { revokedAt: null, enrollmentId },
        });
        return;
    }
    if (enrollmentId) {
        await tx.enrollment.updateMany({
            where: { id: enrollmentId, status: { in: HAS_ACCESS } },
            data: { status: EnrollmentStatus.CANCELLED },
        });
    }
};

/**
 * Takes back the reward courses a student had with a main course they've
 * just lost (a refund, a cancelled enrolment): each enrolment is cancelled —
 * progress kept — and its grant marked, so getting the main course again
 * gives it back (see `releaseBonusCourse` for one another course still brings).
 */
export const revokeBonusCourses = async (tx: Tx, studentId: string, mainCourseId: string, at = new Date()) => {
    const grants = await tx.courseGrant.findMany({
        where: { studentId, source: GrantSource.BONUS, revokedAt: null, bonus: { mainCourseId } },
        select: { id: true, courseId: true, enrollmentId: true },
    });

    for (const grant of grants) {
        await tx.courseGrant.update({ where: { id: grant.id }, data: { revokedAt: at } });
        await releaseBonusCourse(tx, { studentId, courseId: grant.courseId, enrollmentId: grant.enrollmentId, mainCourseId });
    }
    if (grants.length) logger.update("Reward courses taken back", { studentId, mainCourseId, grants: grants.length });
    return grants.length;
};

const mainCourseSelect = { id: true, title: true, slug: true } as const;

/**
 * The main course a student has this course as a reward with, when that's how
 * they hold it — a reward course earns no certificate of its own. Null when
 * they hold it any other way.
 */
export const rewardMainCourse = async (studentId: string, courseId: string) => {
    const grant = await prisma.courseGrant.findFirst({
        where: { studentId, courseId, source: GrantSource.BONUS, revokedAt: null },
        select: { bonus: { select: { mainCourse: { select: mainCourseSelect } } } },
    });
    return grant?.bonus?.mainCourse ?? null;
};

/** Every course a student holds as a reward, with the main course it came with — keyed by the reward course's id. */
export const rewardMainCourses = async (studentId: string) => {
    const grants = await prisma.courseGrant.findMany({
        where: { studentId, source: GrantSource.BONUS, revokedAt: null },
        select: { courseId: true, bonus: { select: { mainCourse: { select: mainCourseSelect } } } },
    });
    return new Map(grants.flatMap((grant) => (grant.bonus ? [[grant.courseId, grant.bonus.mainCourse] as const] : [])));
};
