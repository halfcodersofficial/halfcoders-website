import status from "http-status";
import { EnrollmentStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { adminCourseSelect } from "../../utils/adminCourseSelect";
import { SaveAdmissionTicketInput } from "./admissionTicket.validation";

/** Students who were admitted and still count: not cancelled, not lapsed. */
const ADMITTED: EnrollmentStatus[] = [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED];

const ticketSelect = {
    isActive: true,
    headline: true,
    subheadline: true,
    ticketTitle: true,
    badge: true,
    learnerLabel: true,
    courseLabel: true,
    courseName: true,
    fields: true,
    stubLabel: true,
    stubValue: true,
    showPhoto: true,
    taglineLead: true,
    taglineAccent: true,
    footerText: true,
    updatedAt: true,
} as const;

/** The foot fields as stored — a JSON column, so read it defensively. */
const fieldsOf = (value: unknown): { label: string; value: string }[] =>
    Array.isArray(value)
        ? value
              .filter((field): field is { label: string; value: string } => typeof field?.label === "string" && typeof field?.value === "string")
              .map(({ label, value }) => ({ label, value }))
        : [];

const withFields = <T extends { fields: unknown }>(ticket: T) => ({ ...ticket, fields: fieldsOf(ticket.fields) });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Every course as a card: whether it has a ticket, and how many students it would go to. */
const getTicketCourses = async () => {
    const courses = await prisma.course.findMany({
        where: { isDeleted: false },
        orderBy: { title: "asc" },
        select: {
            ...adminCourseSelect,
            admissionTicket: { select: { isActive: true, stubLabel: true, stubValue: true, updatedAt: true } },
            _count: { select: { enrollments: { where: { status: { in: ADMITTED } } } } },
        },
    });

    return courses.map(({ admissionTicket, _count, ...course }) => ({
        course,
        ticket: admissionTicket,
        students: _count.enrollments,
    }));
};

/** One course and its ticket (null before one is written). */
const getTicketCourse = async (courseId: string) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: {
            ...adminCourseSelect,
            admissionTicket: { select: ticketSelect },
            _count: { select: { enrollments: { where: { status: { in: ADMITTED } } } } },
        },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const { admissionTicket, _count, ...rest } = course;
    return { course: rest, ticket: admissionTicket && withFields(admissionTicket), students: _count.enrollments };
};

const saveTicket = async (courseId: string, payload: SaveAdmissionTicketInput) => {
    const course = await prisma.course.findFirst({ where: { id: courseId, isDeleted: false }, select: { id: true } });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const ticket = await prisma.admissionTicket.upsert({
        where: { courseId },
        create: { courseId, ...payload },
        update: payload,
        select: ticketSelect,
    });
    return withFields(ticket);
};

const deleteTicket = async (courseId: string) => {
    await prisma.admissionTicket.deleteMany({ where: { courseId } });
};

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

/**
 * The signed-in student's ticket for a course they're on: the course's
 * words, with their own name and photo to print on it. Not found when the
 * course has no ticket switched on, or they aren't (or are no longer) on it.
 */
const getMyTicket = async (user: IRequestUser, courseId: string) => {
    const [enrollment, course, learner] = await Promise.all([
        prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId: user.userId, courseId } },
            select: { status: true, startedAt: true },
        }),
        prisma.course.findFirst({
            where: { id: courseId, isDeleted: false },
            select: { id: true, title: true, slug: true, admissionTicket: { select: ticketSelect } },
        }),
        prisma.user.findUnique({ where: { id: user.userId }, select: { name: true, image: true } }),
    ]);

    const ticket = course?.admissionTicket;
    if (!course || !ticket?.isActive || !enrollment || !ADMITTED.includes(enrollment.status) || !learner) {
        throw new AppError(status.NOT_FOUND, "There's no admission ticket for this course.");
    }

    return {
        ticket: withFields(ticket),
        learner,
        course: { id: course.id, title: course.title, slug: course.slug },
        enrolledAt: enrollment.startedAt,
    };
};

export const AdmissionTicketService = {
    getTicketCourses,
    getTicketCourse,
    saveTicket,
    deleteTicket,
    getMyTicket,
};
