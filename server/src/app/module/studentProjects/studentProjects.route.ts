import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StudentProjectsController } from "./studentProjects.controller";
import { createProjectZodSchema, updateProjectZodSchema } from "./studentProjects.validation";

const router = Router();

router.get("/", checkAuth(Role.STUDENT), StudentProjectsController.getMyProjects);

router.post(
    "/",
    checkAuth(Role.STUDENT),
    validateRequest(createProjectZodSchema),
    StudentProjectsController.createProject,
);

router.patch(
    "/:projectId",
    checkAuth(Role.STUDENT),
    validateRequest(updateProjectZodSchema),
    StudentProjectsController.updateProject,
);

router.delete("/:projectId", checkAuth(Role.STUDENT), StudentProjectsController.deleteProject);

export const StudentProjectsRoutes = router;
