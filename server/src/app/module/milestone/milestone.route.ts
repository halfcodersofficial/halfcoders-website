import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { MilestoneController } from "./milestone.controller";
import {
    createMilestoneZodSchema,
    reorderWeekItemsZodSchema,
    reorderZodSchema,
    updateMilestoneZodSchema,
} from "./milestone.validation";

const router = Router();

// Mentors and admins both reach these; `assertCanManageCourse` in the service
// narrows mentors to the courses they are actually assigned to.
const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/course/:courseId", checkAuth(...STAFF), MilestoneController.getMilestonesByCourse);

router.post(
    "/",
    checkAuth(...STAFF),
    trackActivity("week.create"),
    validateRequest(createMilestoneZodSchema),
    MilestoneController.createMilestone,
);

router.patch(
    "/course/:courseId/reorder",
    checkAuth(...STAFF),
    trackActivity("week.reorder"),
    validateRequest(reorderZodSchema),
    MilestoneController.reorderMilestones,
);

router.patch(
    "/:milestoneId/items/reorder",
    checkAuth(...STAFF),
    trackActivity("week.items.reorder"),
    validateRequest(reorderWeekItemsZodSchema),
    MilestoneController.reorderWeekItems,
);

router.patch(
    "/:milestoneId",
    checkAuth(...STAFF),
    trackActivity("week.update"),
    validateRequest(updateMilestoneZodSchema),
    MilestoneController.updateMilestone,
);

router.delete("/:milestoneId", checkAuth(...STAFF), trackActivity("week.delete"), MilestoneController.deleteMilestone);

export const MilestoneRoutes = router;
