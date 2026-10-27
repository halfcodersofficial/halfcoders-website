import status from "http-status";
import { NotificationType, QuizAttemptStatus, XpSource } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { STUDENT_NAME_ONLY } from "../../lib/studentPrivacy";
import { assertCanManageCourse, assertModuleUnlocked, requireEnrollment } from "../../utils/courseAccess";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";
import { awardXp } from "../leaderboard/leaderboard.service";
import { createNotification } from "../notification/notification.service";

// ---------------------------------------------------------------------------
// Authoring (admin + assigned mentors)
// ---------------------------------------------------------------------------

type OptionInput = { id?: string; text: string; isCorrect?: boolean };

const loadModuleForWrite = async (user: IRequestUser, moduleId: string) => {
    const courseModule = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { id: true, courseId: true },
    });
    if (!courseModule) throw new AppError(status.NOT_FOUND, "Module not found.");

    await assertCanManageCourse(user, courseModule.courseId);
    return courseModule;
};

const createQuiz = async (
    user: IRequestUser,
    payload: { moduleId: string; title: string; description?: string },
) => {
    const courseModule = await loadModuleForWrite(user, payload.moduleId);

    const existing = await prisma.quiz.findUnique({
        where: { moduleId: payload.moduleId },
        select: { id: true },
    });
    if (existing) {
        throw new AppError(status.CONFLICT, "This module already has a quiz — edit it instead.");
    }

    logger.create("Creating quiz", { moduleId: payload.moduleId });

    return prisma.quiz.create({
        data: {
            title: payload.title,
            description: payload.description,
            moduleId: payload.moduleId,
            courseId: courseModule.courseId,
            createdById: user.userId,
        },
        include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    });
};

/** Announces a newly published quiz to everyone currently enrolled, same pattern as `AssignmentService.notifyCohort`. */
const notifyCohort = async (courseId: string, title: string, quizId: string) => {
    const [course, enrollments] = await Promise.all([
        prisma.course.findUnique({ where: { id: courseId }, select: { title: true, slug: true } }),
        prisma.enrollment.findMany({
            where: { courseId, status: { not: "CANCELLED" } },
            select: { studentId: true },
        }),
    ]);
    if (!course) return;

    await Promise.all(
        enrollments.map((enrollment) =>
            createNotification({
                userId: enrollment.studentId,
                title: "New quiz available",
                message: `"${title}" has been published in ${course.title}.`,
                type: NotificationType.QUIZ,
                link: `/learn/${course.slug}?quiz=${quizId}`,
            }),
        ),
    );
};

const updateQuiz = async (
    user: IRequestUser,
    quizId: string,
    payload: { title?: string; description?: string | null; isPublished?: boolean },
) => {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        select: {
            courseId: true,
            title: true,
            isPublished: true,
            _count: { select: { questions: true } },
        },
    });
    if (!quiz) throw new AppError(status.NOT_FOUND, "Quiz not found.");

    await assertCanManageCourse(user, quiz.courseId);

    // Every question is written with exactly one correct option and at least
    // two options (`quiz.validation.ts` enforces this on every write), so the
    // only thing left to check before letting students see this quiz is that
    // it actually has content.
    if (payload.isPublished === true && quiz._count.questions === 0) {
        throw new AppError(status.BAD_REQUEST, "Add at least one question before publishing this quiz.");
    }

    const isNewlyPublished = payload.isPublished === true && !quiz.isPublished;
    const data: Record<string, unknown> = { ...payload, updatedById: user.userId };
    if (isNewlyPublished) data.publishedAt = new Date();

    const updated = await prisma.quiz.update({ where: { id: quizId }, data });

    if (isNewlyPublished) void notifyCohort(quiz.courseId, updated.title, updated.id);

    return updated;
};

const deleteQuiz = async (user: IRequestUser, quizId: string) => {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        select: { courseId: true, _count: { select: { attempts: true } } },
    });
    if (!quiz) throw new AppError(status.NOT_FOUND, "Quiz not found.");

    await assertCanManageCourse(user, quiz.courseId);

    if (quiz._count.attempts > 0) {
        throw new AppError(
            status.CONFLICT,
            `${quiz._count.attempts} student attempt(s) already exist for this quiz. Unpublish it instead of deleting so their results are preserved.`,
        );
    }

    logger.delete("Deleting quiz", { quizId });
    await prisma.quiz.delete({ where: { id: quizId } });
};

/** The quiz for one module, full detail (correct answers included) — staff editing only. */
const getQuizForModule = async (user: IRequestUser, moduleId: string) => {
    const courseModule = await loadModuleForWrite(user, moduleId);

    return prisma.quiz.findUnique({
        where: { moduleId: courseModule.id },
        include: {
            questions: {
                orderBy: { order: "asc" },
                include: { options: { orderBy: { order: "asc" } } },
            },
        },
    });
};

const createQuestion = async (
    user: IRequestUser,
    quizId: string,
    payload: { question: string; explanation?: string; order?: number; options: OptionInput[] },
) => {
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true, courseId: true } });
    if (!quiz) throw new AppError(status.NOT_FOUND, "Quiz not found.");

    await assertCanManageCourse(user, quiz.courseId);
    logger.create("Adding quiz question", { quizId });

    const { order, options, ...rest } = payload;

    return prisma.$transaction(async (tx) => {
        const siblings = await tx.quizQuestion.findMany({
            where: { quizId },
            select: { id: true },
            orderBy: { order: "asc" },
        });

        const position = order ? Math.min(order, siblings.length + 1) : siblings.length + 1;

        const created = await tx.quizQuestion.create({
            data: {
                ...rest,
                quizId,
                order: siblings.length + 1,
                options: {
                    create: options.map((option, index) => ({
                        text: option.text,
                        isCorrect: option.isCorrect ?? false,
                        order: index + 1,
                    })),
                },
            },
        });

        if (position <= siblings.length) {
            const ids = siblings.map((s) => s.id);
            ids.splice(position - 1, 0, created.id);
            await applyOrdering(ids, (id, newOrder) =>
                tx.quizQuestion.update({ where: { id }, data: { order: newOrder } }),
            );
        }

        return tx.quizQuestion.findUniqueOrThrow({
            where: { id: created.id },
            include: { options: { orderBy: { order: "asc" } } },
        });
    });
};

/**
 * Options are replaced wholesale rather than diffed field-by-field — a
 * question's options are authored as one unit (see `quiz.validation.ts`), and
 * a quiz has no traffic mid-edit the way a published video does, so there's no
 * "in-flight attempt" risk to preserving row identity across an edit.
 */
const replaceQuestionOptions = async (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    questionId: string,
    options: OptionInput[],
) => {
    await tx.quizOption.deleteMany({ where: { questionId } });
    await tx.quizOption.createMany({
        data: options.map((option, index) => ({
            questionId,
            text: option.text,
            isCorrect: option.isCorrect ?? false,
            order: index + 1,
        })),
    });
};

const updateQuestion = async (
    user: IRequestUser,
    questionId: string,
    payload: { question?: string; explanation?: string | null; options?: OptionInput[] },
) => {
    const question = await prisma.quizQuestion.findUnique({
        where: { id: questionId },
        select: { id: true, quiz: { select: { courseId: true } } },
    });
    if (!question) throw new AppError(status.NOT_FOUND, "Question not found.");

    await assertCanManageCourse(user, question.quiz.courseId);

    const { options, ...rest } = payload;

    return prisma.$transaction(async (tx) => {
        if (options) await replaceQuestionOptions(tx, questionId, options);

        return tx.quizQuestion.update({
            where: { id: questionId },
            data: rest,
            include: { options: { orderBy: { order: "asc" } } },
        });
    });
};

const deleteQuestion = async (user: IRequestUser, questionId: string) => {
    const question = await prisma.quizQuestion.findUnique({
        where: { id: questionId },
        select: { quizId: true, quiz: { select: { courseId: true } } },
    });
    if (!question) throw new AppError(status.NOT_FOUND, "Question not found.");

    await assertCanManageCourse(user, question.quiz.courseId);
    logger.delete("Deleting quiz question", { questionId });

    await prisma.$transaction(async (tx) => {
        await tx.quizQuestion.delete({ where: { id: questionId } });

        const remaining = await tx.quizQuestion.findMany({
            where: { quizId: question.quizId },
            orderBy: { order: "asc" },
            select: { id: true },
        });

        await applyOrdering(remaining.map((q) => q.id), (id, order) =>
            tx.quizQuestion.update({ where: { id }, data: { order } }),
        );
    });
};

const reorderQuestions = async (user: IRequestUser, quizId: string, orderedIds: string[]) => {
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
    if (!quiz) throw new AppError(status.NOT_FOUND, "Quiz not found.");

    await assertCanManageCourse(user, quiz.courseId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.quizQuestion.findMany({ where: { quizId }, select: { id: true } });
        assertCompleteOrdering(orderedIds, existing.map((q) => q.id));

        await applyOrdering(orderedIds, (id, order) =>
            tx.quizQuestion.update({ where: { id }, data: { order } }),
        );

        return tx.quizQuestion.findMany({
            where: { quizId },
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
        });
    });
};

// ---------------------------------------------------------------------------
// Student side
// ---------------------------------------------------------------------------

/** Strips `isCorrect` (and drops the explanation) so a student never receives
 *  the answer before they submit one. */
const sanitiseQuestion = (question: {
    id: string;
    question: string;
    order: number;
    options: { id: string; text: string; order: number }[];
}) => ({
    id: question.id,
    question: question.question,
    order: question.order,
    options: question.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
});

const RESULT_SELECT = {
    id: true,
    score: true,
    percentage: true,
    correctCount: true,
    incorrectCount: true,
    totalQuestions: true,
    completedAt: true,
} as const;

/**
 * The student's submission for a quiz, if they've made one. A quiz is taken
 * once; a student who finished it several times under the old retake flow
 * gets their best result, matching the score the course sidebar shows.
 */
const findSubmission = (quizId: string, studentId: string) =>
    prisma.quizAttempt.findFirst({
        where: { quizId, studentId, status: QuizAttemptStatus.COMPLETED },
        orderBy: [{ percentage: "desc" }, { completedAt: "asc" }],
        select: RESULT_SELECT,
    });

/**
 * One quiz as the student sees it. Before they've submitted: the questions,
 * with nothing that gives the answers away. After: their result instead —
 * there's nothing left to answer, and the correct answers come from the
 * review (`getAttempt`).
 */
const getQuizForStudent = async (user: IRequestUser, quizId: string) => {
    const quiz = await prisma.quiz.findFirst({
        where: { id: quizId, isPublished: true },
        select: {
            id: true,
            title: true,
            description: true,
            courseId: true,
            module: { select: { id: true, title: true } },
            questions: {
                orderBy: { order: "asc" },
                select: {
                    id: true,
                    question: true,
                    order: true,
                    options: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } },
                },
            },
        },
    });
    if (!quiz) throw new AppError(status.NOT_FOUND, "Quiz not found.");

    const enrollment = await requireEnrollment(user, quiz.courseId);
    await assertModuleUnlocked(enrollment.id, quiz.module.id);

    const result = await findSubmission(quizId, user.userId);

    return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        moduleTitle: quiz.module.title,
        totalQuestions: quiz.questions.length,
        result,
        questions: result ? [] : quiz.questions.map(sanitiseQuestion),
    };
};

/**
 * Grades a whole answer sheet and records it as the student's one attempt.
 *
 * Nothing about correctness leaves the server until this returns: the sheet
 * must answer every question exactly once, it's scored here from the stored
 * options (never from anything the client claims), and only then can the
 * review reveal the answers. A quiz is submitted once — a second submit is
 * refused, not re-scored.
 */
const submitQuiz = async (
    user: IRequestUser,
    quizId: string,
    payload: { answers: { questionId: string; selectedOptionId: string }[] },
) => {
    const quiz = await prisma.quiz.findFirst({
        where: { id: quizId, isPublished: true },
        select: {
            id: true,
            courseId: true,
            moduleId: true,
            questions: { select: { id: true, options: { select: { id: true, isCorrect: true } } } },
        },
    });
    if (!quiz) throw new AppError(status.NOT_FOUND, "Quiz not found.");
    if (quiz.questions.length === 0) {
        throw new AppError(status.BAD_REQUEST, "This quiz has no questions yet.");
    }

    const enrollment = await requireEnrollment(user, quiz.courseId);
    await assertModuleUnlocked(enrollment.id, quiz.moduleId);

    const questionsById = new Map(quiz.questions.map((question) => [question.id, question]));
    const selected = new Map<string, string>();
    for (const answer of payload.answers) {
        const question = questionsById.get(answer.questionId);
        if (!question) throw new AppError(status.BAD_REQUEST, "One of those questions isn't part of this quiz.");
        if (selected.has(answer.questionId)) {
            throw new AppError(status.BAD_REQUEST, "Each question can only be answered once.");
        }
        if (!question.options.some((option) => option.id === answer.selectedOptionId)) {
            throw new AppError(status.BAD_REQUEST, "One of those options isn't part of its question.");
        }
        selected.set(answer.questionId, answer.selectedOptionId);
    }

    const unanswered = quiz.questions.length - selected.size;
    if (unanswered > 0) {
        throw new AppError(
            status.BAD_REQUEST,
            `Answer every question before submitting — ${unanswered} left.`,
        );
    }

    const graded = quiz.questions.map((question) => {
        const selectedOptionId = selected.get(question.id)!;
        return {
            questionId: question.id,
            selectedOptionId,
            isCorrect: question.options.some((option) => option.id === selectedOptionId && option.isCorrect),
        };
    });
    const totalQuestions = graded.length;
    const correctCount = graded.filter((answer) => answer.isCorrect).length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);

    const result = await prisma.$transaction(async (tx) => {
        // Serialises submits of this quiz by this student — a double click or
        // a second tab waits here, then finds the first submission below and
        // is refused, instead of both passing the check at once. Released
        // when the transaction ends.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`quiz-submit:${quizId}:${user.userId}`}))::text`;

        const existing = await tx.quizAttempt.findFirst({
            where: { quizId, studentId: user.userId, status: QuizAttemptStatus.COMPLETED },
            select: { id: true },
        });
        if (existing) {
            throw new AppError(status.CONFLICT, "You've already submitted this quiz — it can only be taken once.");
        }

        return tx.quizAttempt.create({
            data: {
                quizId,
                studentId: user.userId,
                enrollmentId: enrollment.id,
                status: QuizAttemptStatus.COMPLETED,
                totalQuestions,
                correctCount,
                incorrectCount: totalQuestions - correctCount,
                score: correctCount,
                percentage,
                completedAt: new Date(),
                answers: { create: graded },
            },
            select: RESULT_SELECT,
        });
    });

    logger.update("Quiz submitted", { quizId, studentId: user.userId, percentage });

    await awardXp(prisma, {
        studentId: user.userId,
        courseId: quiz.courseId,
        source: XpSource.QUIZ_COMPLETE,
        refId: quizId,
    });

    return result;
};

/** Full per-question review of one attempt — "See Correct Answers". */
const getAttempt = async (user: IRequestUser, attemptId: string) => {
    const attempt = await prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        include: {
            quiz: {
                select: {
                    id: true,
                    title: true,
                    courseId: true,
                    questions: {
                        orderBy: { order: "asc" },
                        include: { options: { orderBy: { order: "asc" } } },
                    },
                },
            },
            answers: true,
        },
    });
    if (!attempt) throw new AppError(status.NOT_FOUND, "Attempt not found.");

    // A student may read their own; staff need management rights on the course.
    if (attempt.studentId !== user.userId) {
        await assertCanManageCourse(user, attempt.quiz.courseId);
    }

    const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const isCompleted = attempt.status === QuizAttemptStatus.COMPLETED;

    return {
        id: attempt.id,
        status: attempt.status,
        score: attempt.score,
        percentage: attempt.percentage,
        correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount,
        totalQuestions: attempt.totalQuestions,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        quiz: { id: attempt.quiz.id, title: attempt.quiz.title },
        questions: attempt.quiz.questions.map((q) => {
            const answer = answerByQuestion.get(q.id);
            // Answers are revealed only for a submitted quiz — never question by
            // question. (Attempts still in progress are left over from the old
            // answer-as-you-go flow; they reveal nothing.)
            const reveal = isCompleted;

            return {
                id: q.id,
                question: q.question,
                explanation: reveal ? q.explanation : null,
                options: q.options.map((o) => ({
                    id: o.id,
                    text: o.text,
                    isCorrect: reveal ? o.isCorrect : undefined,
                })),
                selectedOptionId: answer?.selectedOptionId ?? null,
                isCorrect: answer?.isCorrect ?? null,
            };
        }),
    };
};

/**
 * One quiz's results for the staff who teach it: every finished attempt (the
 * student by name only — lib/studentPrivacy) and, per question, how many
 * answered it, how many got it right and how the answers spread across the
 * options — so a mentor can see which questions trip people up.
 */
const getQuizResults = async (user: IRequestUser, quizId: string) => {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        select: {
            id: true, title: true, courseId: true, isPublished: true,
            module: { select: { id: true, title: true, order: true } },
            questions: {
                orderBy: { order: "asc" },
                select: {
                    id: true, question: true, order: true,
                    options: { orderBy: { order: "asc" }, select: { id: true, text: true, isCorrect: true } },
                },
            },
        },
    });
    if (!quiz) throw new AppError(status.NOT_FOUND, "Quiz not found.");
    await assertCanManageCourse(user, quiz.courseId);

    const finished = { attempt: { quizId, status: QuizAttemptStatus.COMPLETED } };
    const [attempts, outcomes, picks] = await Promise.all([
        prisma.quizAttempt.findMany({
            where: { quizId, status: QuizAttemptStatus.COMPLETED },
            orderBy: { completedAt: "desc" },
            select: {
                id: true, percentage: true, correctCount: true, totalQuestions: true, completedAt: true,
                student: { select: STUDENT_NAME_ONLY },
            },
        }),
        prisma.quizAttemptAnswer.groupBy({ by: ["questionId", "isCorrect"], where: finished, _count: { _all: true } }),
        prisma.quizAttemptAnswer.groupBy({ by: ["selectedOptionId"], where: finished, _count: { _all: true } }),
    ]);

    const pickedOf = new Map(picks.map((row) => [row.selectedOptionId, row._count._all]));
    return {
        quiz: { id: quiz.id, title: quiz.title, isPublished: quiz.isPublished, module: quiz.module },
        attempts,
        questions: quiz.questions.map(({ options, ...question }) => {
            const rows = outcomes.filter((row) => row.questionId === question.id);
            const answered = rows.reduce((sum, row) => sum + row._count._all, 0);
            const correct = rows.find((row) => row.isCorrect)?._count._all ?? 0;
            return {
                ...question,
                answered,
                correct,
                percentCorrect: answered > 0 ? Math.round((correct / answered) * 100) : null,
                options: options.map((option) => ({ ...option, picked: pickedOf.get(option.id) ?? 0 })),
            };
        }),
    };
};

const getMyAttempts = async (user: IRequestUser, quizId: string) => {
    return prisma.quizAttempt.findMany({
        where: { quizId, studentId: user.userId },
        orderBy: { startedAt: "desc" },
        select: {
            id: true,
            status: true,
            score: true,
            percentage: true,
            correctCount: true,
            incorrectCount: true,
            totalQuestions: true,
            startedAt: true,
            completedAt: true,
        },
    });
};

export const QuizService = {
    getQuizResults,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    getQuizForModule,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    getQuizForStudent,
    submitQuiz,
    getAttempt,
    getMyAttempts,
};
