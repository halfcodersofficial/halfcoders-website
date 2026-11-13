import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PracticeMaterialController } from "./practiceMaterial.controller";
import {
    createPracticeMaterialZodSchema,
    reorderPracticeMaterialsZodSchema,
    updatePracticeMaterialZodSchema,
} from "./practiceMaterial.validation";

const router = Router();

// Authoring only — students get these with the practice day itself.
// `assertCanManageCourse` in the service narrows mentors to their courses.
const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/practice-day/:practiceDayId", checkAuth(...STAFF), PracticeMaterialController.getMaterials);

router.patch(
    "/practice-day/:practiceDayId/reorder",
    checkAuth(...STAFF),
    trackActivity("practiceMaterial.reorder"),
    validateRequest(reorderPracticeMaterialsZodSchema),
    PracticeMaterialController.reorderMaterials,
);

router.post(
    "/",
    checkAuth(...STAFF),
    trackActivity("practiceMaterial.create"),
    validateRequest(createPracticeMaterialZodSchema),
    PracticeMaterialController.createMaterial,
);

router.patch(
    "/:materialId",
    checkAuth(...STAFF),
    trackActivity("practiceMaterial.update"),
    validateRequest(updatePracticeMaterialZodSchema),
    PracticeMaterialController.updateMaterial,
);

router.delete("/:materialId", checkAuth(...STAFF), trackActivity("practiceMaterial.delete"), PracticeMaterialController.deleteMaterial);

export const PracticeMaterialRoutes = router;
