import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StudentSkillsController } from "./studentSkills.controller";
import { createSkillZodSchema, updateSkillZodSchema } from "./studentSkills.validation";

const router = Router();

router.get("/", checkAuth(Role.STUDENT), StudentSkillsController.getMySkills);

router.post(
    "/",
    checkAuth(Role.STUDENT),
    validateRequest(createSkillZodSchema),
    StudentSkillsController.createSkill,
);

router.patch(
    "/:skillId",
    checkAuth(Role.STUDENT),
    validateRequest(updateSkillZodSchema),
    StudentSkillsController.updateSkill,
);

router.delete("/:skillId", checkAuth(Role.STUDENT), StudentSkillsController.deleteSkill);

export const StudentSkillsRoutes = router;
