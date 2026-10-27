import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StudentHiredRecordsController } from "./studentHiredRecords.controller";
import {
    createHiredRecordZodSchema,
    updateHiredRecordZodSchema,
} from "./studentHiredRecords.validation";

const router = Router();

router.get("/", checkAuth(Role.STUDENT), StudentHiredRecordsController.getMyHiredRecords);

router.post(
    "/",
    checkAuth(Role.STUDENT),
    validateRequest(createHiredRecordZodSchema),
    StudentHiredRecordsController.createHiredRecord,
);

router.patch(
    "/:hiredRecordId",
    checkAuth(Role.STUDENT),
    validateRequest(updateHiredRecordZodSchema),
    StudentHiredRecordsController.updateHiredRecord,
);

router.delete(
    "/:hiredRecordId",
    checkAuth(Role.STUDENT),
    StudentHiredRecordsController.deleteHiredRecord,
);

export const StudentHiredRecordsRoutes = router;
