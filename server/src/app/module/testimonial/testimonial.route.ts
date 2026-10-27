import { Router } from "express";
import status from "http-status";
import z from "zod";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { Role } from "../../lib/roles";
import { prisma } from "../../lib/prisma";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { requireYoutubeVideoId } from "../../utils/youtube";

const router = Router();
const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

/** An optional field the editor can also clear: `null` or "" removes it, leaving it out keeps it. */
const clearable = <T extends z.ZodTypeAny>(field: T) =>
    z.preprocess((value) => (value === "" ? null : value), field.nullable().optional());

const testimonialZodSchema = z.object({
    name: z.string().trim().min(2).max(80),
    designation: clearable(z.string().trim().max(120)),
    // Checked and put in one shape by `toData` — the course page's player
    // reads the video id back out of it.
    videoUrl: clearable(z.string().trim().max(500)),
    quote: z.string().trim().min(10, "A testimonial needs at least a sentence").max(1000),
    rating: z.number().int().min(1).max(5).optional(),
    courseId: clearable(z.string().trim().min(1)),
    /** The student who said it. Their account photo becomes the testimonial's. */
    studentId: clearable(z.string().trim().min(1)),
    isPublished: z.boolean().optional(),
    order: z.number().int().min(0).max(1000).optional(),
});

type TestimonialInput = Partial<z.infer<typeof testimonialZodSchema>>;

const reorderZodSchema = z.object({
    ids: z.array(z.string().trim().min(1)).min(1).max(1000),
});

/**
 * The body as the database takes it. A YouTube link is stored as one
 * canonical watch URL, so every shape an admin pastes — youtu.be, /shorts,
 * a bare id — plays on the course page. Linking a student snapshots their
 * photo (as `name` is snapshotted); unlinking clears it.
 */
const toData = async (body: TestimonialInput): Promise<Prisma.TestimonialUncheckedUpdateInput> => {
    const data: Prisma.TestimonialUncheckedUpdateInput = { ...body };

    if (body.videoUrl !== undefined) {
        data.videoUrl = body.videoUrl ? `https://www.youtube.com/watch?v=${requireYoutubeVideoId(body.videoUrl)}` : null;
    }

    if (body.courseId) {
        const course = await prisma.course.findFirst({ where: { id: body.courseId, isDeleted: false }, select: { id: true } });
        if (!course) throw new AppError(status.BAD_REQUEST, "That course no longer exists.");
    }

    if (body.studentId !== undefined) {
        if (body.studentId) {
            const student = await prisma.user.findUnique({ where: { id: body.studentId }, select: { image: true } });
            if (!student) throw new AppError(status.BAD_REQUEST, "That student account no longer exists.");
            data.avatar = student.image;
        } else {
            data.avatar = null;
        }
    }

    return data;
};

/** Homepage strip — published only, in the order an admin arranged them. */
const listPublic = catchAsync(async (_req, res) => {
    const data = await prisma.testimonial.findMany({
        where: { isPublished: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: 12,
        select: {
            id: true,
            name: true,
            designation: true,
            avatar: true,
            videoUrl: true,
            quote: true,
            rating: true,
            course: { select: { title: true, slug: true } },
        },
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Testimonials fetched successfully",
        data,
    });
});

const listAll = catchAsync(async (_req, res) => {
    const data = await prisma.testimonial.findMany({
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: {
            course: { select: { id: true, title: true, slug: true, thumbnail: true, status: true } },
            student: { select: { id: true, name: true, email: true, image: true } },
        },
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Testimonials fetched successfully",
        data,
    });
});

const create = catchAsync(async (req, res) => {
    const body = req.body as z.infer<typeof testimonialZodSchema>;
    // A new testimonial goes to the top of the order — the same place the
    // old newest-first ordering put it, so it's featured straight away.
    const { _min } = await prisma.testimonial.aggregate({ _min: { order: true } });
    const data = await prisma.testimonial.create({
        data: {
            ...((await toData(body)) as Prisma.TestimonialUncheckedCreateInput),
            order: body.order ?? (_min.order ?? 1) - 1,
        },
    });

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Testimonial added successfully",
        data,
    });
});

const update = catchAsync(async (req, res) => {
    const data = await prisma.testimonial.update({
        where: { id: req.params.testimonialId as string },
        data: await toData(req.body as TestimonialInput),
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Testimonial updated successfully",
        data,
    });
});

/**
 * The whole list in its new order, as the admin dragged it. Every testimonial
 * must be in it exactly once — a list loaded before someone else added or
 * deleted one would otherwise leave positions ambiguous.
 */
const reorder = catchAsync(async (req, res) => {
    const { ids } = req.body as z.infer<typeof reorderZodSchema>;
    const existing = await prisma.testimonial.findMany({ select: { id: true } });
    const known = new Set(existing.map((testimonial) => testimonial.id));

    if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
        throw new AppError(status.CONFLICT, "The testimonials changed since this list loaded. Reload it and try again.");
    }

    await prisma.$transaction(
        ids.map((id, index) => prisma.testimonial.update({ where: { id }, data: { order: index } })),
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Testimonials reordered successfully",
        data: null,
    });
});

const remove = catchAsync(async (req, res) => {
    await prisma.testimonial.delete({ where: { id: req.params.testimonialId as string } });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Testimonial deleted successfully",
        data: null,
    });
});

router.get("/", listPublic);
router.get("/manage", checkAuth(...ADMINS), listAll);
router.post("/manage", checkAuth(...ADMINS), validateRequest(testimonialZodSchema), create);
// Before `/manage/:testimonialId`, which would otherwise take "order" for an id.
router.patch("/manage/order", checkAuth(...ADMINS), validateRequest(reorderZodSchema), reorder);
router.patch(
    "/manage/:testimonialId",
    checkAuth(...ADMINS),
    // Partial so an admin can flip `isPublished` without resending the quote.
    validateRequest(testimonialZodSchema.partial()),
    update,
);
router.delete("/manage/:testimonialId", checkAuth(...ADMINS), remove);

export const TestimonialRoutes = router;
