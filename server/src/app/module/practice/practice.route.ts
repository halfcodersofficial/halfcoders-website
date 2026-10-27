import { Router } from "express";
import z from "zod";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PracticeController } from "./practice.controller";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

const createPracticeDayZodSchema = z.object({
    milestoneId: z.string().trim().min(1, "Milestone is required"),
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().trim().max(2000).optional(),
    instructions: z.string().trim().max(5000).optional(),
    order: z.number().int().min(1).max(50).optional(),
    isPublished: z.boolean().optional(),
    /// Auto-publish at this time — must be in the future (see applyReleaseRules).
    releaseAt: z.coerce.date().nullable().optional(),
});

const updatePracticeDayZodSchema = createPracticeDayZodSchema
    .omit({ milestoneId: true, order: true })
    .partial()
    // Null clears a field — the editor sends that for an emptied one.
    .extend({
        description: z.string().trim().max(2000).nullable().optional(),
        instructions: z.string().trim().max(5000).nullable().optional(),
    });

const completeZodSchema = z.object({
    note: z.string().trim().max(2000).optional(),
});

// Staff routes first so "manage" isn't captured by "/:practiceDayId".

router.post(
    "/manage",
    checkAuth(...STAFF),
    trackActivity("practice.create"),
    validateRequest(createPracticeDayZodSchema),
    PracticeController.createPracticeDay,
);

router.patch(
    "/manage/:practiceDayId",
    checkAuth(...STAFF),
    trackActivity("practice.update"),
    validateRequest(updatePracticeDayZodSchema),
    PracticeController.updatePracticeDay,
);

router.delete("/manage/:practiceDayId", checkAuth(...STAFF), trackActivity("practice.delete"), PracticeController.deletePracticeDay);

// Student
router.get(
    "/:practiceDayId",
    checkAuth(Role.STUDENT),
    PracticeController.getPracticeDayForStudent,
);

router.post(
    "/:practiceDayId/complete",
    checkAuth(Role.STUDENT),
    validateRequest(completeZodSchema),
    PracticeController.markComplete,
);

router.post(
    "/:practiceDayId/incomplete",
    checkAuth(Role.STUDENT),
    PracticeController.markIncomplete,
);

export const PracticeRoutes = router;
