import { Prisma } from "../../generated/prisma/client";

/** The quizzes of these modules, or of these assignments. */
type QuizOwners = { moduleId: { in: string[] } } | { assignmentId: { in: string[] } };

/**
 * A quiz goes live with what it belongs to — its module or its assignment —
 * and comes down with it. It has no release and no announcement of its own;
 * the module's or the assignment's covers it. A quiz with no questions yet
 * stays a draft (there's nothing to take); staff make it live from its page
 * once it's written, its owner being live.
 */
export const setQuizzesLive = async (tx: Prisma.TransactionClient, owners: QuizOwners, live: boolean) => {
    if (!live) {
        await tx.quiz.updateMany({ where: { ...owners, isPublished: true }, data: { isPublished: false } });
        return;
    }
    const ready = { ...owners, isPublished: false, questions: { some: {} } };
    // Stamped once, like the owner's own `publishedAt`.
    await tx.quiz.updateMany({ where: { ...ready, publishedAt: null }, data: { publishedAt: new Date() } });
    await tx.quiz.updateMany({ where: ready, data: { isPublished: true } });
};
