import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StudentProfileController } from "./studentProfile.controller";
import {
    additionalInfoZodSchema,
    addressZodSchema,
    educationZodSchema,
    jobProfileZodSchema,
    linksZodSchema,
} from "./studentProfile.validation";

const router = Router();

router.get("/overview", checkAuth(Role.STUDENT), StudentProfileController.getOverview);

router.get("/additional-info", checkAuth(Role.STUDENT), StudentProfileController.getAdditionalInfo);
router.put(
    "/additional-info",
    checkAuth(Role.STUDENT),
    validateRequest(additionalInfoZodSchema),
    StudentProfileController.updateAdditionalInfo,
);

router.get("/address", checkAuth(Role.STUDENT), StudentProfileController.getAddress);
router.put(
    "/address",
    checkAuth(Role.STUDENT),
    validateRequest(addressZodSchema),
    StudentProfileController.updateAddress,
);

router.get("/education", checkAuth(Role.STUDENT), StudentProfileController.getEducation);
router.put(
    "/education",
    checkAuth(Role.STUDENT),
    validateRequest(educationZodSchema),
    StudentProfileController.updateEducation,
);

router.get("/links", checkAuth(Role.STUDENT), StudentProfileController.getLinks);
router.put(
    "/links",
    checkAuth(Role.STUDENT),
    validateRequest(linksZodSchema),
    StudentProfileController.updateLinks,
);

router.get("/job-profile", checkAuth(Role.STUDENT), StudentProfileController.getJobProfile);
router.put(
    "/job-profile",
    checkAuth(Role.STUDENT),
    validateRequest(jobProfileZodSchema),
    StudentProfileController.updateJobProfile,
);

export const StudentProfileRoutes = router;
