import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { CourseStatus, EnrollmentStatus, NotificationType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { learnerScope } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";
import { adminCourseSelect, AdminCourseCard } from "../../utils/adminCourseSelect";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { logger } from "../../utils/logger";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { courseMentorOrder } from "../course/course.constant";
import { createNotification } from "../notification/notification.service";
import { collectAll, toCsv } from "../../utils/csvExport";

type Tx = Prisma.TransactionClient;

/**
 * Turns a settled purchase into course access (plan §34). Called by the order
 * flow once payment is confirmed, and by the admin manual-enrolment endpoint.
 *
 * Idempotent: re-running for the same student/course reactivates the existing
 * enrolment rather than creating a duplicate, so a repeated payment callback
 * can't hand out two enrolments.
 */
export const activateEnrollment = async (
    tx: Tx,
    input: { studentId: string; courseId: string; orderId?: string },
) => {
    const existing = await tx.enrollment.findUnique({
        where: { studentId_courseId: { studentId: input.studentId, courseId: input.courseId } },
        select: { id: true, status: true },
    });

    if (existing) {
        if (existing.status === EnrollmentStatus.ACTIVE || existing.status === EnrollmentStatus.COMPLETED) {
            return tx.enrollment.findUniqueOrThrow({ where: { id: existing.id } });
        }
        return tx.enrollment.update({
            where: { id: existing.id },
            data: {
                status: EnrollmentStatus.ACTIVE,
                ...(input.orderId ? { orderId: input.orderId } : {}),
            },
        });
    }

    // Start the student at the first published module so "Continue Learning"
    // works before they have watched anything.
    const firstMilestone = await tx.milestone.findFirst({
        where: { courseId: input.courseId, isPublished: true },
        orderBy: { order: "asc" },
        select: {
            id: true,
            modules: {
                where: { isPublished: true },
                orderBy: { order: "asc" },
                take: 1,
                select: { id: true },
            },
        },
    });

    return tx.enrollment.create({
        data: {
            studentId: input.studentId,
            courseId: input.courseId,
            orderId: input.orderId,
            status: EnrollmentStatus.ACTIVE,
            currentMilestoneId: firstMilestone?.id,
            currentModuleId: firstMilestone?.modules[0]?.id,
        },
    });
};

const enrollmentCourseSelect = {
    id: true,
    title: true,
    slug: true,
    thumbnail: true,
    duration: true,
    level: true,
    courseType: true,
    category: { select: { id: true, title: true, slug: true } },
    mentors: {
        orderBy: courseMentorOrder,
        take: 3,
        select: { mentor: { select: { id: true, name: true, image: true } } },
    },
} as const;

/** "My Courses" on the student dashboard (plan §14). */
const getMyEnrollments = async (user: IRequestUser, query: IQueryParams) => {
    return new QueryBuilder(prisma.enrollment, query, {
        filterableFields: ["status"],
        maxLimit: 50,
    })
        .filter()
        .sort()
        .paginate()
        .include({
            course: { select: enrollmentCourseSelect },
            currentModule: { select: { id: true, title: true, order: true } },
            currentMilestone: { select: { id: true, title: true, order: true } },
            certificate: { select: { id: true, certificateNo: true, issuedAt: true } },
        })
        .where({ studentId: user.userId })
        .execute();
};

const getMyEnrollment = async (user: IRequestUser, courseId: string) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId } },
        include: {
            course: { select: enrollmentCourseSelect },
            currentModule: { select: { id: true, title: true, order: true } },
            currentMilestone: { select: { id: true, title: true, order: true } },
            certificate: true,
        },
    });

    if (!enrollment) throw new AppError(status.NOT_FOUND, "You are not enrolled in this course.");
    return enrollment;
};

/** Admin enrolment register (plan §36). */
/** The admin register's row: who, where they are in the course, how they got in, and their certificate. */
const adminEnrollmentInclude = {
    student: { select: { id: true, name: true, email: true, image: true, phone: true } },
    // The course's own words for its units ("Week", "Day"…) name where the student is.
    course: { select: { id: true, title: true, slug: true, thumbnail: true, milestoneLabel: true, moduleLabel: true } },
    order: { select: { id: true, orderNumber: true, total: true, status: true, createdAt: true } },
    currentMilestone: { select: { id: true, title: true, order: true } },
    currentModule: { select: { id: true, title: true, order: true } },
    certificate: { select: { id: true, certificateNo: true, status: true, issuedAt: true } },
} satisfies Prisma.EnrollmentInclude;

const getAllEnrollments = async (query: IQueryParams) => {
    return new QueryBuilder(prisma.enrollment, query, {
        searchableFields: ["student.name", "student.email", "student.phone", "course.title"],
        filterableFields: ["status", "courseId", "studentId"],
        // Newest first by default; a course's list can also rank by progress.
        sortableFields: ["createdAt", "progress"],
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include(adminEnrollmentInclude)
        .execute();
};

/** The enrolments list as a CSV — same filters, search and order as on screen. */
const exportEnrollments = async (query: IQueryParams) => {
    const enrollments = (await collectAll(getAllEnrollments, query)) as Prisma.EnrollmentGetPayload<{ include: typeof adminEnrollmentInclude }>[];
    return toCsv(
        ["Student", "Email", "Phone", "Course", "Status", "Progress %", "Where they are", "Enrolled", "Completed", "Access ends", "Order", "Certificate"],
        enrollments.map((row) => [
            row.student.name,
            row.student.email,
            row.student.phone,
            row.course.title,
            row.status,
            row.progress,
            [
                row.currentMilestone && `${row.course.milestoneLabel} ${row.currentMilestone.order}`,
                row.currentModule && `${row.course.moduleLabel} ${row.currentModule.order}`,
            ]
                .filter(Boolean)
                .join(" · "),
            row.createdAt,
            row.completedAt,
            row.expiresAt,
            row.order?.orderNumber ?? "Added by an admin",
            row.certificate?.certificateNo,
        ]),
    );
};

type EnrollmentCounts = Record<EnrollmentStatus, number>;
const noEnrollments = (): EnrollmentCounts => ({ ACTIVE: 0, COMPLETED: 0, CANCELLED: 0, EXPIRED: 0 });

/**
 * Enrolments rolled up per course: how many sit in each status, how far the
 * students who still have access are on average, how many came in by hand
 * rather than through a paid order, certificates issued, and the latest
 * enrolment.
 */
const summariseEnrollments = async (courseIds?: string[]) => {
    const scope = courseIds ? { courseId: { in: courseIds } } : {};
    const [groups, manual, certificates] = await Promise.all([
        prisma.enrollment.groupBy({
            by: ["courseId", "status"],
            where: scope,
            _count: { _all: true },
            _avg: { progress: true },
            _max: { createdAt: true },
        }),
        prisma.enrollment.groupBy({ by: ["courseId"], where: { ...scope, orderId: null }, _count: { _all: true } }),
        prisma.certificate.groupBy({ by: ["courseId"], where: { ...scope, status: "ISSUED" }, _count: { _all: true } }),
    ]);

    const byCourse = new Map<
        string,
        { counts: EnrollmentCounts; progressSum: number; lastEnrolledAt: Date | null }
    >();
    for (const group of groups) {
        const entry = byCourse.get(group.courseId) ?? { counts: noEnrollments(), progressSum: 0, lastEnrolledAt: null };
        entry.counts[group.status] = group._count._all;
        // Averaged over the students who can still open the course.
        if (group.status === EnrollmentStatus.ACTIVE || group.status === EnrollmentStatus.COMPLETED) {
            entry.progressSum += (group._avg.progress ?? 0) * group._count._all;
        }
        const last = group._max.createdAt;
        if (last && (!entry.lastEnrolledAt || last > entry.lastEnrolledAt)) entry.lastEnrolledAt = last;
        byCourse.set(group.courseId, entry);
    }

    return {
        byCourse,
        manual: new Map(manual.map((row) => [row.courseId, row._count._all])),
        certificates: new Map(certificates.map((row) => [row.courseId, row._count._all])),
    };
};

const toEnrollmentSummary = (course: AdminCourseCard, summary: Awaited<ReturnType<typeof summariseEnrollments>>) => {
    const entry = summary.byCourse.get(course.id);
    const counts = entry?.counts ?? noEnrollments();
    const withAccess = counts.ACTIVE + counts.COMPLETED;
    return {
        course,
        counts: { ...counts, total: Object.values(counts).reduce((sum, n) => sum + n, 0) },
        averageProgress: withAccess > 0 ? Math.round((entry?.progressSum ?? 0) / withAccess) : 0,
        manual: summary.manual.get(course.id) ?? 0,
        certificates: summary.certificates.get(course.id) ?? 0,
        lastEnrolledAt: entry?.lastEnrolledAt ?? null,
    };
};

/**
 * The Enrolments screen's first view: every course with its students rolled
 * up. A deleted course still shows while it has enrolments. Courses with the
 * most students learning come first, then the most recently joined.
 */
const getEnrollmentCourses = async () => {
    const [courses, summary] = await Promise.all([
        prisma.course.findMany({
            where: { OR: [{ isDeleted: false }, { enrollments: { some: {} } }] },
            select: adminCourseSelect,
        }),
        summariseEnrollments(),
    ]);

    return courses
        .map((course) => toEnrollmentSummary(course, summary))
        .sort(
            (a, b) =>
                b.counts.ACTIVE - a.counts.ACTIVE ||
                (b.lastEnrolledAt?.getTime() ?? 0) - (a.lastEnrolledAt?.getTime() ?? 0) ||
                a.course.title.localeCompare(b.course.title),
        );
};

/** One course's roll-up, for the header of its student list. */
const getEnrollmentCourse = async (courseId: string) => {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: adminCourseSelect });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found");
    return toEnrollmentSummary(course, await summariseEnrollments([courseId]));
};

/**
 * Student progress across one course (plan §21 — the mentor's "Student
 * Progress" view).
 *
 * Scoped by `assertCanManageCourse`, so a mentor sees only the courses they are
 * assigned to while an admin sees any. That gate is the whole reason this is a
 * separate endpoint from the admin-only enrolment register.
 */
const getCourseStudents = async (user: IRequestUser, courseId: string, query: IQueryParams) => {
    await assertCanManageCourse(user, courseId);

    return new QueryBuilder(prisma.enrollment, query, {
        searchableFields: ["student.name", "student.email"],
        filterableFields: ["status"],
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            student: { select: { id: true, name: true, email: true, image: true } },
            currentModule: { select: { id: true, title: true, order: true } },
            currentMilestone: { select: { id: true, title: true, order: true } },
            _count: { select: { submissions: true, practiceCompletions: true } },
        })
        .where({ courseId })
        .execute();
};

/**
 * Admin manual enrolment — for offline payments (bKash sent directly, cash at
 * the office) that never went through the checkout flow.
 */
const enrollStudentManually = async (input: { studentId: string; courseId: string }) => {
    const [student, course] = await Promise.all([
        // Anyone with a live Half Coders learning profile (the admin picker lists
        // learners); an account never seen on Half Coders or removed from it can't
        // be enrolled from here.
        prisma.user.findFirst({
            where: { id: input.studentId, ...learnerScope() },
            select: { id: true, name: true },
        }),
        prisma.course.findFirst({
            where: { id: input.courseId, isDeleted: false },
            select: { id: true, title: true, slug: true, status: true },
        }),
    ]);

    if (!student) throw new AppError(status.NOT_FOUND, "Student not found.");
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    if (course.status !== CourseStatus.PUBLISHED) {
        throw new AppError(status.BAD_REQUEST, "Only published courses can be assigned to students.");
    }

    logger.create("Manual enrolment", { studentId: input.studentId, courseId: input.courseId });

    const enrollment = await prisma.$transaction((tx) => activateEnrollment(tx, input));

    await createNotification({
        userId: input.studentId,
        title: "You've been enrolled in a course",
        message: `You now have access to "${course.title}". Start learning any time.`,
        type: NotificationType.COURSE,
        link: `/learn/${course.slug}`,
        email: { actionLabel: "Start learning" },
    });

    return enrollment;
};

/** Revokes access without destroying learning history. */
const cancelEnrollment = async (enrollmentId: string) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { id: true, status: true },
    });
    if (!enrollment) throw new AppError(status.NOT_FOUND, "Enrolment not found.");

    return prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { status: EnrollmentStatus.CANCELLED },
    });
};

const reactivateEnrollment = async (enrollmentId: string) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { id: true, progress: true },
    });
    if (!enrollment) throw new AppError(status.NOT_FOUND, "Enrolment not found.");

    return prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
            status: enrollment.progress >= 100 ? EnrollmentStatus.COMPLETED : EnrollmentStatus.ACTIVE,
        },
    });
};

export const EnrollmentService = {
    exportEnrollments,
    activateEnrollment,
    getCourseStudents,
    getMyEnrollments,
    getMyEnrollment,
    getAllEnrollments,
    getEnrollmentCourses,
    getEnrollmentCourse,
    enrollStudentManually,
    cancelEnrollment,
    reactivateEnrollment,
};
