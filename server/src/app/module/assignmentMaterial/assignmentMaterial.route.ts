import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AssignmentMaterialController } from "./assignmentMaterial.controller";
import {
    createAssignmentMaterialZodSchema,
    reorderAssignmentMaterialsZodSchema,
    updateAssignmentMaterialZodSchema,
} from "./assignmentMaterial.validation";

const router = Router();

// Authoring only — students get these with the assignment itself.
// `assertCanManageCourse` in the service narrows mentors to their courses.
const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/assignment/:assignmentId", checkAuth(...STAFF), AssignmentMaterialController.getMaterials);

router.patch(
    "/assignment/:assignmentId/reorder",
    checkAuth(...STAFF),
    trackActivity("material.reorder"),
    validateRequest(reorderAssignmentMaterialsZodSchema),
    AssignmentMaterialController.reorderMaterials,
);

router.post(
    "/",
    checkAuth(...STAFF),
    trackActivity("material.create"),
    validateRequest(createAssignmentMaterialZodSchema),
    AssignmentMaterialController.createMaterial,
);

router.patch(
    "/:materialId",
    checkAuth(...STAFF),
    trackActivity("material.update"),
    validateRequest(updateAssignmentMaterialZodSchema),
    AssignmentMaterialController.updateMaterial,
);

router.delete("/:materialId", checkAuth(...STAFF), trackActivity("material.delete"), AssignmentMaterialController.deleteMaterial);

export const AssignmentMaterialRoutes = router;
