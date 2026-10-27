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
 * an offer, and the courses a reward gives for finishing in time. Each grant
 * is one `CourseGrant` row under a unique key (offer or reward, student,
 * course), so a repeated payment callback or a second completion can never
 * give a course twice. A student who already has the course is left alone.
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

const HAS_ACCESS: EnrollmentStatus[] = [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED];

type GivenCourse = { id: string; title: string; slug: string };

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
        orderId?: string;
    },
) => {
    if (input.course.isDeleted || input.course.status !== CourseStatus.PUBLISHED) return false;

    const ids = { studentId: input.studentId, courseId: input.course.id };
    const key = input.offerId
        ? { offerId_studentId_courseId: { offerId: input.offerId, ...ids } }
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

/** Tells the student what they were given and why. */
export const announceGrants = async (studentId: string, given: GivenCourse[], why: string) => {
    if (given.length === 0) return;
    const names = given.map((course) => `"${course.title}"`).join(", ");
    await createNotification({
        userId: studentId,
        title: given.length === 1 ? "A free course is yours 🎁" : `${given.length} free courses are yours 🎁`,
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
