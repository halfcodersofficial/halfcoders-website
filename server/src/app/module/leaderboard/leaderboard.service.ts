import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { XpSource } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { adminCourseSelect, AdminCourseCard } from "../../utils/adminCourseSelect";
import { logger } from "../../utils/logger";
import { getXpRules } from "../../utils/platformSettings";

/** Prisma client or an interactive transaction client — both work here. */
type Db = Prisma.TransactionClient | typeof prisma;

interface AwardXpInput {
    studentId: string;
    courseId: string;
    source: XpSource;
    /** Id of the video / submission / milestone that earned the points. */
    refId: string;
    /** Overrides the configured rule — used for score-proportional awards. */
    points?: number;
}

/**
 * Records an XP award and bumps the student's course total.
 *
 * Awards are idempotent on `(studentId, source, refId)`: re-marking a video
 * complete, or a mentor re-grading the same submission, must not inflate the
 * leaderboard. The unique index does the enforcing, and a duplicate is
 * swallowed rather than surfaced — the caller's real work (recording progress)
 * has already succeeded and must not be rolled back over a double award.
 */
export const awardXp = async (db: Db, input: AwardXpInput): Promise<number> => {
    const rules = await getXpRules();
    const points = input.points ?? rules[input.source] ?? 0;

    if (points <= 0) return 0;

    try {
        await db.xpTransaction.create({
            data: {
                studentId: input.studentId,
                courseId: input.courseId,
                source: input.source,
                refId: input.refId,
                points,
            },
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            // Already awarded for this exact event — nothing to do.
            return 0;
        }
        throw error;
    }

    await db.courseXp.upsert({
        where: { studentId_courseId: { studentId: input.studentId, courseId: input.courseId } },
        create: { studentId: input.studentId, courseId: input.courseId, totalXp: points },
        update: { totalXp: { increment: points } },
    });

    logger.create("XP awarded", { studentId: input.studentId, source: input.source, points });
    return points;
};

const studentCard = {
    id: true,
    name: true,
    image: true,
} as const;

/**
 * Course leaderboard (plan §31). Ranked by XP descending; ties are broken by
 * who reached their total first, so the board is stable between requests.
 */
const getCourseLeaderboard = async (courseId: string, query: IQueryParams) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: { id: true, title: true },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
        prisma.courseXp.count({ where: { courseId } }),
        prisma.courseXp.findMany({
            where: { courseId },
            orderBy: [{ totalXp: "desc" }, { updatedAt: "asc" }],
            skip,
            take: limit,
            include: {
                student: { select: studentCard },
                course: { select: { id: true, title: true, slug: true } },
            },
        }),
    ]);

    return {
        data: rows.map((row, index) => ({
            rank: skip + index + 1,
            student: row.student,
            totalXp: row.totalXp,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * The signed-in student's own standing. Rank is computed as "how many people
 * are strictly ahead of me, plus one" — a count query, so it stays cheap no
 * matter how large the cohort grows.
 */
const getMyRank = async (user: IRequestUser, courseId: string) => {
    const mine = await prisma.courseXp.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId } },
        select: { totalXp: true, updatedAt: true },
    });

    if (!mine) {
        return { rank: null, totalXp: 0, totalStudents: await prisma.courseXp.count({ where: { courseId } }) };
    }

    const [ahead, totalStudents] = await Promise.all([
        prisma.courseXp.count({
            where: {
                courseId,
                OR: [
                    { totalXp: { gt: mine.totalXp } },
                    // Same score: whoever got there first ranks higher, matching
                    // the ordering used by getCourseLeaderboard.
                    { totalXp: mine.totalXp, updatedAt: { lt: mine.updatedAt } },
                ],
            },
        }),
        prisma.courseXp.count({ where: { courseId } }),
    ]);

    return { rank: ahead + 1, totalXp: mine.totalXp, totalStudents };
};

/** XP ledger for the student's profile page — where their points came from. */
const getMyXpHistory = async (user: IRequestUser, query: IQueryParams) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);

    const where = {
        studentId: user.userId,
        ...(typeof query.courseId === "string" ? { courseId: query.courseId } : {}),
    };

    const [total, data] = await Promise.all([
        prisma.xpTransaction.count({ where }),
        prisma.xpTransaction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: { course: { select: { id: true, title: true, slug: true } } },
        }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// ---------------------------------------------------------------------------
// Admin overview, course by course
// ---------------------------------------------------------------------------

/** XP sources as an admin reads them: the five kinds of work that earn it. */
type XpGroup = "lessons" | "assignments" | "practice" | "support" | "milestones";

const XP_GROUP: Record<XpSource, XpGroup> = {
    VIDEO_COMPLETE: "lessons",
    QUIZ_COMPLETE: "lessons",
    ASSIGNMENT_SUBMIT: "assignments",
    ASSIGNMENT_SCORE: "assignments",
    PRACTICE_COMPLETE: "practice",
    SUPPORT_PARTICIPATION: "support",
    MODULE_COMPLETE: "milestones",
    MILESTONE_COMPLETE: "milestones",
    COURSE_COMPLETE: "milestones",
};

const noXp = (): Record<XpGroup, number> => ({ lessons: 0, assignments: 0, practice: 0, support: 0, milestones: 0 });

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Each course's standings rolled up: who's ranked, how much XP, where it came from, its top three. */
const summariseXp = async (courseIds: string[]) => {
    const inCourses = { courseId: { in: courseIds } };
    const [standings, bySource, thisWeek, latest, tops] = await Promise.all([
        prisma.courseXp.groupBy({
            by: ["courseId"],
            where: { ...inCourses, totalXp: { gt: 0 } },
            _count: { _all: true },
            _sum: { totalXp: true },
        }),
        prisma.xpTransaction.groupBy({ by: ["courseId", "source"], where: inCourses, _sum: { points: true } }),
        prisma.xpTransaction.groupBy({
            by: ["courseId"],
            where: { ...inCourses, createdAt: { gte: new Date(Date.now() - WEEK_MS) } },
            _sum: { points: true },
        }),
        prisma.xpTransaction.groupBy({ by: ["courseId"], where: inCourses, _max: { createdAt: true } }),
        // Same order as the board itself, so the top three match it.
        Promise.all(
            courseIds.map((courseId) =>
                prisma.courseXp.findMany({
                    where: { courseId, totalXp: { gt: 0 } },
                    orderBy: [{ totalXp: "desc" }, { updatedAt: "asc" }],
                    take: 3,
                    select: { totalXp: true, student: { select: studentCard } },
                }),
            ),
        ),
    ]);

    const sources = new Map<string, Record<XpGroup, number>>();
    for (const row of bySource) {
        if (!row.courseId) continue;
        const groups = sources.get(row.courseId) ?? noXp();
        groups[XP_GROUP[row.source]] += row._sum.points ?? 0;
        sources.set(row.courseId, groups);
    }

    return {
        standings: new Map(standings.map((row) => [row.courseId, row])),
        sources,
        thisWeek: new Map(thisWeek.map((row) => [row.courseId, row._sum.points ?? 0])),
        latest: new Map(latest.map((row) => [row.courseId, row._max.createdAt])),
        tops: new Map(courseIds.map((courseId, index) => [courseId, tops[index]])),
    };
};

const toXpSummary = (course: AdminCourseCard, summary: Awaited<ReturnType<typeof summariseXp>>) => {
    const standing = summary.standings.get(course.id);
    const ranked = standing?._count._all ?? 0;
    const totalXp = standing?._sum.totalXp ?? 0;
    return {
        course,
        /** Students with any XP on the course — everyone on its board. */
        ranked,
        totalXp,
        averageXp: ranked > 0 ? Math.round(totalXp / ranked) : 0,
        xpThisWeek: summary.thisWeek.get(course.id) ?? 0,
        lastXpAt: summary.latest.get(course.id) ?? null,
        bySource: summary.sources.get(course.id) ?? noXp(),
        top: (summary.tops.get(course.id) ?? []).map((row, index) => ({ rank: index + 1, ...row })),
    };
};

/**
 * The Leaderboard's first view for admins: every course with its standings
 * rolled up. The most active boards this week come first.
 */
const getLeaderboardCourses = async () => {
    const courses = await prisma.course.findMany({ where: { isDeleted: false }, select: adminCourseSelect });
    if (courses.length === 0) return [];

    const summary = await summariseXp(courses.map((course) => course.id));
    return courses
        .map((course) => toXpSummary(course, summary))
        .sort(
            (a, b) =>
                b.xpThisWeek - a.xpThisWeek ||
                b.ranked - a.ranked ||
                a.course.title.localeCompare(b.course.title),
        );
};

/** One course's roll-up, for the head of its standings. */
const getLeaderboardCourse = async (courseId: string) => {
    const course = await prisma.course.findFirst({ where: { id: courseId, isDeleted: false }, select: adminCourseSelect });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    return toXpSummary(course, await summariseXp([courseId]));
};

export const LeaderboardService = {
    awardXp,
    getCourseLeaderboard,
    getMyRank,
    getMyXpHistory,
    getLeaderboardCourses,
    getLeaderboardCourse,
};
