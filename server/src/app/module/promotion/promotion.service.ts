import status from "http-status";
import { CoursePricing, CourseStatus, GrantSource, RewardCondition } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { adminCourseSelect } from "../../utils/adminCourseSelect";
import { isLive, rewardDeadline } from "../../utils/courseGrants";
import { logger } from "../../utils/logger";
import { bundlesWithCourse } from "../bundle/bundle.service";

/**
 * Per-course promotions: the free courses a purchase earns (offer) and the
 * courses finishing in time earns (reward). Admins set them up course by
 * course; the course page and checkout show them to students. Granting them
 * is `utils/courseGrants.ts`'s job.
 */

const promoCourseSelect = {
    id: true,
    title: true,
    slug: true,
    thumbnail: true,
    price: true,
    discountPrice: true,
    status: true,
    isDeleted: true,
} as const;

const offerInclude = {
    freeCourses: { orderBy: { order: "asc" }, include: { course: { select: promoCourseSelect } } },
} as const;

const rewardInclude = {
    rewardCourses: { orderBy: { order: "asc" }, include: { course: { select: promoCourseSelect } } },
} as const;

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * Every course with its offer and reward in brief and how many courses each
 * has given — the first view of the Offers and Rewards screens.
 */
const getPromotionCourses = async () => {
    const [courses, grants] = await Promise.all([
        prisma.course.findMany({
            where: { isDeleted: false },
            orderBy: { title: "asc" },
            select: {
                ...adminCourseSelect,
                offer: { select: { isActive: true, startsAt: true, endsAt: true, _count: { select: { freeCourses: true } } } },
                completionReward: {
                    select: { isActive: true, condition: true, deadlineAt: true, withinDays: true, _count: { select: { rewardCourses: true } } },
                },
            },
        }),
        prisma.courseGrant.findMany({
            where: { revokedAt: null },
            select: { source: true, offer: { select: { courseId: true } }, reward: { select: { courseId: true } } },
        }),
    ]);

    const given = (courseId: string, source: GrantSource) =>
        grants.filter((grant) =>
            source === GrantSource.OFFER ? grant.offer?.courseId === courseId : grant.reward?.courseId === courseId,
        ).length;

    return courses.map(({ offer, completionReward, ...course }) => ({
        course,
        offer: offer
            ? {
                  isActive: offer.isActive,
                  live: isLive(offer),
                  startsAt: offer.startsAt,
                  endsAt: offer.endsAt,
                  freeCount: offer._count.freeCourses,
                  given: given(course.id, GrantSource.OFFER),
              }
            : null,
        reward: completionReward
            ? {
                  isActive: completionReward.isActive,
                  condition: completionReward.condition,
                  deadlineAt: completionReward.deadlineAt,
                  withinDays: completionReward.withinDays,
                  rewardCount: completionReward._count.rewardCourses,
                  given: given(course.id, GrantSource.REWARD),
              }
            : null,
    }));
};

/** One course's offer and reward in full, with the latest students each gave courses to. */
const getPromotionCourse = async (courseId: string) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: {
            ...adminCourseSelect,
            offer: { include: offerInclude },
            completionReward: { include: rewardInclude },
        },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const grantSelect = {
        id: true,
        createdAt: true,
        revokedAt: true,
        student: { select: { id: true, name: true, image: true } },
        course: { select: { id: true, title: true } },
    } as const;
    const [offerGrants, rewardGrants] = await Promise.all([
        course.offer
            ? prisma.courseGrant.findMany({ where: { offerId: course.offer.id }, orderBy: { createdAt: "desc" }, take: 50, select: grantSelect })
            : [],
        course.completionReward
            ? prisma.courseGrant.findMany({
                  where: { rewardId: course.completionReward.id },
                  orderBy: { createdAt: "desc" },
                  take: 50,
                  select: grantSelect,
              })
            : [],
    ]);

    const { offer, completionReward, ...summary } = course;
    return { course: summary, offer, reward: completionReward, offerGrants, rewardGrants };
};

/** The courses given away must exist, and can't include the course itself. */
const assertGivable = async (courseId: string, courseIds: string[]) => {
    if (courseIds.includes(courseId)) throw new AppError(status.BAD_REQUEST, "A course can't be given away with itself.");
    const found = await prisma.course.count({ where: { id: { in: courseIds }, isDeleted: false } });
    if (found !== courseIds.length) throw new AppError(status.BAD_REQUEST, "One of those courses doesn't exist.");
};

const itemsFrom = (courseIds: string[]) => courseIds.map((id, order) => ({ courseId: id, order }));

/** Sets up — or changes — "buy this course, get these free". Only a paid course can carry one. */
const saveOffer = async (
    courseId: string,
    payload: { courseIds: string[]; isActive: boolean; startsAt?: Date | null; endsAt?: Date | null },
) => {
    const course = await prisma.course.findFirst({ where: { id: courseId, isDeleted: false }, select: { pricing: true } });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    if (course.pricing !== CoursePricing.PAID) throw new AppError(status.BAD_REQUEST, "Only a paid course can come with free courses.");
    await assertGivable(courseId, payload.courseIds);

    const data = { isActive: payload.isActive, startsAt: payload.startsAt ?? null, endsAt: payload.endsAt ?? null };
    logger.update("Saving course offer", { courseId, free: payload.courseIds });
    return prisma.$transaction(async (tx) => {
        const offer = await tx.courseOffer.upsert({ where: { courseId }, create: { courseId, ...data }, update: data });
        await tx.courseOfferItem.deleteMany({ where: { offerId: offer.id } });
        await tx.courseOfferItem.createMany({ data: itemsFrom(payload.courseIds).map((item) => ({ ...item, offerId: offer.id })) });
        return tx.courseOffer.findUniqueOrThrow({ where: { id: offer.id }, include: offerInclude });
    });
};

/** Removes the offer. Courses it already gave stay given. */
const deleteOffer = async (courseId: string) => {
    const { count } = await prisma.courseOffer.deleteMany({ where: { courseId } });
    if (count === 0) throw new AppError(status.NOT_FOUND, "This course has no offer.");
};

const saveReward = async (
    courseId: string,
    payload: {
        courseIds: string[];
        condition: RewardCondition;
        deadlineAt?: Date | null;
        withinDays?: number | null;
        isActive: boolean;
    },
) => {
    const course = await prisma.course.findFirst({ where: { id: courseId, isDeleted: false }, select: { id: true } });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    await assertGivable(courseId, payload.courseIds);

    const data = {
        condition: payload.condition,
        deadlineAt: payload.deadlineAt ?? null,
        withinDays: payload.withinDays ?? null,
        isActive: payload.isActive,
    };
    logger.update("Saving completion reward", { courseId, rewards: payload.courseIds });
    return prisma.$transaction(async (tx) => {
        const reward = await tx.completionReward.upsert({ where: { courseId }, create: { courseId, ...data }, update: data });
        await tx.completionRewardItem.deleteMany({ where: { rewardId: reward.id } });
        await tx.completionRewardItem.createMany({ data: itemsFrom(payload.courseIds).map((item) => ({ ...item, rewardId: reward.id })) });
        return tx.completionReward.findUniqueOrThrow({ where: { id: reward.id }, include: rewardInclude });
    });
};

/** Removes the reward. Courses it already gave stay given. */
const deleteReward = async (courseId: string) => {
    const { count } = await prisma.completionReward.deleteMany({ where: { courseId } });
    if (count === 0) throw new AppError(status.NOT_FOUND, "This course has no reward.");
};

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

const onSale = (course: { status: CourseStatus; isDeleted: boolean }) => !course.isDeleted && course.status === CourseStatus.PUBLISHED;

const publicCourse = ({ id, title, slug, thumbnail, price, discountPrice }: { id: string; title: string; slug: string; thumbnail: string | null; price: number; discountPrice: number | null }) => ({
    id,
    title,
    slug,
    thumbnail,
    price,
    discountPrice,
});

/**
 * What a course's page and checkout say about promotions: the free courses
 * buying it earns, the reward for finishing it in time (with this student's
 * own deadline, once they're enrolled), and the bundles it's sold in.
 */
const getCoursePromotions = async (courseId: string, user?: IRequestUser) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false, status: CourseStatus.PUBLISHED },
        select: {
            id: true,
            pricing: true,
            offer: { include: offerInclude },
            completionReward: { include: rewardInclude },
        },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    // An offer only stands while the course is paid — made free, it gives nothing away.
    const offerCourses =
        course.offer && isLive(course.offer) && course.pricing === CoursePricing.PAID
            ? course.offer.freeCourses.map((item) => item.course).filter(onSale)
            : [];
    const reward = course.completionReward?.isActive ? course.completionReward : null;
    const rewardCourses = reward ? reward.rewardCourses.map((item) => item.course).filter(onSale) : [];

    const [enrollment, earned, bundles] = await Promise.all([
        user && reward
            ? prisma.enrollment.findUnique({
                  where: { studentId_courseId: { studentId: user.userId, courseId } },
                  select: { startedAt: true },
              })
            : null,
        user && reward
            ? prisma.courseGrant.count({ where: { rewardId: reward.id, studentId: user.userId, revokedAt: null } })
            : 0,
        bundlesWithCourse(courseId, user),
    ]);

    // Past its date, a reward can't be earned any more — only one already earned still shows.
    const closed = Boolean(reward?.deadlineAt && reward.deadlineAt < new Date());

    return {
        offer:
            course.offer && offerCourses.length
                ? { endsAt: course.offer.endsAt, courses: offerCourses.map(publicCourse) }
                : null,
        reward:
            reward && rewardCourses.length && (!closed || earned > 0)
                ? {
                      condition: reward.condition,
                      deadlineAt: reward.deadlineAt,
                      withinDays: reward.withinDays,
                      /** This student's own deadline — set once they're enrolled. */
                      yourDeadline: enrollment ? rewardDeadline(reward, enrollment.startedAt) : null,
                      earned: earned > 0,
                      courses: rewardCourses.map(publicCourse),
                  }
                : null,
        bundles,
    };
};

export const PromotionService = {
    getPromotionCourses,
    getPromotionCourse,
    saveOffer,
    deleteOffer,
    saveReward,
    deleteReward,
    getCoursePromotions,
};
