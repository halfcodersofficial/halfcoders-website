import { Router } from "express";
import { multerMemoryUpload, verifyFileSignatures } from "../../config/multer.config";
import { checkAuth } from "../../middleware/checkAuth";
import { authRateLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import {
    changePasswordZodSchema,
    emailOnlyZodSchema,
    googleSignInZodSchema,
    loginZodSchema,
    registerZodSchema,
    resetPasswordZodSchema,
    updatePreferencesZodSchema,
    updateProfileZodSchema,
    verifyEmailZodSchema,
} from "./auth.validation";

const router = Router();

/**
 * Half Coders accounts. Signing up, verifying, signing in and the password
 * flows are rate-limited per IP on top of the per-code limits in
 * lib/authCodes.ts; the session itself is an httpOnly cookie (lib/session.ts).
 */
router.post("/register", authRateLimiter, validateRequest(registerZodSchema), AuthController.register);
router.post("/verify-email", authRateLimiter, validateRequest(verifyEmailZodSchema), AuthController.verifyEmail);
router.post("/resend-verification", authRateLimiter, validateRequest(emailOnlyZodSchema), AuthController.resendVerification);
router.post("/login", authRateLimiter, validateRequest(loginZodSchema), AuthController.login);
// Signs in — or signs up — with the ID token from Google's button (lib/google.ts).
router.post("/google", authRateLimiter, validateRequest(googleSignInZodSchema), AuthController.googleSignIn);
router.post("/logout", AuthController.logout);
router.post("/forgot-password", authRateLimiter, validateRequest(emailOnlyZodSchema), AuthController.forgotPassword);
router.post("/reset-password", authRateLimiter, validateRequest(resetPasswordZodSchema), AuthController.resetPassword);
router.post("/change-password", checkAuth(), authRateLimiter, validateRequest(changePasswordZodSchema), AuthController.changePassword);

// The devices the account is signed in on (at most lib/session.ts's MAX_DEVICES).
router.get("/me/devices", checkAuth(), AuthController.listDevices);
router.post("/me/devices/sign-out-others", checkAuth(), AuthController.signOutOtherDevices);
router.delete("/me/devices/:sessionId", checkAuth(), AuthController.signOutDevice);

router.get("/me", checkAuth(), AuthController.getMe);
router.patch("/me", checkAuth(), validateRequest(updateProfileZodSchema), AuthController.updateProfile);
// Every role's own photo. In memory first, so its bytes are checked against
// its claimed type before anything reaches Cloudinary.
router.patch("/me/avatar", checkAuth(), multerMemoryUpload.single("avatar"), verifyFileSignatures, AuthController.updateAvatar);
router.patch(
    "/me/preferences",
    checkAuth(),
    validateRequest(updatePreferencesZodSchema),
    AuthController.updatePreferences,
);

export const AuthRoutes = router;
