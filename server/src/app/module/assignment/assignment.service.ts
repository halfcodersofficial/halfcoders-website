import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { MarkAdjustmentKind, NotificationType, RecheckStatus, SubmissionStatus, XpSource } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { isSubmissionFile, SUBMISSION_FILE_FOLDER, uploadPrivateFileToCloudinary } from "../../config/cloudinary.config";
import { prisma } from "../../lib/prisma";
import { nameOnly, seesStudentDetails, studentSelectFor } from "../../lib/studentPrivacy";
import {
    ASSIGNMENT_PENALTIES,
    finalScore,
    forStudent,
    isResultHidden,
    type StudentSubmissionFields,
} from "../../utils/assignmentPenalties";
import { assertCanManageCourse, requireEnrollment } from "../../utils/courseAccess";
import { type LateTier, normaliseLateTiers, parseLateTiers, submissionWindow } from "../../utils/lateWindows";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";
import { applyReleaseRules, assertCanSchedule, nextWeekPosition, SCHEDULED_COURSE_FILTER } from "../../utils/weekItems";
import { getXpRules } from "../../utils/platformSettings";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { awardXp, deductXp } from "../leaderboard/leaderboard.service";
import { createNotification, createNotificationsFor, notifyCourseMentors } from "../notification/notification.service";

// ---------------------------------------------------------------------------
// Results, penalties and rechecks — shared by the student and staff sides
// (what a student may see of a mark: utils/assignmentPenalties `forStudent`)
// ---------------------------------------------------------------------------

type RubricInput = { criterionId: string; points: number; comment?: string }[];

/**
 * The mark a rubric's lines add up to: every line scored once, each within its
 * points — scaled to a late hand-in's cap when it has one.
 */
const scoreFromRubric = (
    criteria: { id: string; title: string; maxPoints: number }[],
    rubric: RubricInput,
    maxScore: number,
    totalMarks: number,
) => {
    if (criteria.length === 0) throw new AppError(status.BAD_REQUEST, "This assignment has no rubric.");
    const given = new Map(rubric.map((line) => [line.criterionId, line]));
    if (given.size !== rubric.length || criteria.some((line) => !given.has(line.id)) || given.size !== criteria.length) {
        throw new AppError(status.BAD_REQUEST, "Score every line of the rubric, once each.");
    }
    const over = criteria.find((line) => given.get(line.id)!.points > line.maxPoints);
    if (over) throw new AppError(status.BAD_REQUEST, `“${over.title}” is out of ${over.maxPoints}.`);
    const sum = rubric.reduce((total, line) => total + line.points, 0);
    return maxScore === totalMarks ? sum : Math.round((sum * maxScore) / totalMarks);
};

/**
 * What handing an assignment in right now would be: the first hand-in, a
 * resubmission the mentor asked for (changes asked, or rejected — free), a
 * resubmission of the student's own choosing before the results are out
 * (charged), or none at all (`null`: in review, or results out).
 */
const nextHandIn = (
    existing: { status: SubmissionStatus } | null,
    resultsPublishedAt: Date | null,
): "first" | "requested" | "voluntary" | null => {
    if (!existing) return "first";
    if (existing.status === SubmissionStatus.NEEDS_REVISION || existing.status === SubmissionStatus.REJECTED) return "requested";
    if (existing.status === SubmissionStatus.UNDER_REVIEW || resultsPublishedAt) return null;
    return "voluntary";
};

// ---------------------------------------------------------------------------
// Authoring (admin + assigned mentors)
// ---------------------------------------------------------------------------

/** A rubric's lines, in order. */
const rubricSelect = {
    orderBy: { order: "asc" },
    select: { id: true, title: true, description: true, maxPoints: true, order: true },
} satisfies Prisma.Assignment$rubricArgs;

type CreatePayload = {
    milestoneId: string;
    title: string;
    description: string;
    instructions?: string;
    attachments?: string[];
    totalMarks?: number;
    deadline?: Date;
    lateTiers?: LateTier[];
    order?: number;
    isPublished?: boolean;
    releaseAt?: Date | null;
};

const createAssignment = async (user: IRequestUser, payload: CreatePayload) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: payload.milestoneId },
        select: { id: true, courseId: true, title: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);
    logger.create("Creating assignment", { milestoneId: payload.milestoneId });

    await assertCanSchedule(milestone.courseId, payload.releaseAt);
    const { milestoneId, order, lateTiers, ...rest } = applyReleaseRules(payload);
    const tiers = normaliseLateTiers(lateTiers ?? [], payload.deadline ?? null, payload.totalMarks ?? 100);

    const assignment = await prisma.$transaction(async (tx) => {
        const siblings = await tx.assignment.findMany({
            where: { milestoneId },
            select: { id: true },
            orderBy: { order: "asc" },
        });

        const position = order ? Math.min(order, siblings.length + 1) : siblings.length + 1;

        const created = await tx.assignment.create({
            data: {
                ...rest,
                lateTiers: tiers,
                milestoneId,
                courseId: milestone.courseId,
                // Joins the end of the week's mixed list.
                position: await nextWeekPosition(tx, milestoneId),
                // Park past the end, then reposition — the unique
                // [milestoneId, order] index rules out inserting directly into
                // an occupied slot.
                order: siblings.length + 1,
            },
        });

        if (position <= siblings.length) {
            const ids = siblings.map((s) => s.id);
            ids.splice(position - 1, 0, created.id);
            await applyOrdering(ids, (id, newOrder) =>
                tx.assignment.update({ where: { id }, data: { order: newOrder } }),
            );
        }

        return tx.assignment.findUniqueOrThrow({ where: { id: created.id } });
    });

    // Publishing an assignment is news the cohort needs — especially when it
    // carries a deadline.
    if (payload.isPublished) {
        void notifyCohort(milestone.courseId, assignment.title, assignment.id);
    }

    return assignment;
};

const notifyCohort = async (courseId: string, title: string, assignmentId: string) => {
    const [course, enrollments] = await Promise.all([
        prisma.course.findUnique({ where: { id: courseId }, select: { title: true, slug: true } }),
        prisma.enrollment.findMany({
            where: { courseId, status: { not: "CANCELLED" } },
            select: { studentId: true },
        }),
    ]);

    if (!course) return;

    // One bulk write (and one email each) rather than a write per student.
    await createNotificationsFor(
        enrollments.map((enrollment) => enrollment.studentId),
        {
            title: "New assignment available",
            message: `"${title}" has been published in ${course.title}.`,
            type: NotificationType.ASSIGNMENT,
            link: `/learn/${course.slug}?assignment=${assignmentId}`,
            email: { actionLabel: "Open the assignment" },
        },
    );
};

const updateAssignment = async (
    user: IRequestUser,
    assignmentId: string,
    payload: Record<string, unknown>,
) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: {
            courseId: true, title: true, isPublished: true,
            deadline: true, totalMarks: true, lateTiers: true,
        },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");

    await assertCanManageCourse(user, assignment.courseId);

    const data: Record<string, unknown> = { ...payload };
    await assertCanSchedule(assignment.courseId, data.releaseAt as Date | null | undefined);
    applyReleaseRules(data as { releaseAt?: Date | null; isPublished?: boolean });

    // Only announce/stamp the transition into published, not every later edit.
    const isNewlyPublished = data.isPublished === true && !assignment.isPublished;
    if (isNewlyPublished) data.publishedAt = new Date();

    // The windows are re-checked whenever anything they depend on changes —
    // moving the deadline past a window, or dropping the total below a
    // window's marks, is refused rather than leaving a policy that can't apply.
    // Removing the deadline removes the windows with it.
    if (payload.lateTiers !== undefined || payload.deadline !== undefined || payload.totalMarks !== undefined) {
        const deadline = payload.deadline !== undefined ? (payload.deadline as Date | null) : assignment.deadline;
        const tiers =
            payload.lateTiers !== undefined ? (payload.lateTiers as LateTier[]) : parseLateTiers(assignment.lateTiers);
        data.lateTiers = deadline
            ? normaliseLateTiers(tiers, deadline, (payload.totalMarks as number | undefined) ?? assignment.totalMarks)
            : [];
    }

    const updated = await prisma.assignment.update({ where: { id: assignmentId }, data });

    if (isNewlyPublished) {
        void notifyCohort(assignment.courseId, updated.title, updated.id);
    }

    return updated;
};

/**
 * The scheduler's job for assignments: publish every one whose `releaseAt`
 * has arrived and tell the cohort, the same announcement a manual publish
 * makes. The query is its own dedup guard — once published, a row no longer
 * matches.
 */
const publishDueAssignments = async () => {
    const due = await prisma.assignment.findMany({
        where: { isPublished: false, releaseAt: { lte: new Date() }, ...SCHEDULED_COURSE_FILTER },
        select: { id: true, courseId: true, title: true },
    });
    if (due.length === 0) return;

    await prisma.assignment.updateMany({
        where: { id: { in: due.map((a) => a.id) } },
        data: { isPublished: true, publishedAt: new Date() },
    });
    logger.create("Auto-published scheduled assignments", { count: due.length });

    for (const assignment of due) {
        void notifyCohort(assignment.courseId, assignment.title, assignment.id);
    }
};

/** A week's assignments in their new order — the complete list, like every other reorder. */
const reorderAssignments = async (user: IRequestUser, milestoneId: string, orderedIds: string[]) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { courseId: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.assignment.findMany({ where: { milestoneId }, select: { id: true } });
        assertCompleteOrdering(orderedIds, existing.map((a) => a.id));

        await applyOrdering(orderedIds, (id, order) =>
            tx.assignment.update({ where: { id }, data: { order } }),
        );

        return tx.assignment.findMany({ where: { milestoneId }, orderBy: { order: "asc" } });
    });
};

const deleteAssignment = async (user: IRequestUser, assignmentId: string) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { courseId: true, milestoneId: true, _count: { select: { submissions: true } } },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");

    await assertCanManageCourse(user, assignment.courseId);

    // Deleting cascades to every submission — students would silently lose
    // graded work they can no longer produce again.
    if (assignment._count.submissions > 0) {
        throw new AppError(
            status.CONFLICT,
            `${assignment._count.submissions} student(s) have already submitted this assignment. Unpublish it instead of deleting so their work and scores are preserved.`,
        );
    }

    await prisma.$transaction(async (tx) => {
        await tx.assignment.delete({ where: { id: assignmentId } });

        const remaining = await tx.assignment.findMany({
            where: { milestoneId: assignment.milestoneId },
            orderBy: { order: "asc" },
            select: { id: true },
        });

        await applyOrdering(remaining.map((a) => a.id), (id, order) =>
            tx.assignment.update({ where: { id }, data: { order } }),
        );
    });
};

// ---------------------------------------------------------------------------
// Student side
// ---------------------------------------------------------------------------

/**
 * One assignment as the student sees it: the brief, its lessons (videos,
 * texts, links — visible exactly when the assignment is), and their own
 * submission.
 */
const getAssignmentForStudent = async (user: IRequestUser, assignmentId: string) => {
    const assignment = await prisma.assignment.findFirst({
        where: { id: assignmentId, isPublished: true },
        include: {
            milestone: { select: { id: true, title: true, order: true } },
            course: { select: { id: true, title: true, slug: true } },
            materials: {
                orderBy: { order: "asc" },
                select: {
                    id: true, type: true, title: true, description: true, order: true,
                    youtubeUrl: true, youtubeVideoId: true, content: true, resourceUrl: true,
                },
            },
            // How it's marked, line by line — students see it before they hand in.
            rubric: rubricSelect,
        },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");

    const enrollment = await requireEnrollment(user, assignment.courseId);

    const submission = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: user.userId } },
        include: {
            reviewedBy: { select: { id: true, name: true, image: true } },
            rubricScores: { select: { criterionId: true, points: true, comment: true } },
            // Every mark taken or given back, oldest first — the breakdown under the result.
            adjustments: {
                orderBy: { createdAt: "asc" },
                select: { id: true, kind: true, marks: true, note: true, createdAt: true },
            },
            rechecks: {
                orderBy: { createdAt: "desc" },
                select: {
                    id: true, reason: true, status: true, scoreBefore: true, scoreAfter: true,
                    reviewerNote: true, reviewedAt: true, createdAt: true,
                },
            },
        },
    });

    const now = new Date();
    const isOverdue = Boolean(assignment.deadline && assignment.deadline < now);
    const window = submissionWindow(assignment, now);
    const published = Boolean(assignment.resultsPublishedAt);
    const next = nextHandIn(submission, assignment.resultsPublishedAt);

    return {
        ...assignment,
        lateTiers: parseLateTiers(assignment.lateTiers),
        enrollmentId: enrollment.id,
        submission: submission ? forStudent(submission, assignment.resultsPublishedAt) : null,
        isOverdue,
        // Where a submission made right now would land — the page shows the
        // student what they'd be marked out of before they submit.
        window: {
            status: window.status,
            maxScore: window.status === "LATE" ? window.maxScore : null,
            until: window.status === "LATE" ? window.until : null,
        },
        resultsPublished: published,
        // The amounts, from the one place they're set — what the page shows is what's taken.
        penalties: ASSIGNMENT_PENALTIES,
        // A first hand-in needs a window still open (its mark cap is fixed
        // then); work sent back can always be reworked; before the results
        // are out a student may resubmit at a cost; in review, or once the
        // results are out, not at all.
        canSubmit: next === "first" ? window.status !== "CLOSED" : next !== null,
        // What the next hand-in costs: null when it's free.
        resubmitCost:
            next === "voluntary" ? { marks: ASSIGNMENT_PENALTIES.resubmitMarks, xp: ASSIGNMENT_PENALTIES.resubmitXp } : null,
        // A published, marked result with no recheck already waiting.
        canRecheck: Boolean(
            published && submission?.status === SubmissionStatus.ACCEPTED && submission.score !== null && !submission.recheckOpen,
        ),
    };
};

/**
 * Stores a student's files for an assignment they can hand in — PDFs and
 * images, already size- and signature-checked by the route — as private
 * assets, and returns each one's signed link and original name for the
 * hand-in to carry. Nothing is saved to the submission until they submit.
 */
const uploadSubmissionFiles = async (user: IRequestUser, assignmentId: string, files: Express.Multer.File[]) => {
    if (files.length === 0) throw new AppError(status.BAD_REQUEST, "Choose at least one file to attach.");

    const assignment = await prisma.assignment.findFirst({
        where: { id: assignmentId, isPublished: true },
        select: { courseId: true },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");
    await requireEnrollment(user, assignment.courseId);

    const uploaded = await Promise.all(
        files.map((file) => uploadPrivateFileToCloudinary(file.buffer, file.originalname, SUBMISSION_FILE_FOLDER)),
    );
    logger.create("Submission files uploaded", { assignmentId, studentId: user.userId, count: uploaded.length });
    return uploaded.map((file, index) => ({ url: file.url, name: files[index].originalname }));
};

/**
 * Tells the course's mentors a hand-in arrived — one inbox entry per
 * assignment that keeps count while it's unread (`fold`), titled with how
 * many of that assignment's hand-ins are waiting now, and opening the review
 * queue on just those.
 */
const notifyMentorsOfHandIn = async (
    user: IRequestUser,
    assignment: { id: string; courseId: string; title: string; course: { title: string } },
    { kind, late }: { kind: "first" | "requested" | "voluntary"; late: boolean },
) => {
    const [waiting, student] = await Promise.all([
        prisma.assignmentSubmission.count({ where: { assignmentId: assignment.id, status: SubmissionStatus.SUBMITTED } }),
        user.name ? { name: user.name } : prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } }),
    ]);
    const who = student?.name ?? "A student";
    const what =
        kind === "requested"
            ? "resubmitted it after your feedback"
            : kind === "voluntary"
              ? "resubmitted it before the results"
              : late
                ? "handed it in late"
                : "handed it in";

    await notifyCourseMentors(
        assignment.courseId,
        {
            title: waiting > 1 ? `${waiting} hand-ins waiting: ${assignment.title}` : `New hand-in: ${assignment.title}`,
            message: `${waiting > 1 ? "Latest: " : ""}${who} ${what} · ${assignment.course.title}`,
            type: NotificationType.ASSIGNMENT,
            link: `/mentor/reviews?course=${assignment.courseId}&assignment=${assignment.id}`,
        },
        { fold: true, except: user.userId },
    );
};

/**
 * Creates or replaces the student's submission (plan §16). One row per
 * student per assignment, so a resubmission updates in place and the mentor's
 * queue never fills with duplicates.
 *
 * Resubmitting before the results are published — of the student's own
 * choosing, not because the mentor sent it back — costs marks and XP
 * (`ASSIGNMENT_PENALTIES`), and only goes ahead with `acceptPenalty`, so a
 * page that didn't show the cost can never charge it. The resubmission, the
 * mark penalty and the XP penalty are one transaction, guarded on the attempt
 * number read here: two tabs or a double click can't both go through, or both
 * be charged.
 */
const submitAssignment = async (
    user: IRequestUser,
    assignmentId: string,
    payload: { content?: string; submissionUrl?: string; fileUrls?: string[]; acceptPenalty?: boolean },
) => {
    const assignment = await prisma.assignment.findFirst({
        where: { id: assignmentId, isPublished: true },
        select: {
            id: true, courseId: true, title: true, deadline: true, lateTiers: true, resultsPublishedAt: true,
            course: { select: { title: true } },
        },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");

    const enrollment = await requireEnrollment(user, assignment.courseId);

    // Files only ever come from the hand-in upload — never an arbitrary link passed off as one.
    if (payload.fileUrls?.some((url) => !isSubmissionFile(url))) {
        throw new AppError(status.BAD_REQUEST, "Attach files with the upload button — paste links in the text instead.");
    }

    const existing = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: user.userId } },
        select: { id: true, status: true, maxScore: true, attempts: true },
    });

    if (existing?.status === SubmissionStatus.UNDER_REVIEW) {
        throw new AppError(
            status.CONFLICT,
            "Your mentor is reviewing this submission. Wait for their feedback before resubmitting.",
        );
    }
    const kind = nextHandIn(existing, assignment.resultsPublishedAt);
    if (kind === null) {
        throw new AppError(
            status.CONFLICT,
            existing?.status === SubmissionStatus.ACCEPTED
                ? "The results are out, so this can't be resubmitted any more. If you think your mark is wrong, ask for a recheck."
                : "The results for this assignment have been published, so it can't be resubmitted any more.",
        );
    }
    const { resubmitMarks, resubmitXp } = ASSIGNMENT_PENALTIES;
    const penalised = kind === "voluntary";
    if (penalised && !payload.acceptPenalty) {
        throw new AppError(
            status.BAD_REQUEST,
            `Resubmitting now costs ${resubmitMarks} marks and ${resubmitXp} XP. Confirm that to go ahead.`,
        );
    }

    // The deadline and late windows apply only to a *first* submission, which
    // fixes the most it can score. Once a mentor has asked for revisions,
    // blocking the fix — or marking it down again for arriving "late" — would
    // punish the student for work they were explicitly told to redo.
    const window = submissionWindow(assignment, new Date());
    if (!existing && window.status === "CLOSED") {
        throw new AppError(
            status.BAD_REQUEST,
            parseLateTiers(assignment.lateTiers).length > 0
                ? "Submissions for this assignment have closed — the last late window has passed."
                : "The deadline for this assignment has passed.",
        );
    }
    const maxScore = window.status === "LATE" ? window.maxScore : null;

    logger.create("Assignment submitted", { assignmentId, studentId: user.userId, kind });

    let xpDeducted = 0;
    let submission;
    try {
        submission = await prisma.$transaction(async (tx) => {
            if (!existing) {
                return tx.assignmentSubmission.create({
                    data: {
                        assignmentId,
                        studentId: user.userId,
                        enrollmentId: enrollment.id,
                        content: payload.content,
                        submissionUrl: payload.submissionUrl,
                        fileUrls: payload.fileUrls ?? [],
                        status: SubmissionStatus.SUBMITTED,
                        maxScore,
                    },
                });
            }

            const attempt = existing.attempts + 1;
            // Conditional on the attempt and state just read — see the doc comment.
            // `maxScore` deliberately untouched: it was fixed by the first submission.
            // A resubmission replaces the attempt whole — a field left out is cleared,
            // not kept from last time — and clears the previous verdict, so it
            // isn't shown with a stale score attached to work that no longer exists.
            const moved = await tx.assignmentSubmission.updateMany({
                where: { id: existing.id, attempts: existing.attempts, status: existing.status },
                data: {
                    content: payload.content ?? null,
                    submissionUrl: payload.submissionUrl ?? null,
                    fileUrls: payload.fileUrls ?? [],
                    status: SubmissionStatus.SUBMITTED,
                    submittedAt: new Date(),
                    score: null,
                    feedback: null,
                    reviewedById: null,
                    reviewedAt: null,
                    attempts: attempt,
                    ...(penalised ? { markAdjustment: { decrement: resubmitMarks } } : {}),
                },
            });
            if (moved.count === 0) {
                throw new AppError(status.CONFLICT, "Your hand-in changed while you were submitting. Reload the page and try again.");
            }
            await tx.rubricScore.deleteMany({ where: { submissionId: existing.id } });

            if (penalised) {
                await tx.submissionMarkAdjustment.create({
                    data: {
                        submissionId: existing.id,
                        kind: MarkAdjustmentKind.RESUBMIT_PENALTY,
                        marks: -resubmitMarks,
                        refId: String(attempt),
                        note: `Resubmission ${attempt - 1}`,
                    },
                });
                xpDeducted = await deductXp(tx, {
                    studentId: user.userId,
                    courseId: assignment.courseId,
                    source: XpSource.ASSIGNMENT_RESUBMIT_PENALTY,
                    refId: `${existing.id}:${attempt}`,
                    points: resubmitXp,
                    note: `Resubmitted “${assignment.title}”`,
                });
                if (xpDeducted > 0) {
                    await tx.assignmentSubmission.update({
                        where: { id: existing.id },
                        data: { xpDeducted: { increment: xpDeducted } },
                    });
                }
            }

            return tx.assignmentSubmission.findUniqueOrThrow({ where: { id: existing.id } });
        });
    } catch (error) {
        // Two first hand-ins racing: the one-row-per-student index lets only one in.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new AppError(status.CONFLICT, "This was already handed in. Reload the page to see it.");
        }
        throw error;
    }

    // XP only for a hand-in by the deadline (see `XpRules`), judged by the
    // *first* submission like the late windows are — a first hand-in with no
    // late cap (`maxScore` null) was on time. Idempotent on (student, source,
    // assignment): resubmitting doesn't farm XP.
    const onTime = existing ? existing.maxScore === null : window.status === "ON_TIME";
    if (onTime) {
        await awardXp(prisma, {
            studentId: user.userId,
            courseId: assignment.courseId,
            source: XpSource.ASSIGNMENT_SUBMIT,
            refId: assignmentId,
            points: (await getXpRules()).ASSIGNMENT_ON_TIME,
        });
    }

    await notifyMentorsOfHandIn(user, assignment, { kind, late: maxScore !== null });

    return {
        ...forStudent(submission, assignment.resultsPublishedAt),
        // What this hand-in cost, for the confirmation the student sees.
        penalty: penalised ? { marks: resubmitMarks, xp: xpDeducted } : null,
    };
};

/** The student's own hand-ins — a mark still waiting for its results reads as waiting (`forStudent`). */
const getMySubmissions = async (user: IRequestUser, query: IQueryParams) => {
    const result = await new QueryBuilder(prisma.assignmentSubmission, query, {
        filterableFields: ["status", "assignmentId"],
        // This model timestamps with `submittedAt`; it has no `createdAt`.
        defaultSortBy: "submittedAt",
        sortableFields: ["submittedAt", "updatedAt", "reviewedAt", "score", "status"],
        maxLimit: 50,
    })
        .filter()
        .sort()
        .paginate()
        .include({
            assignment: {
                select: {
                    id: true, title: true, totalMarks: true, deadline: true, resultsPublishedAt: true,
                    course: { select: { id: true, title: true, slug: true } },
                    milestone: { select: { id: true, title: true, order: true } },
                },
            },
            reviewedBy: { select: { id: true, name: true, image: true } },
        })
        .where({ studentId: user.userId })
        .execute();

    type Row = StudentSubmissionFields & { assignment: { resultsPublishedAt: Date | null } };
    return { ...result, data: (result.data as Row[]).map((row) => forStudent(row, row.assignment.resultsPublishedAt)) };
};

// ---------------------------------------------------------------------------
// Mentor review
// ---------------------------------------------------------------------------

/**
 * The mentor's review queue. Scoped to courses the mentor is assigned to —
 * admins see everything.
 */
/**
 * The courses a review queue may cover: `null` when it must be empty, an id
 * list for a mentor (or one course), `undefined` for an admin's everything.
 * Optional course-wise scoping (`?courseId=`) is always intersected with what
 * this user may actually see — a mentor passing a course they don't teach gets
 * an empty queue rather than someone else's submissions, and a mentor with no
 * assigned courses an empty one rather than everyone's.
 */
const reviewScope = async (user: IRequestUser, query: IQueryParams): Promise<string[] | undefined | null> => {
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const courseIds = isAdmin
        ? []
        : (await prisma.courseMentor.findMany({ where: { mentorId: user.userId }, select: { courseId: true } })).map((c) => c.courseId);
    if (!isAdmin && courseIds.length === 0) return null;

    const requestedCourseId = typeof query.courseId === "string" && query.courseId ? query.courseId : undefined;
    if (requestedCourseId) return isAdmin || courseIds.includes(requestedCourseId) ? [requestedCourseId] : null;
    return isAdmin ? undefined : courseIds;
};

/**
 * How many of the queue's submissions are in each state, for its tabs — same
 * scope as the queue (course and assignment), but not narrowed by status or
 * search, so every tab can say what's behind it.
 */
const getReviewQueueCounts = async (user: IRequestUser, query: IQueryParams) => {
    // `RECHECK`: hand-ins with a recheck waiting — across states, so not part of the status sum.
    const counts: Record<SubmissionStatus | "RECHECK", number> = {
        SUBMITTED: 0, UNDER_REVIEW: 0, ACCEPTED: 0, NEEDS_REVISION: 0, REJECTED: 0, RECHECK: 0,
    };
    const scope = await reviewScope(user, query);
    if (scope === null) return counts;

    const assignmentId = typeof query.assignmentId === "string" && query.assignmentId ? query.assignmentId : undefined;
    const where = {
        ...(scope ? { assignment: { courseId: { in: scope } } } : {}),
        ...(assignmentId ? { assignmentId } : {}),
    };
    const [rows, rechecks] = await Promise.all([
        prisma.assignmentSubmission.groupBy({ by: ["status"], where, _count: { _all: true } }),
        prisma.assignmentSubmission.count({ where: { ...where, recheckOpen: true } }),
    ]);
    for (const row of rows) counts[row.status] = row._count._all;
    counts.RECHECK = rechecks;
    return counts;
};

/**
 * The review queue. `?recheck=open` narrows it to hand-ins with a recheck
 * waiting — the "Rechecks" tab.
 */
const getReviewQueue = async (user: IRequestUser, query: IQueryParams) => {
    const scopedCourseIds = await reviewScope(user, query);
    if (scopedCourseIds === null) return { data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 0 } };
    const rechecksOnly = query.recheck === "open";

    const result = await new QueryBuilder(prisma.assignmentSubmission, query, {
        // A mentor searches by name or assignment — never by email, which they don't see.
        searchableFields: seesStudentDetails(user)
            ? ["student.name", "student.email", "assignment.title"]
            : ["student.name", "assignment.title"],
        // `assignmentId` is how a hand-in notification opens on just its own.
        filterableFields: ["status", "assignmentId"],
        // Oldest-waiting first is the useful default for a review queue, so the
        // caller normally passes ?sortOrder=asc against this field.
        defaultSortBy: "submittedAt",
        sortableFields: ["submittedAt", "updatedAt", "status"],
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            // Mentors mark by name alone — see lib/studentPrivacy.
            student: { select: studentSelectFor(user, { id: true, name: true, email: true, image: true }) },
            // On a hand-in in review, the colleague reviewing it.
            reviewedBy: { select: { id: true, name: true } },
            rubricScores: { select: { criterionId: true, points: true, comment: true } },
            // The recheck history, newest first — the open one, when there is one, on top.
            rechecks: {
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    id: true, reason: true, status: true, scoreBefore: true, scoreAfter: true,
                    reviewerNote: true, reviewedAt: true, createdAt: true,
                    reviewedBy: { select: { id: true, name: true } },
                },
            },
            assignment: {
                select: {
                    id: true, title: true, totalMarks: true, deadline: true, resultsPublishedAt: true,
                    rubric: rubricSelect,
                    course: { select: { id: true, title: true, slug: true, milestoneLabel: true } },
                    milestone: { select: { id: true, title: true, order: true } },
                },
            },
        })
        .where({
            ...(scopedCourseIds ? { assignment: { courseId: { in: scopedCourseIds } } } : {}),
            ...(rechecksOnly ? { recheckOpen: true } : {}),
        })
        .execute();

    // The amounts with each hand-in, so a recheck's decision shows what each outcome costs.
    return { ...result, data: (result.data as object[]).map((row) => ({ ...row, penalties: ASSIGNMENT_PENALTIES })) };
};

/**
 * Records a mentor's verdict (plan §16). Accepting awards score-proportional
 * XP; returning it for revision reopens the submission for the student.
 */
const reviewSubmission = async (
    user: IRequestUser,
    submissionId: string,
    payload: {
        status: SubmissionStatus;
        score?: number;
        feedback?: string;
        rubric?: { criterionId: string; points: number; comment?: string }[];
    },
) => {
    const submission = await prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
        include: {
            assignment: {
                select: {
                    id: true, title: true, courseId: true, totalMarks: true, resultsPublishedAt: true,
                    course: { select: { slug: true, title: true } },
                },
            },
        },
    });
    if (!submission) throw new AppError(status.NOT_FOUND, "Submission not found.");

    await assertCanManageCourse(user, submission.assignment.courseId);

    // A recheck changes the mark through its own decision, which settles the
    // fee — marking over it here would leave the fee hanging.
    if (submission.recheckOpen) {
        throw new AppError(status.CONFLICT, "A recheck is waiting on this hand-in. Decide the recheck instead.");
    }

    // A late submission is marked out of its window's marks, not the full total.
    const totalMarks = submission.assignment.totalMarks;
    const maxScore = submission.maxScore ?? totalMarks;

    // With a rubric, the mark is what its lines add up to — scaled to the late
    // window's marks when it came in late — and every line must be scored.
    const criteria = await prisma.rubricCriterion.findMany({ where: { assignmentId: submission.assignmentId }, select: { id: true, title: true, maxPoints: true } });
    if (criteria.length > 0 && payload.status === SubmissionStatus.ACCEPTED && !payload.rubric) {
        throw new AppError(status.BAD_REQUEST, "This assignment is marked with a rubric — score each line.");
    }
    if (payload.rubric) payload.score = scoreFromRubric(criteria, payload.rubric, maxScore, totalMarks);
    if (payload.score !== undefined && payload.score > maxScore) {
        throw new AppError(
            status.BAD_REQUEST,
            submission.maxScore !== null
                ? `This submission came in late, so it can score at most ${maxScore} of ${totalMarks} marks.`
                : `Score cannot exceed the assignment's total of ${totalMarks} marks.`,
        );
    }

    logger.update("Reviewing submission", { submissionId, status: payload.status });

    const reviewed = await prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
            status: payload.status,
            score: payload.score,
            feedback: payload.feedback,
            reviewedById: user.userId,
            reviewedAt: new Date(),
            ...(payload.rubric
                ? {
                    rubricScores: {
                        deleteMany: {},
                        create: payload.rubric.map((line) => ({ criterionId: line.criterionId, points: line.points, comment: line.comment || null })),
                    },
                }
                : {}),
        },
    });

    // A mark waits for the results: the student hears about it when they're
    // published (`publishResults`), all together. Work sent back can't wait.
    if (isResultHidden(payload.status, submission.assignment.resultsPublishedAt)) return reviewed;

    const final = finalScore(payload.score ?? null, submission.markAdjustment);
    const outcome =
        payload.status === SubmissionStatus.ACCEPTED
            ? `Accepted — your mark is ${final}/${totalMarks}${
                submission.markAdjustment !== 0 ? ` (${payload.score} from your mentor, ${submission.markAdjustment} for resubmitting and rechecks)` : ""
            }${submission.maxScore !== null ? `, marked out of ${submission.maxScore} because it came in late` : ""}.`
            : payload.status === SubmissionStatus.NEEDS_REVISION
                ? "Your mentor has asked for some changes."
                : "Your submission was not accepted.";

    await createNotification({
        userId: submission.studentId,
        title: `Assignment reviewed: ${submission.assignment.title}`,
        message: outcome,
        type: NotificationType.ASSIGNMENT,
        link: `/learn/${submission.assignment.course.slug}?assignment=${submission.assignmentId}`,
        senderId: user.userId,
        email: { actionLabel: "See the review" },
    });

    return reviewed;
};

/** An assignment's marking rubric, for its course's staff — and whether any hand-in has been marked with it. */
const getRubric = async (user: IRequestUser, assignmentId: string) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { courseId: true, totalMarks: true, rubric: rubricSelect },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");
    await assertCanManageCourse(user, assignment.courseId);
    const marked = await prisma.rubricScore.count({ where: { criterion: { assignmentId } } });
    return { totalMarks: assignment.totalMarks, criteria: assignment.rubric, marked: marked > 0 };
};

/**
 * Replaces an assignment's rubric with these lines, in this order. Their
 * points must add up to the assignment's marks, so a rubric mark is a mark
 * out of the total. Lines kept (by id) keep the scores given on them; lines
 * dropped take theirs with them. An empty list removes the rubric.
 */
const setRubric = async (
    user: IRequestUser,
    assignmentId: string,
    criteria: { id?: string; title: string; description?: string; maxPoints: number }[],
) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { courseId: true, totalMarks: true, rubric: { select: { id: true } } },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");
    await assertCanManageCourse(user, assignment.courseId);

    const sum = criteria.reduce((total, line) => total + line.maxPoints, 0);
    if (criteria.length > 0 && sum !== assignment.totalMarks) {
        throw new AppError(status.BAD_REQUEST, `The lines add up to ${sum}, but the assignment is out of ${assignment.totalMarks}. Make them match.`);
    }
    const existing = new Set(assignment.rubric.map((line) => line.id));
    const unknown = criteria.find((line) => line.id && !existing.has(line.id));
    if (unknown) throw new AppError(status.BAD_REQUEST, "One of those lines isn't on this assignment's rubric.");
    const kept = new Set(criteria.flatMap((line) => (line.id ? [line.id] : [])));

    await prisma.$transaction(async (tx) => {
        await tx.rubricCriterion.deleteMany({ where: { assignmentId, id: { notIn: [...kept] } } });
        for (const [index, line] of criteria.entries()) {
            const data = { title: line.title, description: line.description || null, maxPoints: line.maxPoints, order: index + 1 };
            if (line.id) await tx.rubricCriterion.update({ where: { id: line.id }, data });
            else await tx.rubricCriterion.create({ data: { ...data, assignmentId } });
        }
    });
    return getRubric(user, assignmentId);
};

/**
 * "I'm on it": puts a waiting hand-in in review under this reviewer's name, so
 * co-mentors see it's taken and the student can't swap the work underneath
 * them. One already in someone else's hands is refused unless `takeOver` —
 * for when a colleague started and never finished.
 */
const claimSubmission = async (user: IRequestUser, submissionId: string, takeOver = false) => {
    const submission = await prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
        select: {
            id: true, status: true, studentId: true, assignmentId: true, reviewedById: true,
            reviewedBy: { select: { name: true } },
            assignment: { select: { title: true, courseId: true, course: { select: { slug: true } } } },
        },
    });
    if (!submission) throw new AppError(status.NOT_FOUND, "Submission not found.");
    await assertCanManageCourse(user, submission.assignment.courseId);

    const claimable: SubmissionStatus[] = [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW];
    if (!claimable.includes(submission.status)) {
        throw new AppError(status.CONFLICT, "This hand-in has already been marked.");
    }
    const busyWith = (name: string | undefined) => new AppError(status.CONFLICT, `${name ?? "Someone"} is already reviewing this.`);
    const mine = submission.status === SubmissionStatus.UNDER_REVIEW && submission.reviewedById === user.userId;
    if (submission.status === SubmissionStatus.UNDER_REVIEW && !mine && !takeOver) throw busyWith(submission.reviewedBy?.name);

    if (!mine) {
        // Conditional on what was read, so two reviewers clicking at once can't both win.
        const claimed = await prisma.assignmentSubmission.updateMany({
            where: { id: submissionId, status: submission.status, reviewedById: submission.reviewedById },
            data: { status: SubmissionStatus.UNDER_REVIEW, reviewedById: user.userId },
        });
        if (claimed.count === 0) {
            const now = await prisma.assignmentSubmission.findUnique({
                where: { id: submissionId },
                select: { status: true, reviewedBy: { select: { name: true } } },
            });
            if (now?.status === SubmissionStatus.UNDER_REVIEW) throw busyWith(now.reviewedBy?.name);
            throw new AppError(status.CONFLICT, "This hand-in has already been marked.");
        }
    }

    // The student hears once, when review starts — not when it changes hands.
    if (!mine && submission.status === SubmissionStatus.SUBMITTED) {
        await createNotification({
            userId: submission.studentId,
            title: `In review: ${submission.assignment.title}`,
            message: "A mentor has started reviewing your hand-in. You'll hear back here when it's marked.",
            type: NotificationType.ASSIGNMENT,
            link: `/learn/${submission.assignment.course.slug}?assignment=${submission.assignmentId}`,
            senderId: user.userId,
        });
    }

    return prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
        select: { id: true, status: true, reviewedById: true, reviewedBy: { select: { id: true, name: true } }, updatedAt: true },
    });
};

/** Puts a hand-in this reviewer took back in line, unmarked. An admin can release anyone's. */
const releaseSubmission = async (user: IRequestUser, submissionId: string) => {
    const submission = await prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
        select: { id: true, status: true, reviewedById: true, reviewedBy: { select: { name: true } }, assignment: { select: { courseId: true } } },
    });
    if (!submission) throw new AppError(status.NOT_FOUND, "Submission not found.");
    await assertCanManageCourse(user, submission.assignment.courseId);

    if (submission.status !== SubmissionStatus.UNDER_REVIEW) {
        throw new AppError(status.CONFLICT, "This hand-in isn't in review.");
    }
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (submission.reviewedById !== user.userId && !isAdmin) {
        throw new AppError(status.FORBIDDEN, `Only ${submission.reviewedBy?.name ?? "the reviewer"} can put this back — or take it over yourself.`);
    }

    await prisma.assignmentSubmission.updateMany({
        where: { id: submissionId, status: SubmissionStatus.UNDER_REVIEW, reviewedById: submission.reviewedById },
        data: { status: SubmissionStatus.SUBMITTED, reviewedById: null },
    });
    return { id: submissionId, status: SubmissionStatus.SUBMITTED };
};

// ---------------------------------------------------------------------------
// Results and rechecks
// ---------------------------------------------------------------------------

/**
 * Publishes an assignment's results: every marked hand-in's score and
 * feedback reach its student at once, resubmitting closes, and rechecks open.
 * One way — never undone. Hand-ins not marked yet show as soon as they are.
 */
const publishResults = async (user: IRequestUser, assignmentId: string) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, title: true, courseId: true, resultsPublishedAt: true, course: { select: { slug: true, title: true } } },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");
    await assertCanManageCourse(user, assignment.courseId);

    const now = new Date();
    // Conditional, so two staff publishing at once notify the class once.
    const published = await prisma.assignment.updateMany({
        where: { id: assignmentId, resultsPublishedAt: null },
        data: { resultsPublishedAt: now },
    });
    if (published.count === 0) throw new AppError(status.CONFLICT, "These results are already published.");
    logger.update("Assignment results published", { assignmentId });

    const [marked, waiting] = await Promise.all([
        prisma.assignmentSubmission.findMany({
            where: { assignmentId, status: SubmissionStatus.ACCEPTED },
            select: { studentId: true },
        }),
        prisma.assignmentSubmission.count({
            where: { assignmentId, status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW] } },
        }),
    ]);

    await createNotificationsFor(
        marked.map((row) => row.studentId),
        {
            title: `Results are out: ${assignment.title}`,
            message: `Your mark and feedback for "${assignment.title}" in ${assignment.course.title} are ready.`,
            type: NotificationType.ASSIGNMENT,
            link: `/learn/${assignment.course.slug}?assignment=${assignment.id}`,
            email: { actionLabel: "See your result" },
        },
    );

    return { resultsPublishedAt: now, notified: marked.length, waiting };
};

/**
 * A student asks for their published mark to be looked at again. The fee
 * comes off their final mark at once, in the same transaction that opens the
 * recheck — guarded on there being none open, so a double click can't open
 * two or charge twice.
 */
const requestRecheck = async (user: IRequestUser, assignmentId: string, payload: { reason: string }) => {
    const assignment = await prisma.assignment.findFirst({
        where: { id: assignmentId, isPublished: true },
        select: { id: true, title: true, courseId: true, resultsPublishedAt: true, course: { select: { title: true } } },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");
    await requireEnrollment(user, assignment.courseId);

    if (!assignment.resultsPublishedAt) {
        throw new AppError(status.CONFLICT, "You can ask for a recheck once the results are published.");
    }
    const submission = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: user.userId } },
        select: { id: true, status: true, score: true, recheckOpen: true },
    });
    if (!submission || submission.status !== SubmissionStatus.ACCEPTED || submission.score === null) {
        throw new AppError(status.CONFLICT, "Only a marked hand-in can be rechecked.");
    }
    const alreadyOpen = new AppError(status.CONFLICT, "A recheck is already in progress for this assignment.");
    if (submission.recheckOpen) throw alreadyOpen;

    const fee = ASSIGNMENT_PENALTIES.recheckFeeMarks;
    const recheck = await prisma.$transaction(async (tx) => {
        const opened = await tx.assignmentSubmission.updateMany({
            where: { id: submission.id, recheckOpen: false, status: SubmissionStatus.ACCEPTED, score: { not: null } },
            data: { recheckOpen: true, markAdjustment: { decrement: fee } },
        });
        if (opened.count === 0) throw alreadyOpen;
        // The mark as it stands now, read under the guard.
        const { score } = await tx.assignmentSubmission.findUniqueOrThrow({ where: { id: submission.id }, select: { score: true } });

        const created = await tx.assignmentRecheck.create({
            data: {
                submissionId: submission.id,
                assignmentId,
                studentId: user.userId,
                reason: payload.reason,
                scoreBefore: score ?? 0,
            },
        });
        await tx.submissionMarkAdjustment.create({
            data: {
                submissionId: submission.id,
                kind: MarkAdjustmentKind.RECHECK_FEE,
                marks: -fee,
                refId: created.id,
                note: "Recheck requested",
            },
        });
        return created;
    });
    logger.create("Recheck requested", { assignmentId, studentId: user.userId, recheckId: recheck.id });

    const student = user.name ? { name: user.name } : await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
    await notifyCourseMentors(
        assignment.courseId,
        {
            title: `Recheck requested: ${assignment.title}`,
            message: `${student?.name ?? "A student"} asked for their mark to be looked at again · ${assignment.course.title}`,
            type: NotificationType.ASSIGNMENT,
            link: `/mentor/reviews?course=${assignment.courseId}&assignment=${assignment.id}&recheck=open&focus=${submission.id}`,
        },
        { except: user.userId },
    );

    return recheck;
};

/**
 * Staff decide a recheck. VALID: the mark goes up — to more than it was, at
 * most the hand-in's cap — and the fee comes back. INVALID: the mark stands
 * and a further penalty is taken (so the recheck cost fee + penalty in all).
 * Decided once: the status guard makes a second decision a no-op error.
 */
const decideRecheck = async (
    user: IRequestUser,
    recheckId: string,
    payload: { outcome: "VALID" | "INVALID"; score?: number; rubric?: RubricInput; note?: string },
) => {
    const recheck = await prisma.assignmentRecheck.findUnique({
        where: { id: recheckId },
        include: {
            submission: { select: { id: true, studentId: true, maxScore: true, markAdjustment: true, assignmentId: true } },
            assignment: {
                select: { id: true, title: true, courseId: true, totalMarks: true, course: { select: { slug: true, title: true } } },
            },
        },
    });
    if (!recheck) throw new AppError(status.NOT_FOUND, "Recheck not found.");
    await assertCanManageCourse(user, recheck.assignment.courseId);

    const alreadyDecided = new AppError(status.CONFLICT, "This recheck has already been decided.");
    if (recheck.status !== RecheckStatus.PENDING) throw alreadyDecided;

    const totalMarks = recheck.assignment.totalMarks;
    const maxScore = recheck.submission.maxScore ?? totalMarks;
    const note = payload.note?.trim() || null;
    let newScore = recheck.scoreBefore;

    if (payload.outcome === "VALID") {
        const criteria = await prisma.rubricCriterion.findMany({
            where: { assignmentId: recheck.assignmentId },
            select: { id: true, title: true, maxPoints: true },
        });
        if (criteria.length > 0 && !payload.rubric) {
            throw new AppError(status.BAD_REQUEST, "This assignment is marked with a rubric — score each line again.");
        }
        if (payload.rubric) newScore = scoreFromRubric(criteria, payload.rubric, maxScore, totalMarks);
        else if (payload.score === undefined) throw new AppError(status.BAD_REQUEST, "Give the new mark.");
        else newScore = payload.score;

        if (newScore <= recheck.scoreBefore) {
            throw new AppError(
                status.BAD_REQUEST,
                `A valid recheck raises the mark above ${recheck.scoreBefore}. If the mark was right, decide it as not valid.`,
            );
        }
        if (newScore > maxScore) {
            throw new AppError(status.BAD_REQUEST, `The mark can be at most ${maxScore}${maxScore !== totalMarks ? " (it came in late)" : ""}.`);
        }
    } else if (!note) {
        throw new AppError(status.BAD_REQUEST, "Say why the mark stands — the student will read it.");
    }

    const { recheckFeeMarks: fee, recheckInvalidMarks: extra } = ASSIGNMENT_PENALTIES;
    const valid = payload.outcome === "VALID";

    await prisma.$transaction(async (tx) => {
        const decided = await tx.assignmentRecheck.updateMany({
            where: { id: recheckId, status: RecheckStatus.PENDING },
            data: {
                status: valid ? RecheckStatus.VALID : RecheckStatus.INVALID,
                scoreAfter: newScore,
                reviewerNote: note,
                reviewedById: user.userId,
                reviewedAt: new Date(),
            },
        });
        if (decided.count === 0) throw alreadyDecided;

        await tx.submissionMarkAdjustment.create({
            data: {
                submissionId: recheck.submissionId,
                kind: valid ? MarkAdjustmentKind.RECHECK_REFUND : MarkAdjustmentKind.RECHECK_PENALTY,
                marks: valid ? fee : -extra,
                refId: recheckId,
                note: valid ? "Recheck fee refunded" : "Recheck: the mark stood",
            },
        });
        await tx.assignmentSubmission.update({
            where: { id: recheck.submissionId },
            data: {
                recheckOpen: false,
                markAdjustment: valid ? { increment: fee } : { decrement: extra },
                ...(valid ? { score: newScore } : {}),
                ...(valid && payload.rubric
                    ? {
                        rubricScores: {
                            deleteMany: {},
                            create: payload.rubric.map((line) => ({ criterionId: line.criterionId, points: line.points, comment: line.comment || null })),
                        },
                    }
                    : {}),
            },
        });
    });
    logger.update("Recheck decided", { recheckId, outcome: payload.outcome });

    const adjustment = recheck.submission.markAdjustment + (valid ? fee : -extra);
    const final = finalScore(newScore, adjustment);
    await createNotification({
        userId: recheck.submission.studentId,
        title: `Recheck ${valid ? "done — mark raised" : "done — mark unchanged"}: ${recheck.assignment.title}`,
        message: valid
            ? `Your mark went from ${recheck.scoreBefore} to ${newScore}, and the ${fee}-mark recheck fee was refunded. Your mark is now ${final}/${totalMarks}.`
            : `Your mentor checked again and the mark stands. ${extra} more marks were taken (${fee + extra} for this recheck in all). Your mark is now ${final}/${totalMarks}.`,
        type: NotificationType.ASSIGNMENT,
        link: `/learn/${recheck.assignment.course.slug}?assignment=${recheck.assignmentId}`,
        senderId: user.userId,
        email: { actionLabel: "See the result" },
    });

    return prisma.assignmentRecheck.findUnique({ where: { id: recheckId } });
};

const getSubmissionById = async (user: IRequestUser, submissionId: string) => {
    const submission = await prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
        include: {
            student: { select: { id: true, name: true, email: true, image: true } },
            reviewedBy: { select: { id: true, name: true, image: true } },
            assignment: {
                include: {
                    course: { select: { id: true, title: true, slug: true } },
                    milestone: { select: { id: true, title: true, order: true } },
                },
            },
        },
    });
    if (!submission) throw new AppError(status.NOT_FOUND, "Submission not found.");

    // A student may read their own — without a mark still waiting for its
    // results; staff need management rights on the course.
    if (submission.studentId === user.userId) return forStudent(submission, submission.assignment.resultsPublishedAt);

    await assertCanManageCourse(user, submission.assignment.courseId);
    // …and a mentor sees whose it is by name only.
    if (!seesStudentDetails(user)) return { ...submission, student: nameOnly(submission.student) };

    return submission;
};

export const AssignmentService = {
    getRubric,
    setRubric,
    claimSubmission,
    releaseSubmission,
    uploadSubmissionFiles,
    getReviewQueueCounts,
    createAssignment,
    updateAssignment,
    publishDueAssignments,
    reorderAssignments,
    deleteAssignment,
    getAssignmentForStudent,
    submitAssignment,
    getMySubmissions,
    getReviewQueue,
    reviewSubmission,
    getSubmissionById,
    publishResults,
    requestRecheck,
    decideRecheck,
};
