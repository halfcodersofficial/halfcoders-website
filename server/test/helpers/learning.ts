import { randomUUID } from "crypto";
import { owner } from "./fixtures";

/*
 * Learning records arranged straight in the database — the parts of a course
 * a test needs, without going through the authoring API each time.
 */

export const createCourse = async (
    overrides: { title?: string; courseType?: "BOOTCAMP" | "TRADITIONAL"; status?: string; price?: number; phase?: "PRESENT" | "UPCOMING" | "PREVIOUS" } = {},
) => {
    const id = randomUUID();
    const slug = `course-${id.slice(0, 8)}`;
    const price = overrides.price ?? 0;
    await owner.query(
        `INSERT INTO learning.course (id, title, slug, description, "courseType", status, price, phase, pricing, "updatedAt")
         VALUES ($1, $2, $3, 'A course for tests.', $4::learning."CourseType", $5::learning."CourseStatus", $6,
                 $7::learning."CoursePhase", $8::learning."CoursePricing", now())`,
        [id, overrides.title ?? `Course ${slug}`, slug, overrides.courseType ?? "BOOTCAMP", overrides.status ?? "PUBLISHED", price,
            overrides.phase ?? "PRESENT", price > 0 ? "PAID" : "FREE"],
    );
    return { id, slug };
};

export const createMilestone = async (courseId: string, order = 1) => {
    const id = randomUUID();
    await owner.query(
        `INSERT INTO learning.milestone (id, "courseId", title, "order", "isPublished", "updatedAt") VALUES ($1, $2, $3, $4, true, now())`,
        [id, courseId, `Week ${order}`, order],
    );
    return id;
};

export const createModule = async (courseId: string, milestoneId: string, order = 1, title = `Module ${order}`) => {
    const id = randomUUID();
    await owner.query(
        `INSERT INTO learning.course_module (id, "milestoneId", "courseId", title, "order", "isPublished", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, now())`,
        [id, milestoneId, courseId, title, order],
    );
    return id;
};

export const createAssignment = async (
    courseId: string,
    milestoneId: string,
    overrides: { title?: string; totalMarks?: number; isPublished?: boolean; order?: number } = {},
) => {
    const id = randomUUID();
    await owner.query(
        `INSERT INTO learning.assignment (id, "milestoneId", "courseId", title, description, "totalMarks", "order", "isPublished", "updatedAt")
         VALUES ($1, $2, $3, $4, 'Build it.', $5, $6, $7, now())`,
        [id, milestoneId, courseId, overrides.title ?? "An assignment", overrides.totalMarks ?? 100, overrides.order ?? 1, overrides.isPublished ?? true],
    );
    return id;
};

export const enrol = async (studentId: string, courseId: string, status = "ACTIVE") => {
    const id = randomUUID();
    await owner.query(
        `INSERT INTO learning.enrollment (id, "studentId", "courseId", status, "updatedAt") VALUES ($1, $2, $3, $4::learning."EnrollmentStatus", now())`,
        [id, studentId, courseId, status],
    );
    return id;
};

export const assignMentor = async (courseId: string, mentorId: string, role = "LEAD") => {
    await owner.query(
        `INSERT INTO learning.course_mentor (id, "courseId", "mentorId", role) VALUES ($1, $2, $3, $4::learning."CourseMentorRole")`,
        [randomUUID(), courseId, mentorId, role],
    );
};

export const notificationsOf = async (userId: string) =>
    (await owner.query(`SELECT * FROM learning.notification WHERE "userId" = $1 ORDER BY "createdAt"`, [userId])).rows;

/** A published quiz on a module, with questions of [option texts, index of the right one]. */
export const createQuiz = async (courseId: string, moduleId: string, questions: [string, string[], number][]) => {
    const quizId = randomUUID();
    await owner.query(
        `INSERT INTO learning.quiz (id, "moduleId", "courseId", title, "isPublished", "updatedAt") VALUES ($1, $2, $3, 'Quiz', true, now())`,
        [quizId, moduleId, courseId],
    );
    const ids: { questionId: string; optionIds: string[] }[] = [];
    for (const [index, [text, options, correct]] of questions.entries()) {
        const questionId = randomUUID();
        await owner.query(
            `INSERT INTO learning.quiz_question (id, "quizId", question, "order", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
            [questionId, quizId, text, index + 1],
        );
        const optionIds: string[] = [];
        for (const [order, option] of options.entries()) {
            const optionId = randomUUID();
            await owner.query(
                `INSERT INTO learning.quiz_option (id, "questionId", text, "isCorrect", "order") VALUES ($1, $2, $3, $4, $5)`,
                [optionId, questionId, option, order === correct, order + 1],
            );
            optionIds.push(optionId);
        }
        ids.push({ questionId, optionIds });
    }
    return { quizId, questions: ids };
};

/** A finished attempt: one picked option per question, scored as the service would. */
export const createAttempt = async (
    quiz: Awaited<ReturnType<typeof createQuiz>>,
    studentId: string,
    enrollmentId: string,
    picks: number[],
    correctIndexes: number[],
) => {
    const attemptId = randomUUID();
    const correct = picks.filter((pick, index) => pick === correctIndexes[index]).length;
    await owner.query(
        `INSERT INTO learning.quiz_attempt (id, "quizId", "studentId", "enrollmentId", status, "totalQuestions", "correctCount", "incorrectCount", score, percentage, "completedAt")
         VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6, $7, $6, $8, now())`,
        [attemptId, quiz.quizId, studentId, enrollmentId, picks.length, correct, picks.length - correct, Math.round((correct / picks.length) * 100)],
    );
    for (const [index, pick] of picks.entries()) {
        await owner.query(
            `INSERT INTO learning.quiz_attempt_answer (id, "attemptId", "questionId", "selectedOptionId", "isCorrect") VALUES ($1, $2, $3, $4, $5)`,
            [randomUUID(), attemptId, quiz.questions[index].questionId, quiz.questions[index].optionIds[pick], pick === correctIndexes[index]],
        );
    }
    return attemptId;
};

/** A support session on a course, hosted by `mentorId`, `startsInMinutes` from now. */
export const createSupportSession = async (
    courseId: string,
    mentorId: string,
    { startsInMinutes = 60, minutes = 60, status = "SCHEDULED", title = "Office hours" } = {},
) => {
    const id = randomUUID();
    const start = new Date(Date.now() + startsInMinutes * 60_000);
    await owner.query(
        `INSERT INTO learning.support_session (id, "courseId", "mentorId", title, "startTime", "endTime", status, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::learning."SupportSessionStatus", now())`,
        [id, courseId, mentorId, title, start, new Date(start.getTime() + minutes * 60_000), status],
    );
    return id;
};

/** A student's place in a session's line. */
export const joinLine = async (sessionId: string, studentId: string, queueNumber: number, status = "COMPLETED") => {
    await owner.query(
        `INSERT INTO learning.support_queue (id, "sessionId", "studentId", "queueNumber", status, "completedAt")
         VALUES ($1, $2, $3, $4, $5::learning."SupportQueueStatus", CASE WHEN $5 = 'COMPLETED' THEN now() END)`,
        [randomUUID(), sessionId, studentId, queueNumber, status],
    );
};

/** A published lesson in a module. */
export const createLesson = async (courseId: string, moduleId: string, order = 1, title = `Lesson ${order}`) => {
    const id = randomUUID();
    await owner.query(
        `INSERT INTO learning.video (id, "moduleId", "courseId", title, "order", "isPublished", "updatedAt") VALUES ($1, $2, $3, $4, $5, true, now())`,
        [id, moduleId, courseId, title, order],
    );
    return id;
};
