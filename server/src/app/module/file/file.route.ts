import { Router } from "express";
import status from "http-status";
import { privateFileDownloadUrl } from "../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";
import { checkAuth } from "../../middleware/checkAuth";
import { catchAsync } from "../../shared/catchAsync";

const router = Router();

/**
 * Opens a private file — the curriculum PDF on the staff course page, a file
 * on a hand-in — from the signed link stored for it. Those links can't be
 * opened directly (Cloudinary refuses PDFs over its CDN on this account), so
 * this checks the link is genuinely ours and sends the browser to a download
 * link that works for a few minutes.
 *
 * Whoever was shown the stored link may open the file, as before; being
 * signed in on top of that keeps a link that leaked on its own useless.
 */
const openPrivateFile = catchAsync(async (req, res) => {
    const url = typeof req.query.url === "string" ? req.query.url : null;
    const downloadUrl = privateFileDownloadUrl(url);
    if (!downloadUrl) throw new AppError(status.NOT_FOUND, "File not found.");

    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, downloadUrl);
});

router.get("/private", checkAuth(), openPrivateFile);

export const FileRoutes = router;
