import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OutlineController } from "./outline.controller";
import {
    createOutlineItemZodSchema,
    createOutlineWeekZodSchema,
    publishAllOutlineItemsZodSchema,
    reorderOutlineItemsZodSchema,
    reorderOutlineWeeksZodSchema,
    updateOutlineItemZodSchema,
    updateOutlineWeekZodSchema,
} from "./outline.validation";

const router = Router();

// The Outline Maker. Students read the same data through
// /learning/courses/:slug/outline; these are the authoring endpoints, and
// `assertCanManageCourse` narrows mentors to their own courses.
const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/course/:courseId", checkAuth(...STAFF), OutlineController.getOutline);

router.post("/course/:courseId/copy-from-modules", checkAuth(...STAFF), trackActivity("outline.copyFromModules"), OutlineController.copyFromModules);

router.patch(
    "/course/:courseId/weeks/reorder",
    checkAuth(...STAFF),
    trackActivity("outline.weeks.reorder"),
    validateRequest(reorderOutlineWeeksZodSchema),
    OutlineController.reorderWeeks,
);

router.patch(
    "/course/:courseId/publish-all",
    checkAuth(...STAFF),
    trackActivity("outline.publishAll"),
    validateRequest(publishAllOutlineItemsZodSchema),
    OutlineController.publishAll,
);

router.post("/weeks", checkAuth(...STAFF), trackActivity("outline.week.create"), validateRequest(createOutlineWeekZodSchema), OutlineController.createWeek);

router.patch(
    "/weeks/:weekId",
    checkAuth(...STAFF),
    trackActivity("outline.week.update"),
    validateRequest(updateOutlineWeekZodSchema),
    OutlineController.updateWeek,
);

router.delete("/weeks/:weekId", checkAuth(...STAFF), trackActivity("outline.week.delete"), OutlineController.deleteWeek);

router.patch(
    "/weeks/:weekId/items/reorder",
    checkAuth(...STAFF),
    trackActivity("outline.items.reorder"),
    validateRequest(reorderOutlineItemsZodSchema),
    OutlineController.reorderItems,
);

router.post("/items", checkAuth(...STAFF), trackActivity("outline.item.create"), validateRequest(createOutlineItemZodSchema), OutlineController.createItem);

router.patch(
    "/items/:itemId",
    checkAuth(...STAFF),
    trackActivity("outline.item.update"),
    validateRequest(updateOutlineItemZodSchema),
    OutlineController.updateItem,
);

router.delete("/items/:itemId", checkAuth(...STAFF), trackActivity("outline.item.delete"), OutlineController.deleteItem);

export const OutlineRoutes = router;
