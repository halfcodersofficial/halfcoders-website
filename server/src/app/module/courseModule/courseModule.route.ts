import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CourseModuleController } from "./courseModule.controller";
import {
    createModuleZodSchema,
    reorderModulesZodSchema,
    updateModuleZodSchema,
} from "./courseModule.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get(
    "/milestone/:milestoneId",
    checkAuth(...STAFF),
    CourseModuleController.getModulesByMilestone,
);

router.post(
    "/",
    checkAuth(...STAFF),
    trackActivity("module.create"),
    validateRequest(createModuleZodSchema),
    CourseModuleController.createModule,
);

router.patch(
    "/milestone/:milestoneId/reorder",
    checkAuth(...STAFF),
    trackActivity("module.reorder"),
    validateRequest(reorderModulesZodSchema),
    CourseModuleController.reorderModules,
);

router.patch(
    "/:moduleId",
    checkAuth(...STAFF),
    trackActivity("module.update"),
    validateRequest(updateModuleZodSchema),
    CourseModuleController.updateModule,
);

router.delete("/:moduleId", checkAuth(...STAFF), trackActivity("module.delete"), CourseModuleController.deleteModule);

export const CourseModuleRoutes = router;
