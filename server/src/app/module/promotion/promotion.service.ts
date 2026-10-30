import status from "http-status";
import { CoursePricing, CourseStatus, GrantSource, RewardCondition } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { adminCourseSelect } from "../../utils/adminCourseSelect";
import {
    announceGrants,
    bonusSelect,
    giveBonusCourse,
    HAS_ACCESS,
    isLive,
    releaseBonusCourse,
    rewardDeadline,
    type GivenCourse,
} from "../../utils/courseGrants";
import { logger } from "../../utils/logger";
import { bundlesWithCourse } from "../bundle/bundle.service";

/**
 * Per-course promotions: the free courses a purchase earns (offer), the
 * courses finishing in time earns (reward), and the reward courses an admin
 * gives with a course (bonus). Admins set them up course by course; the
 * course page and checkout show offers and rewards to students. Granting
 * them is `utils/courseGrants.ts`'s job.
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
                bonusCourses: { select: { forEveryone: true, _count: { select: { grants: { where: { revokedAt: null } } } } } },
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

    return courses.map(({ offer, completionReward, bonusCourses, ...course }) => ({
        course,
        bonus: bonusCourses.length
            ? {
                  courseCount: bonusCourses.length,
                  forEveryone: bonusCourses.filter((bonus) => bonus.forEveryone).length,
                  given: bonusCourses.reduce((sum, bonus) => sum + bonus._count.grants, 0),
              }
            : null,
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

/** One course's offer, reward and reward courses in full, with the latest students each gave courses to. */
const getPromotionCourse = async (courseId: string) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: {
            ...adminCourseSelect,
            offer: { include: offerInclude },
            completionReward: { include: rewardInclude },
            bonusCourses: {
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    forEveryone: true,
                    createdAt: true,
                    course: { select: promoCourseSelect },
                    _count: { select: { grants: { where: { revokedAt: null } } } },
                },
            },
        },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const grantSelect = {
        id: true,
        createdAt: true,
        revokedAt: true,
        bonusId: true,
        student: { select: { id: true, name: true, image: true } },
        course: { select: { id: true, title: true } },
    } as const;
    const [offerGrants, rewardGrants, bonusGrants] = await Promise.all([
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
        course.bonusCourses.length
            ? prisma.courseGrant.findMany({
                  where: { bonus: { mainCourseId: courseId } },
                  orderBy: { createdAt: "desc" },
                  take: 50,
                  select: grantSelect,
              })
            : [],
    ]);

    const { offer, completionReward, bonusCourses, ...summary } = course;
    return {
        course: summary,
        offer,
        reward: completionReward,
        bonuses: bonusCourses.map(({ _count, ...bonus }) => ({ ...bonus, holders: _count.grants })),
        offerGrants,
        rewardGrants,
        bonusGrants,
    };
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
// Reward courses — given alongside a main course, by hand
// ---------------------------------------------------------------------------

/** The students who have the main course now — all of them, or the ones named. */
const holdersOf = async (mainCourseId: string, studentIds?: string[]) => {
    const rows = await prisma.enrollment.findMany({
        where: { courseId: mainCourseId, status: { in: HAS_ACCESS }, ...(studentIds ? { studentId: { in: studentIds } } : {}) },
        select: { studentId: true },
    });
    return rows.map((row) => row.studentId);
};

/**
 * Gives each student the reward courses — a transaction per student, so a
 * whole class isn't one long lock — and tells each what they got. Counts the
 * students it gave something to, and the ones who already had it all.
 */
const giveToStudents = async (bonuses: { id: string; course: Parameters<typeof giveBonusCourse>[2]["course"] }[], studentIds: string[], mainTitle: string) => {
    let reached = 0;
    for (const studentId of studentIds) {
        const given = await prisma.$transaction(async (tx) => {
            const opened: GivenCourse[] = [];
            for (const bonus of bonuses) {
                if (await giveBonusCourse(tx, studentId, bonus)) opened.push({ id: bonus.course.id, title: bonus.course.title, slug: bonus.course.slug });
            }
            return opened;
        });
        if (given.length) {
            reached += 1;
            await announceGrants(studentId, given, `They come with "${mainTitle}".`, "reward course");
        }
    }
    return { students: reached, alreadyHad: studentIds.length - reached };
};

/**
 * Gives reward courses with a main course: to the students named (one or a
 * group — each must have the main course), or to everyone who has it, which
 * also switches on "everyone" so whoever gets the main course later gets
 * them too.
 */
const giveRewardCourses = async (
    mainCourseId: string,
    payload: { courseIds: string[]; audience: "STUDENTS" | "EVERYONE"; studentIds?: string[] },
) => {
    const main = await prisma.course.findFirst({ where: { id: mainCourseId, isDeleted: false }, select: { id: true, title: true } });
    if (!main) throw new AppError(status.NOT_FOUND, "Course not found.");
    await assertGivable(mainCourseId, payload.courseIds);

    const unpublished = await prisma.course.findMany({
        where: { id: { in: payload.courseIds }, status: { not: CourseStatus.PUBLISHED } },
        select: { title: true },
    });
    if (unpublished.length) {
        throw new AppError(status.BAD_REQUEST, `Publish "${unpublished[0].title}" first — only a published course can be given.`);
    }

    const everyone = payload.audience === "EVERYONE";
    const named = everyone ? undefined : [...new Set(payload.studentIds ?? [])];
    const students = await holdersOf(mainCourseId, named);
    if (named) {
        const missing = named.length - students.length;
        if (missing > 0) {
            throw new AppError(
                status.BAD_REQUEST,
                named.length === 1 ? `That student doesn't have "${main.title}".` : `${missing} of those students don't have "${main.title}".`,
            );
        }
    }

    logger.create("Giving reward courses", { mainCourseId, courses: payload.courseIds, audience: payload.audience, students: students.length });
    const bonuses = await prisma.$transaction(
        payload.courseIds.map((courseId) =>
            prisma.bonusCourse.upsert({
                where: { mainCourseId_courseId: { mainCourseId, courseId } },
                create: { mainCourseId, courseId, forEveryone: everyone },
                // Giving to a few never switches "everyone" off.
                update: everyone ? { forEveryone: true } : {},
                select: bonusSelect,
            }),
        ),
    );

    return { ...(await giveToStudents(bonuses, students, main.title)), forEveryone: everyone };
};

const findBonus = async (bonusId: string) => {
    const bonus = await prisma.bonusCourse.findUnique({
        where: { id: bonusId },
        select: { ...bonusSelect, mainCourseId: true, mainCourse: { select: { title: true } } },
    });
    if (!bonus) throw new AppError(status.NOT_FOUND, "That reward course isn't on this course any more.");
    return bonus;
};

/** Switches "everyone who has the main course" on or off. On, everyone who has it now gets it straight away. */
const setRewardForEveryone = async (bonusId: string, forEveryone: boolean) => {
    const bonus = await findBonus(bonusId);
    await prisma.bonusCourse.update({ where: { id: bonusId }, data: { forEveryone } });
    logger.update("Reward course for everyone", { bonusId, forEveryone });
    if (!forEveryone) return { students: 0, alreadyHad: 0, forEveryone };
    return { ...(await giveToStudents([bonus], await holdersOf(bonus.mainCourseId), bonus.mainCourse.title)), forEveryone };
};

/**
 * Takes a reward course back from one student: their enrolment is cancelled
 * (progress kept) and the grant removed, so getting the main course again
 * doesn't bring it back — unless it's on for everyone.
 */
const takeBackRewardCourse = async (bonusId: string, studentId: string) => {
    const bonus = await findBonus(bonusId);
    const grant = await prisma.courseGrant.findFirst({
        where: { bonusId, studentId },
        select: { id: true, enrollmentId: true, revokedAt: true },
    });
    if (!grant) throw new AppError(status.NOT_FOUND, "This student doesn't have that reward course.");

    logger.update("Reward course taken back", { bonusId, studentId });
    await prisma.$transaction(async (tx) => {
        await tx.courseGrant.delete({ where: { id: grant.id } });
        if (!grant.revokedAt) {
            await releaseBonusCourse(tx, { studentId, courseId: bonus.course.id, enrollmentId: grant.enrollmentId, mainCourseId: bonus.mainCourseId });
        }
    });
};

/** Removes a reward course from its main course, taking it back from everyone who has it. */
const removeRewardCourse = async (bonusId: string) => {
    const bonus = await findBonus(bonusId);
    const grants = await prisma.courseGrant.findMany({
        where: { bonusId, revokedAt: null },
        select: { studentId: true, enrollmentId: true },
    });

    logger.delete("Removing reward course", { bonusId, takingBackFrom: grants.length });
    // One student at a time, then the entry (its grants go with it): stopped
    // half-way, running it again finishes the job.
    for (const grant of grants) {
        await prisma.$transaction((tx) =>
            releaseBonusCourse(tx, { ...grant, courseId: bonus.course.id, mainCourseId: bonus.mainCourseId }),
        );
    }
    await prisma.bonusCourse.delete({ where: { id: bonusId } });
    return { takenBack: grants.length };
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
    giveRewardCourses,
    setRewardForEveryone,
    takeBackRewardCourse,
    removeRewardCourse,
    getCoursePromotions,
};
