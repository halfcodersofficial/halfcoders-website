import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { NotificationType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { Role } from "../../lib/roles";
import { STUDENT_NAME_ONLY } from "../../lib/studentPrivacy";
import { assertCanManageCourse, requireCourseAccess, requireEnrollment } from "../../utils/courseAccess";
import { createNotification, notifyCourseMentors } from "../notification/notification.service";

/**
 * Questions on a lesson. Everyone in the thread — classmates and mentors —
 * appears by name, nothing more (lib/studentPrivacy), with a "Mentor" mark
 * on the course's staff so an answer's weight is clear.
 */
const thread = {
    author: { select: STUDENT_NAME_ONLY },
    answers: { orderBy: { createdAt: "asc" }, include: { author: { select: STUDENT_NAME_ONLY } } },
} satisfies Prisma.LessonQuestionInclude;

type Thread = Prisma.LessonQuestionGetPayload<{ include: typeof thread }>;

const isAdmin = (user: IRequestUser) => user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

/** The course's mentors, and every admin, as one set — to mark their posts. */
const staffOf = async (courseId: string, authorIds: string[]) => {
    if (authorIds.length === 0) return new Set<string>();
    const [mentors, admins] = await Promise.all([
        prisma.courseMentor.findMany({ where: { courseId, mentorId: { in: authorIds } }, select: { mentorId: true } }),
        prisma.user.findMany({ where: { id: { in: authorIds }, role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true } }),
    ]);
    return new Set([...mentors.map((row) => row.mentorId), ...admins.map((row) => row.id)]);
};

const present = (questions: Thread[], staff: Set<string>, viewer: IRequestUser) =>
    questions.map((question) => ({
        ...question,
        author: { ...question.author, isStaff: staff.has(question.author.id) },
        isMine: question.authorId === viewer.userId,
        answers: question.answers.map((answer) => ({
            ...answer,
            author: { ...answer.author, isStaff: staff.has(answer.author.id) },
            isMine: answer.authorId === viewer.userId,
        })),
    }));

const authorIdsOf = (questions: Thread[]) => [...new Set(questions.flatMap((q) => [q.authorId, ...q.answers.map((a) => a.authorId)]))];

const loadVideo = async (videoId: string) => {
    const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { id: true, title: true, courseId: true, course: { select: { slug: true, title: true } } },
    });
    if (!video) throw new AppError(status.NOT_FOUND, "Lesson not found.");
    return video;
};

/** A lesson's questions, open ones first, each with its answers — for its students and staff. */
const listForLesson = async (user: IRequestUser, videoId: string) => {
    const video = await loadVideo(videoId);
    await requireCourseAccess(user, video.courseId);
    const questions = await prisma.lessonQuestion.findMany({
        where: { videoId },
        orderBy: [{ isResolved: "asc" }, { createdAt: "desc" }],
        take: 100,
        include: thread,
    });
    return present(questions, await staffOf(video.courseId, authorIdsOf(questions)), user);
};

/** A student asks on a lesson; the course's mentors hear about it. */
const ask = async (user: IRequestUser, videoId: string, body: string) => {
    const video = await loadVideo(videoId);
    await requireEnrollment(user, video.courseId);
    const question = await prisma.lessonQuestion.create({
        data: { courseId: video.courseId, videoId, authorId: user.userId, body },
        include: thread,
    });
    await notifyCourseMentors(
        video.courseId,
        {
            title: `Question on “${video.title}”`,
            message: body.length > 200 ? `${body.slice(0, 197)}…` : body,
            type: NotificationType.COURSE,
            link: `/mentor/questions?focus=${question.id}`,
            senderId: user.userId,
        },
    );
    return present([question], new Set(), user)[0];
};

const loadQuestion = async (questionId: string) => {
    const question = await prisma.lessonQuestion.findUnique({
        where: { id: questionId },
        include: { video: { select: { id: true, title: true, course: { select: { slug: true } } } } },
    });
    if (!question) throw new AppError(status.NOT_FOUND, "Question not found.");
    return question;
};

/** Can this person speak for the course — one of its mentors, or an admin? */
const managesCourse = async (user: IRequestUser, courseId: string) => {
    if (user.role === Role.STUDENT) return false;
    await assertCanManageCourse(user, courseId);
    return true;
};

/**
 * Answers a question — a classmate on the course, or its staff. Whoever
 * asked hears about it (and is emailed when a mentor answers).
 */
const answer = async (user: IRequestUser, questionId: string, body: string) => {
    const question = await loadQuestion(questionId);
    const staff = await managesCourse(user, question.courseId);
    if (!staff) await requireEnrollment(user, question.courseId);

    const created = await prisma.lessonAnswer.create({
        data: { questionId, authorId: user.userId, body },
        include: { author: { select: STUDENT_NAME_ONLY } },
    });
    if (question.authorId !== user.userId) {
        await createNotification({
            userId: question.authorId,
            title: staff ? `A mentor answered your question` : `${created.author.name} answered your question`,
            message: `On “${question.video.title}”: ${body.length > 200 ? `${body.slice(0, 197)}…` : body}`,
            type: NotificationType.COURSE,
            link: `/learn/${question.video.course.slug}?video=${question.videoId}#q-${question.id}`,
            senderId: user.userId,
            ...(staff ? { email: { actionLabel: "See the answer" } } : {}),
        });
    }
    return { ...created, author: { ...created.author, isStaff: staff }, isMine: true };
};

/** Marks a question answered (or open again) — whoever asked, or the course's staff. */
const setResolved = async (user: IRequestUser, questionId: string, isResolved: boolean) => {
    const question = await loadQuestion(questionId);
    if (question.authorId !== user.userId && !(await managesCourse(user, question.courseId))) {
        throw new AppError(status.FORBIDDEN, "Only whoever asked, or the course's mentors, can mark this.");
    }
    return prisma.lessonQuestion.update({ where: { id: questionId }, data: { isResolved }, select: { id: true, isResolved: true } });
};

/** Takes a question down: whoever asked (while nobody has answered), or the course's staff. */
const removeQuestion = async (user: IRequestUser, questionId: string) => {
    const question = await loadQuestion(questionId);
    const staff = question.authorId === user.userId ? false : await managesCourse(user, question.courseId);
    if (!staff) {
        if (question.authorId !== user.userId) throw new AppError(status.FORBIDDEN, "You can only remove your own question.");
        const answers = await prisma.lessonAnswer.count({ where: { questionId } });
        if (answers > 0) throw new AppError(status.CONFLICT, "It has answers now — mark it answered instead.");
    }
    await prisma.lessonQuestion.delete({ where: { id: questionId } });
};

/** Takes an answer down: whoever wrote it, or the course's staff. */
const removeAnswer = async (user: IRequestUser, answerId: string) => {
    const found = await prisma.lessonAnswer.findUnique({ where: { id: answerId }, select: { authorId: true, question: { select: { courseId: true } } } });
    if (!found) throw new AppError(status.NOT_FOUND, "Answer not found.");
    if (found.authorId !== user.userId && !(await managesCourse(user, found.question.courseId))) {
        throw new AppError(status.FORBIDDEN, "You can only remove your own answer.");
    }
    await prisma.lessonAnswer.delete({ where: { id: answerId } });
};

/**
 * The staff inbox: questions across the courses they teach (an admin: all),
 * by default the ones still open — waiting longest first — with their lesson
 * and thread. `?courseId=` narrows it; `?status=resolved|all` widens it.
 */
const inbox = async (user: IRequestUser, query: IQueryParams) => {
    const courseIds = isAdmin(user)
        ? undefined
        : (await prisma.courseMentor.findMany({ where: { mentorId: user.userId }, select: { courseId: true } })).map((row) => row.courseId);
    const requested = typeof query.courseId === "string" && query.courseId ? query.courseId : undefined;
    if (requested && courseIds && !courseIds.includes(requested)) throw new AppError(status.FORBIDDEN, "You don't teach that course.");
    const scope: Prisma.LessonQuestionWhereInput = requested ? { courseId: requested } : courseIds ? { courseId: { in: courseIds } } : {};
    const state = query.status === "resolved" ? { isResolved: true } : query.status === "all" ? {} : { isResolved: false };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const where = { ...scope, ...state };
    const [total, open, questions] = await Promise.all([
        prisma.lessonQuestion.count({ where }),
        prisma.lessonQuestion.count({ where: { ...scope, isResolved: false } }),
        prisma.lessonQuestion.findMany({
            where,
            orderBy: { createdAt: query.status === "resolved" || query.status === "all" ? "desc" : "asc" },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                ...thread,
                video: { select: { id: true, title: true, module: { select: { title: true, order: true, milestone: { select: { order: true } } } } } },
                course: { select: { id: true, title: true, slug: true, milestoneLabel: true, moduleLabel: true } },
            },
        }),
    ]);

    const staffByCourse = new Map<string, Set<string>>();
    for (const courseId of new Set(questions.map((q) => q.courseId))) {
        staffByCourse.set(courseId, await staffOf(courseId, authorIdsOf(questions.filter((q) => q.courseId === courseId))));
    }
    return {
        data: questions.map((question) => ({ ...present([question], staffByCourse.get(question.courseId)!, user)[0], video: question.video, course: question.course })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit), open },
    };
};

export const LessonQaService = { listForLesson, ask, answer, setResolved, removeQuestion, removeAnswer, inbox };
