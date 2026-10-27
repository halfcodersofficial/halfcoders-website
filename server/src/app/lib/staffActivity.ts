import { NextFunction, Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client";
import { logger } from "../utils/logger";
import { prisma } from "./prisma";

/**
 * Staff activity history (`StaffActivity`): what each mentor or admin changed,
 * read by the admin's mentor detail page.
 *
 * Every change route a mentor can reach names its entry in the catalogue
 * below, right after its auth check:
 *
 *     router.patch("/:videoId", checkAuth(...STAFF), trackActivity("video.update"), …)
 *
 * The middleware looks up what the route is about *before* the handler runs,
 * so a delete still knows the title and course of what it removed, and
 * records one row once a successful response has gone out. Recording never
 * delays or fails the request itself.
 */

type Subject =
    | "course"
    | "week"
    | "module"
    | "lesson"
    | "quiz"
    | "question"
    | "assignment"
    | "material"
    | "practice"
    | "outlineWeek"
    | "outlineItem"
    | "supportSession"
    | "queueEntry"
    | "submission"
    | "conceptualTopic"
    | "conceptualSession"
    | "announcement"
    | "liveClass";

/** What a lookup finds: enough to name the thing and file it under a course. */
interface Found {
    title: string | null;
    courseId: string | null;
    /** The student a submission or queue entry belongs to. */
    student?: string | null;
}

const titleAndCourse = { title: true, courseId: true } as const;

const lookups: Record<Subject, (id: string) => Promise<Found | null>> = {
    course: async (id) => {
        const row = await prisma.course.findUnique({ where: { id }, select: { id: true, title: true } });
        return row && { title: row.title, courseId: row.id };
    },
    week: (id) => prisma.milestone.findUnique({ where: { id }, select: titleAndCourse }),
    module: (id) => prisma.courseModule.findUnique({ where: { id }, select: titleAndCourse }),
    lesson: (id) => prisma.video.findUnique({ where: { id }, select: titleAndCourse }),
    quiz: (id) => prisma.quiz.findUnique({ where: { id }, select: titleAndCourse }),
    question: async (id) => {
        const row = await prisma.quizQuestion.findUnique({ where: { id }, select: { quiz: { select: titleAndCourse } } });
        return row?.quiz ?? null;
    },
    assignment: (id) => prisma.assignment.findUnique({ where: { id }, select: titleAndCourse }),
    material: (id) => prisma.assignmentMaterial.findUnique({ where: { id }, select: titleAndCourse }),
    practice: (id) => prisma.practiceDay.findUnique({ where: { id }, select: titleAndCourse }),
    outlineWeek: (id) => prisma.outlineWeek.findUnique({ where: { id }, select: titleAndCourse }),
    outlineItem: (id) => prisma.outlineItem.findUnique({ where: { id }, select: titleAndCourse }),
    supportSession: (id) => prisma.supportSession.findUnique({ where: { id }, select: titleAndCourse }),
    queueEntry: async (id) => {
        const row = await prisma.supportQueue.findUnique({
            where: { id },
            select: { student: { select: { name: true } }, session: { select: titleAndCourse } },
        });
        return row && { ...row.session, student: row.student.name };
    },
    submission: async (id) => {
        const row = await prisma.assignmentSubmission.findUnique({
            where: { id },
            select: { student: { select: { name: true } }, assignment: { select: titleAndCourse } },
        });
        return row && { ...row.assignment, student: row.student.name };
    },
    conceptualTopic: (id) => prisma.conceptualTopic.findUnique({ where: { id }, select: titleAndCourse }),
    conceptualSession: (id) => prisma.conceptualSession.findUnique({ where: { id }, select: titleAndCourse }),
    announcement: (id) => prisma.courseAnnouncement.findUnique({ where: { id }, select: titleAndCourse }),
    liveClass: (id) => prisma.liveClass.findUnique({ where: { id }, select: titleAndCourse }),
};

interface SummaryContext {
    /** The looked-up subject (see `about`). */
    about: Found | null;
    /** The response's `data` when it is a single record — the created or updated row. */
    result: Record<string, unknown> | null;
    body: Record<string, unknown>;
}

interface ActivityDef {
    /** What the row is about, for the history's icons and filters. */
    entity: Subject;
    /** A new record: its id comes from the response. */
    creates?: boolean;
    /** Looked up before the handler: from a route param, or a body field (the first id of a list). */
    about?: { subject: Subject; param?: string; body?: string };
    summary: (context: SummaryContext) => string;
    /** Record which fields a change touched (their names, never values). */
    fields?: boolean;
    detail?: (body: Record<string, unknown>) => Prisma.InputJsonObject;
}

/** `“Title”`, shortened, or the fallback when there's no title. */
const quote = (title: unknown, fallback: string) =>
    typeof title === "string" && title.trim()
        ? `“${title.length > 120 ? `${title.slice(0, 117)}…` : title}”`
        : fallback;

/** `Edited lesson “Pointers”`, or just `Edited lesson` when it has no title. */
const phrase = (words: string, title: unknown) => {
    const name = quote(title, "");
    return name ? `${words} ${name}` : words;
};

const named = ({ result, about }: SummaryContext) => result?.title ?? about?.title;

const count = (list: unknown) => (Array.isArray(list) ? list.length : 0);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const CATALOGUE = {
    // ---- Course page and files
    "course.content.update": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Edited the course page of ${quote(c.about?.title, "a course")}`,
        fields: true,
    },
    "course.curriculumPdf.upload": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Uploaded the curriculum PDF of ${quote(c.about?.title, "a course")}`,
    },
    "course.curriculumPdf.remove": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Removed the curriculum PDF of ${quote(c.about?.title, "a course")}`,
    },
    "course.image.upload": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Uploaded an image to ${quote(c.about?.title, "a course")}`,
    },

    // ---- Weeks (milestones)
    "week.create": { entity: "week", creates: true, summary: (c) => phrase("Added week", named(c)) },
    "week.update": {
        entity: "week",
        about: { subject: "week", param: "milestoneId" },
        summary: (c) => phrase("Edited week", named(c)),
        fields: true,
    },
    "week.delete": {
        entity: "week",
        about: { subject: "week", param: "milestoneId" },
        summary: (c) => phrase("Deleted week", c.about?.title),
    },
    "week.reorder": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Reordered the weeks of ${quote(c.about?.title, "a course")}`,
    },
    "week.items.reorder": {
        entity: "week",
        about: { subject: "week", param: "milestoneId" },
        summary: (c) => phrase("Reordered the items in week", c.about?.title),
    },

    // ---- Modules
    "module.create": { entity: "module", creates: true, summary: (c) => phrase("Added module", named(c)) },
    "module.update": {
        entity: "module",
        about: { subject: "module", param: "moduleId" },
        summary: (c) => phrase("Edited module", named(c)),
        fields: true,
    },
    "module.delete": {
        entity: "module",
        about: { subject: "module", param: "moduleId" },
        summary: (c) => phrase("Deleted module", c.about?.title),
    },
    "module.reorder": {
        entity: "week",
        about: { subject: "week", param: "milestoneId" },
        summary: (c) => phrase("Reordered the modules in week", c.about?.title),
    },

    // ---- Lessons (videos, text, resources)
    "lesson.create": { entity: "lesson", creates: true, summary: (c) => phrase("Added lesson", named(c)) },
    "lesson.bulkCreate": {
        entity: "module",
        about: { subject: "module", body: "moduleId" },
        summary: (c) => `Added ${plural(count(c.body.videos), "lesson", "lessons")} to ${quote(c.about?.title, "a module")}`,
        detail: (body) => ({ count: count(body.videos), published: body.isPublished === true }),
    },
    "lesson.bulkPublish": {
        entity: "lesson",
        about: { subject: "lesson", body: "videoIds" },
        summary: (c) =>
            `${c.body.isPublished ? "Published" : "Unpublished"} ${plural(count(c.body.videoIds), "lesson", "lessons")}`,
        detail: (body) => ({ count: count(body.videoIds), published: body.isPublished === true }),
    },
    "lesson.update": {
        entity: "lesson",
        about: { subject: "lesson", param: "videoId" },
        summary: (c) => phrase("Edited lesson", named(c)),
        fields: true,
    },
    "lesson.delete": {
        entity: "lesson",
        about: { subject: "lesson", param: "videoId" },
        summary: (c) => phrase("Deleted lesson", c.about?.title),
    },
    "lesson.reorder": {
        entity: "module",
        about: { subject: "module", param: "moduleId" },
        summary: (c) => `Reordered the lessons in ${quote(c.about?.title, "a module")}`,
    },

    // ---- Quizzes
    "quiz.create": { entity: "quiz", creates: true, summary: (c) => phrase("Added quiz", named(c)) },
    "quiz.update": {
        entity: "quiz",
        about: { subject: "quiz", param: "quizId" },
        summary: (c) => phrase("Edited quiz", named(c)),
        fields: true,
    },
    "quiz.delete": {
        entity: "quiz",
        about: { subject: "quiz", param: "quizId" },
        summary: (c) => phrase("Deleted quiz", c.about?.title),
    },
    "question.create": {
        entity: "question",
        creates: true,
        about: { subject: "quiz", param: "quizId" },
        summary: (c) => `Added a question to ${quote(c.about?.title, "a quiz")}`,
    },
    "question.reorder": {
        entity: "quiz",
        about: { subject: "quiz", param: "quizId" },
        summary: (c) => `Reordered the questions of ${quote(c.about?.title, "a quiz")}`,
    },
    "question.update": {
        entity: "question",
        about: { subject: "question", param: "questionId" },
        summary: (c) => `Edited a question in ${quote(c.about?.title, "a quiz")}`,
        fields: true,
    },
    "question.delete": {
        entity: "question",
        about: { subject: "question", param: "questionId" },
        summary: (c) => `Deleted a question from ${quote(c.about?.title, "a quiz")}`,
    },

    // ---- Assignments and their materials
    "assignment.create": {
        entity: "assignment",
        creates: true,
        summary: (c) => phrase("Added assignment", named(c)),
    },
    "assignment.update": {
        entity: "assignment",
        about: { subject: "assignment", param: "assignmentId" },
        summary: (c) => phrase("Edited assignment", named(c)),
        fields: true,
    },
    "assignment.delete": {
        entity: "assignment",
        about: { subject: "assignment", param: "assignmentId" },
        summary: (c) => phrase("Deleted assignment", c.about?.title),
    },
    "assignment.reorder": {
        entity: "week",
        about: { subject: "week", param: "milestoneId" },
        summary: (c) => phrase("Reordered the assignments in week", c.about?.title),
    },
    "submission.review": {
        entity: "submission",
        about: { subject: "submission", param: "submissionId" },
        summary: (c) =>
            `Reviewed ${c.about?.student ? `${c.about.student}'s` : "a"} submission to ${quote(c.about?.title, "an assignment")}`,
        detail: (body) => ({
            status: String(body.status ?? ""),
            ...(typeof body.score === "number" ? { score: body.score } : {}),
        }),
    },
    "submission.claim": {
        entity: "submission",
        about: { subject: "submission", param: "submissionId" },
        summary: (c) =>
            `Started reviewing ${c.about?.student ? `${c.about.student}'s` : "a"} submission to ${quote(c.about?.title, "an assignment")}`,
        detail: (body) => (body.takeOver === true ? { takeOver: true } : {}),
    },
    "material.create": {
        entity: "material",
        creates: true,
        summary: (c) => phrase("Added material", named(c)),
    },
    "material.update": {
        entity: "material",
        about: { subject: "material", param: "materialId" },
        summary: (c) => phrase("Edited material", named(c)),
        fields: true,
    },
    "material.delete": {
        entity: "material",
        about: { subject: "material", param: "materialId" },
        summary: (c) => phrase("Deleted material", c.about?.title),
    },
    "material.reorder": {
        entity: "assignment",
        about: { subject: "assignment", param: "assignmentId" },
        summary: (c) => `Reordered the materials of ${quote(c.about?.title, "an assignment")}`,
    },

    // ---- Practice days
    "practice.create": {
        entity: "practice",
        creates: true,
        summary: (c) => phrase("Added practice day", named(c)),
    },
    "practice.update": {
        entity: "practice",
        about: { subject: "practice", param: "practiceDayId" },
        summary: (c) => phrase("Edited practice day", named(c)),
        fields: true,
    },
    "practice.delete": {
        entity: "practice",
        about: { subject: "practice", param: "practiceDayId" },
        summary: (c) => phrase("Deleted practice day", c.about?.title),
    },

    // ---- Course outline
    "outline.copyFromModules": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Built the outline of ${quote(c.about?.title, "a course")} from its modules`,
    },
    "outline.publishAll": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Published the outline of ${quote(c.about?.title, "a course")}`,
    },
    "outline.weeks.reorder": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Reordered the outline weeks of ${quote(c.about?.title, "a course")}`,
    },
    "outline.week.create": {
        entity: "outlineWeek",
        creates: true,
        summary: (c) => phrase("Added outline week", named(c)),
    },
    "outline.week.update": {
        entity: "outlineWeek",
        about: { subject: "outlineWeek", param: "weekId" },
        summary: (c) => phrase("Edited outline week", named(c)),
        fields: true,
    },
    "outline.week.delete": {
        entity: "outlineWeek",
        about: { subject: "outlineWeek", param: "weekId" },
        summary: (c) => phrase("Deleted outline week", c.about?.title),
    },
    "outline.items.reorder": {
        entity: "outlineWeek",
        about: { subject: "outlineWeek", param: "weekId" },
        summary: (c) => phrase("Reordered the items in outline week", c.about?.title),
    },
    "outline.item.create": {
        entity: "outlineItem",
        creates: true,
        summary: (c) => phrase("Added outline item", named(c)),
    },
    "outline.item.update": {
        entity: "outlineItem",
        about: { subject: "outlineItem", param: "itemId" },
        summary: (c) => phrase("Edited outline item", named(c)),
        fields: true,
    },
    "outline.item.delete": {
        entity: "outlineItem",
        about: { subject: "outlineItem", param: "itemId" },
        summary: (c) => phrase("Deleted outline item", c.about?.title),
    },

    // ---- Support sessions
    "support.create": {
        entity: "supportSession",
        creates: true,
        summary: (c) => phrase("Scheduled support session", named(c)),
    },
    "support.update": {
        entity: "supportSession",
        about: { subject: "supportSession", param: "sessionId" },
        summary: (c) => phrase("Edited support session", named(c)),
        fields: true,
    },
    "support.status": {
        entity: "supportSession",
        about: { subject: "supportSession", param: "sessionId" },
        summary: (c) => `${phrase("Set support session", c.about?.title)} to ${String(c.body.status ?? "").toLowerCase()}`,
        detail: (body) => ({ status: String(body.status ?? "") }),
    },
    "support.delete": {
        entity: "supportSession",
        about: { subject: "supportSession", param: "sessionId" },
        summary: (c) => phrase("Deleted support session", c.about?.title),
    },
    "support.serveNext": {
        entity: "supportSession",
        about: { subject: "supportSession", param: "sessionId" },
        summary: (c) => `Called the next student in ${quote(c.about?.title, "a support session")}`,
    },
    "support.complete": {
        entity: "supportSession",
        about: { subject: "supportSession", param: "sessionId" },
        summary: (c) => `Finished helping a student in ${quote(c.about?.title, "a support session")}`,
    },
    "support.skip": {
        entity: "queueEntry",
        about: { subject: "queueEntry", param: "queueId" },
        summary: (c) =>
            `Skipped ${c.about?.student ?? "a student"} in ${quote(c.about?.title, "a support session")}`,
    },

    // ---- Conceptual sessions (recorded live classes, by topic)
    "conceptual.topic.create": {
        entity: "conceptualTopic",
        creates: true,
        summary: (c) => phrase("Added conceptual session topic", named(c)),
    },
    "conceptual.topic.update": {
        entity: "conceptualTopic",
        about: { subject: "conceptualTopic", param: "topicId" },
        summary: (c) => phrase("Edited conceptual session topic", named(c)),
        fields: true,
    },
    "conceptual.topic.delete": {
        entity: "conceptualTopic",
        about: { subject: "conceptualTopic", param: "topicId" },
        summary: (c) => phrase("Deleted conceptual session topic", c.about?.title),
    },
    "conceptual.topic.reorder": {
        entity: "course",
        about: { subject: "course", param: "courseId" },
        summary: (c) => `Reordered the conceptual session topics of ${quote(c.about?.title, "a course")}`,
    },
    "conceptual.session.create": {
        entity: "conceptualSession",
        creates: true,
        summary: (c) => phrase("Added conceptual session recording", named(c)),
    },
    "conceptual.session.update": {
        entity: "conceptualSession",
        about: { subject: "conceptualSession", param: "sessionId" },
        summary: (c) => phrase("Edited conceptual session recording", named(c)),
        fields: true,
    },
    "conceptual.session.delete": {
        entity: "conceptualSession",
        about: { subject: "conceptualSession", param: "sessionId" },
        summary: (c) => phrase("Deleted conceptual session recording", c.about?.title),
    },
    "conceptual.session.reorder": {
        entity: "conceptualTopic",
        about: { subject: "conceptualTopic", param: "topicId" },
        summary: (c) => phrase("Reordered the recordings in conceptual session topic", c.about?.title),
    },
    "assignment.rubric": {
        entity: "assignment",
        about: { subject: "assignment", param: "assignmentId" },
        summary: (c) => {
            const lines = count(c.body.criteria);
            return lines ? `Set a ${lines}-line marking rubric on ${quote(c.about?.title, "an assignment")}` : `Removed the marking rubric from ${quote(c.about?.title, "an assignment")}`;
        },
    },
    "announcement.create": {
        entity: "announcement",
        creates: true,
        about: { subject: "course", param: "courseId" },
        summary: (c) => phrase("Posted an announcement", named(c)),
    },
    "announcement.update": {
        entity: "announcement",
        about: { subject: "announcement", param: "announcementId" },
        summary: (c) => phrase("Edited the announcement", c.about?.title),
        fields: true,
    },
    "announcement.delete": {
        entity: "announcement",
        about: { subject: "announcement", param: "announcementId" },
        summary: (c) => phrase("Deleted the announcement", c.about?.title),
    },
    "liveClass.create": {
        entity: "liveClass",
        creates: true,
        about: { subject: "course", param: "courseId" },
        summary: (c) => phrase("Scheduled the live class", named(c)),
    },
    "liveClass.update": {
        entity: "liveClass",
        about: { subject: "liveClass", param: "liveClassId" },
        summary: (c) => phrase("Edited the live class", c.about?.title),
        fields: true,
    },
    "liveClass.cancel": {
        entity: "liveClass",
        about: { subject: "liveClass", param: "liveClassId" },
        summary: (c) => phrase("Cancelled the live class", c.about?.title),
    },
    "liveClass.delete": {
        entity: "liveClass",
        about: { subject: "liveClass", param: "liveClassId" },
        summary: (c) => phrase("Removed the live class", c.about?.title),
    },
} satisfies Record<string, ActivityDef>;

export type ActivityAction = keyof typeof CATALOGUE;

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const stringOrNull = (value: unknown) => (typeof value === "string" && value ? value : null);

/** A route param, or a body field — the first id when it's a list. */
const aboutId = (def: ActivityDef, req: Request): string | null => {
    if (!def.about) return null;
    if (def.about.param) return stringOrNull(req.params[def.about.param]);
    const value = def.about.body ? (req.body as Record<string, unknown> | undefined)?.[def.about.body] : undefined;
    return stringOrNull(Array.isArray(value) ? value[0] : value);
};

/** Field names only, minus bookkeeping — the values are never stored. */
const changedFields = (body: Record<string, unknown>) =>
    Object.keys(body).filter((key) => !["id", "courseId", "moduleId", "milestoneId"].includes(key));

/**
 * Records the request as `action` in the staff activity history once it
 * succeeds. Place it right after the route's `checkAuth`.
 */
export const trackActivity = (action: ActivityAction) => {
    const def: ActivityDef = CATALOGUE[action];

    return async (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user) return next();

        // Before the handler: a delete takes its title and course with it.
        const id = aboutId(def, req);
        let about: Found | null = null;
        if (def.about && id) {
            try {
                about = await lookups[def.about.subject](id);
            } catch {
                // The history loses a title; the request carries on.
            }
        }

        let responseBody: unknown;
        const json = res.json.bind(res);
        res.json = (body: unknown) => {
            responseBody = body;
            return json(body);
        };

        // Runs after the response is sent, outside Express's error handling —
        // anything thrown here would take the process down, so nothing may.
        const record = () => {
            if (res.statusCode >= 400) return;

            const body = asRecord(req.body) ?? {};
            const result = asRecord(asRecord(responseBody)?.data);
            const courseId =
                about?.courseId ??
                stringOrNull(result?.courseId) ??
                stringOrNull(req.params.courseId) ??
                stringOrNull(body.courseId);

            const detail: Prisma.InputJsonObject = {
                ...(def.fields ? { fields: changedFields(body) } : {}),
                ...(def.detail?.(body) ?? {}),
            };

            prisma.staffActivity
                .create({
                    data: {
                        actorId: user.userId,
                        action,
                        summary: def.summary({ about, result, body }),
                        courseId,
                        entityType: def.entity,
                        entityId: def.creates ? stringOrNull(result?.id) : id,
                        ...(Object.keys(detail).length > 0 ? { detail } : {}),
                        // An IPv4 client shows as "::ffff:1.2.3.4" on a dual-stack socket.
                        ipAddress: req.ip?.replace(/^::ffff:/, "") ?? null,
                        userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
                    },
                })
                .catch((error) => logger.error("Failed to record staff activity", { action, error }));
        };

        res.on("finish", () => {
            try {
                record();
            } catch (error) {
                logger.error("Failed to record staff activity", { action, error });
            }
        });

        next();
    };
};
