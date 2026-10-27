import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ConceptualController } from "./conceptual.controller";
import {
    createSessionZodSchema,
    createTopicZodSchema,
    reorderZodSchema,
    updateSessionZodSchema,
    updateTopicZodSchema,
    watchedZodSchema,
} from "./conceptual.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ---- Staff: topics and their recordings. A mentor only reaches the courses
// they're assigned to (`assertCanManageCourse` in the service).
router.get("/manage/courses", checkAuth(...STAFF), ConceptualController.getManageCourses);
router.get("/manage/courses/:courseId", checkAuth(...STAFF), ConceptualController.getManageCourse);

router.post(
    "/topics",
    checkAuth(...STAFF),
    trackActivity("conceptual.topic.create"),
    validateRequest(createTopicZodSchema),
    ConceptualController.createTopic,
);
router.patch(
    "/courses/:courseId/topics/reorder",
    checkAuth(...STAFF),
    trackActivity("conceptual.topic.reorder"),
    validateRequest(reorderZodSchema),
    ConceptualController.reorderTopics,
);
router.patch(
    "/topics/:topicId",
    checkAuth(...STAFF),
    trackActivity("conceptual.topic.update"),
    validateRequest(updateTopicZodSchema),
    ConceptualController.updateTopic,
);
router.delete("/topics/:topicId", checkAuth(...STAFF), trackActivity("conceptual.topic.delete"), ConceptualController.deleteTopic);

router.post(
    "/sessions",
    checkAuth(...STAFF),
    trackActivity("conceptual.session.create"),
    validateRequest(createSessionZodSchema),
    ConceptualController.createSession,
);
router.patch(
    "/topics/:topicId/sessions/reorder",
    checkAuth(...STAFF),
    trackActivity("conceptual.session.reorder"),
    validateRequest(reorderZodSchema),
    ConceptualController.reorderSessions,
);
router.patch(
    "/sessions/:sessionId",
    checkAuth(...STAFF),
    trackActivity("conceptual.session.update"),
    validateRequest(updateSessionZodSchema),
    ConceptualController.updateSession,
);
router.delete(
    "/sessions/:sessionId",
    checkAuth(...STAFF),
    trackActivity("conceptual.session.delete"),
    ConceptualController.deleteSession,
);

// ---- Students: what they're enrolled in. Staff review recordings in the
// manager, as with the learning player.
router.get("/my-courses", checkAuth(Role.STUDENT), ConceptualController.getMyCourses);
router.get("/courses/:slug", checkAuth(Role.STUDENT), ConceptualController.getCourseSessions);
router.put(
    "/sessions/:sessionId/watched",
    checkAuth(Role.STUDENT),
    validateRequest(watchedZodSchema),
    ConceptualController.setWatched,
);

export const ConceptualRoutes = router;
