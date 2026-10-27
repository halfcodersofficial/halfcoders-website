import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdmissionTicketController } from "./admissionTicket.controller";
import { saveAdmissionTicketZodSchema } from "./admissionTicket.validation";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// Admins write each course's ticket from that course's page.
router.get("/manage/courses", checkAuth(...ADMINS), AdmissionTicketController.getTicketCourses);
router.get("/manage/courses/:courseId", checkAuth(...ADMINS), AdmissionTicketController.getTicketCourse);
router.put(
    "/manage/courses/:courseId",
    checkAuth(...ADMINS),
    validateRequest(saveAdmissionTicketZodSchema),
    AdmissionTicketController.saveTicket,
);
router.delete("/manage/courses/:courseId", checkAuth(...ADMINS), AdmissionTicketController.deleteTicket);

// A student's own ticket for a course they're on.
router.get("/mine/:courseId", checkAuth(Role.STUDENT), AdmissionTicketController.getMyTicket);

export const AdmissionTicketRoutes = router;
