import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StudentJobExperiencesController } from "./studentJobExperiences.controller";
import {
    createJobExperienceZodSchema,
    updateJobExperienceZodSchema,
} from "./studentJobExperiences.validation";

const router = Router();

router.get("/", checkAuth(Role.STUDENT), StudentJobExperiencesController.getMyJobExperiences);

router.post(
    "/",
    checkAuth(Role.STUDENT),
    validateRequest(createJobExperienceZodSchema),
    StudentJobExperiencesController.createJobExperience,
);

router.patch(
    "/:experienceId",
    checkAuth(Role.STUDENT),
    validateRequest(updateJobExperienceZodSchema),
    StudentJobExperiencesController.updateJobExperience,
);

router.delete(
    "/:experienceId",
    checkAuth(Role.STUDENT),
    StudentJobExperiencesController.deleteJobExperience,
);

export const StudentJobExperiencesRoutes = router;
