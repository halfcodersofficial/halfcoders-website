import status from "http-status";
import { CoursePhase } from "../../generated/prisma/enums";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";

/**
 * What a course's phase rules out. A present course is running and keeps
 * everything. An upcoming one hasn't started, so it has no modules and no
 * running outline yet: the Module Manager and the Outline Maker stay shut
 * until an admin moves it to present. A previous one is over and sold as
 * recorded classes, so it holds no support sessions. The consoles hide the
 * same doors; these are the locks behind them.
 */

const phaseOf = async (courseId: string) =>
    (await prisma.course.findUnique({ where: { id: courseId }, select: { phase: true } }))?.phase;

/** Adding modules or outline weeks: not on an upcoming course. */
export const assertCurriculumOpen = async (courseId: string) => {
    if ((await phaseOf(courseId)) === CoursePhase.UPCOMING) {
        throw new AppError(
            status.BAD_REQUEST,
            "This course is upcoming. Modules and the course outline open once an admin moves it to Present.",
        );
    }
};

/** Holding or joining a support session: not on a previous course. */
export const assertSupportOpen = async (courseId: string) => {
    if ((await phaseOf(courseId)) === CoursePhase.PREVIOUS) {
        throw new AppError(status.BAD_REQUEST, "This is a previous recorded course. It has no support sessions.");
    }
};
