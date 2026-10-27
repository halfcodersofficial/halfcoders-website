import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StudentCourseRequestsController } from "./studentCourseRequests.controller";
import { createCourseRequestZodSchema } from "./studentCourseRequests.validation";

const router = Router();

router.get("/", checkAuth(Role.STUDENT), StudentCourseRequestsController.getMyCourseRequests);

router.post(
    "/",
    checkAuth(Role.STUDENT),
    validateRequest(createCourseRequestZodSchema),
    StudentCourseRequestsController.createCourseRequest,
);

export const StudentCourseRequestsRoutes = router;
