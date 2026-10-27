import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { LiveClassController } from "./liveClass.controller";
import { createLiveClassZodSchema, updateLiveClassZodSchema } from "./liveClass.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ---- Students: their courses' upcoming classes.
router.get("/mine", checkAuth(Role.STUDENT), LiveClassController.listMine);
router.get("/learn/:slug", checkAuth(Role.STUDENT), LiveClassController.listForLearner);

// ---- Staff: a course's calendar of live classes.
router.get("/course/:courseId", checkAuth(...STAFF), LiveClassController.listForStaff);
router.post(
    "/course/:courseId",
    checkAuth(...STAFF),
    trackActivity("liveClass.create"),
    validateRequest(createLiveClassZodSchema),
    LiveClassController.create,
);
router.patch(
    "/:liveClassId",
    checkAuth(...STAFF),
    trackActivity("liveClass.update"),
    validateRequest(updateLiveClassZodSchema),
    LiveClassController.update,
);
router.post("/:liveClassId/cancel", checkAuth(...STAFF), trackActivity("liveClass.cancel"), LiveClassController.cancel);
router.delete("/:liveClassId", checkAuth(...STAFF), trackActivity("liveClass.delete"), LiveClassController.remove);

export const LiveClassRoutes = router;
