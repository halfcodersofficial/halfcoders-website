import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import status from "http-status";
import AppError from "../errorHelpers/AppError";
import { logger } from "../utils/logger";
import { envVars } from "./env";

cloudinary.config({
    cloud_name: envVars.CLOUDINARY.CLOUD_NAME,
    api_key: envVars.CLOUDINARY.API_KEY,
    api_secret: envVars.CLOUDINARY.API_SECRET,
});

// The Cloudinary account may be shared with other apps, so every Half Coders
// asset is namespaced under its own top-level folder (CLOUDINARY_FOLDER). That
// keeps the media library separable, and lets Half Coders tell its own uploads
// apart from anyone else's (see isOwnCloudinaryAsset).
const ROOT_FOLDER = envVars.CLOUDINARY.FOLDER;

const buildUniqueName = (originalName: string) => {
    const fileNameWithoutExtension = originalName
        .split(".")
        .slice(0, -1)
        .join(".")
        .toLowerCase()
        .replace(/\s+/g, "-")
        // eslint-disable-next-line no-useless-escape
        .replace(/[^a-z0-9\-]/g, "");

    return `${Math.random().toString(36).substring(2)}-${Date.now()}-${fileNameWithoutExtension}`;
};

export const folderForFile = (originalName: string) =>
    originalName.split(".").pop()?.toLowerCase() === "pdf" ? "pdfs" : "images";

/**
 * Course thumbnails and gallery images get a folder of their own, so a course
 * save can delete the ones it dropped knowing each came from the course image
 * upload — never an avatar or anything else that happens to live in `images`.
 */
export const COURSE_IMAGE_FOLDER = "course-images";

export const uploadFileToCloudinary = async (
    buffer: Buffer,
    fileName: string,
    folder: string = folderForFile(fileName),
): Promise<UploadApiResponse> => {
    if (!buffer || !fileName) {
        throw new AppError(status.BAD_REQUEST, "File buffer and file name are required for upload");
    }

    const uniqueName = buildUniqueName(fileName);

    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                {
                    resource_type: "auto",
                    // public_id already carries the full folder path — passing
                    // `folder` as well made Cloudinary prepend it a second time
                    // (e.g. <folder>/pdfs/<folder>/pdfs/...).
                    public_id: `${ROOT_FOLDER}/${folder}/${uniqueName}`,
                },
                (error, result) => {
                    if (error) {
                        logger.error("Cloudinary upload failed", {
                            fileName,
                            message: error.message,
                            http_code: error.http_code,
                        });
                        return reject(
                            new AppError(status.INTERNAL_SERVER_ERROR, "Failed to upload file. Please try again."),
                        );
                    }
                    resolve(result as UploadApiResponse);
                },
            )
            .end(buffer);
    });
};

/**
 * Same as `uploadFileToCloudinary`, but as a private, *authenticated*
 * Cloudinary asset (`type: "authenticated"`) instead of the default public
 * one — for files that must never be reachable by a plain URL, like the
 * course curriculum PDF.
 *
 * Returns a signed delivery URL alongside the public id — the id is what
 * `deleteAuthenticatedFileFromCloudinary` needs to clean it up later, since a
 * signed URL doesn't parse the same way a public one does. The signed URL is
 * what gets stored, but it is the file's identity, not a way to open it: the
 * account blocks CDN delivery of PDFs ("deny or ACL failure", 401) even when
 * signed, so reading the file back always goes through
 * `privateFileDownloadUrl`.
 */
export const uploadPrivateFileToCloudinary = async (
    buffer: Buffer,
    fileName: string,
    folder: string = folderForFile(fileName),
): Promise<{ url: string; publicId: string }> => {
    if (!buffer || !fileName) {
        throw new AppError(status.BAD_REQUEST, "File buffer and file name are required for upload");
    }

    const uniqueName = buildUniqueName(fileName);

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                {
                    resource_type: "auto",
                    type: "authenticated",
                    // public_id already carries the full folder path — passing
                    // `folder` as well made Cloudinary prepend it a second time
                    // (e.g. <folder>/pdfs/<folder>/pdfs/...).
                    public_id: `${ROOT_FOLDER}/${folder}/${uniqueName}`,
                },
                (error, uploadResult) => {
                    if (error) {
                        logger.error("Cloudinary private upload failed", {
                            fileName,
                            message: error.message,
                            http_code: error.http_code,
                        });
                        return reject(
                            new AppError(status.INTERNAL_SERVER_ERROR, "Failed to upload file. Please try again."),
                        );
                    }
                    resolve(uploadResult as UploadApiResponse);
                },
            )
            .end(buffer);
    });

    const url = cloudinary.url(result.public_id, {
        type: "authenticated",
        sign_url: true,
        resource_type: result.resource_type,
        format: result.format,
    });

    return { url, publicId: result.public_id };
};

/** How long a link from `privateFileDownloadUrl` works — it's opened straight away. */
const PRIVATE_DOWNLOAD_TTL_SECONDS = 10 * 60;

/**
 * Turns the stored signed URL of a private file (see
 * `uploadPrivateFileToCloudinary`) into a short-lived download link served by
 * Cloudinary's API rather than its CDN, which is the only way a PDF reaches
 * anyone on this account. Null for anything that isn't one of our private
 * files, including a stored-looking URL whose signature doesn't check out —
 * having the real signed URL is what grants the file, same as before.
 */
export const privateFileDownloadUrl = (signedUrl: string | null | undefined): string | null => {
    if (!signedUrl) return null;
    let pathname: string;
    try {
        const parsed = new URL(signedUrl);
        if (parsed.hostname !== "res.cloudinary.com") return null;
        pathname = decodeURIComponent(parsed.pathname);
    } catch {
        return null;
    }

    const match = pathname.match(
        new RegExp(`^/${envVars.CLOUDINARY.CLOUD_NAME}/(image|raw|video)/authenticated/s--[^/]+--/v(\\d+)/(${ROOT_FOLDER}/[^.]+)\\.([a-z0-9]+)$`, "i"),
    );
    if (!match) return null;
    const [, resourceType, version, publicId, format] = match;

    const expected = cloudinary.url(publicId, {
        type: "authenticated",
        sign_url: true,
        resource_type: resourceType,
        format,
        version,
    });
    if (decodeURIComponent(new URL(expected).pathname) !== pathname) return null;

    return cloudinary.utils.private_download_url(publicId, format, {
        type: "authenticated",
        resource_type: resourceType,
        expires_at: Math.floor(Date.now() / 1000) + PRIVATE_DOWNLOAD_TTL_SECONDS,
    });
};

export const deleteAuthenticatedFileFromCloudinary = async (publicId: string) => {
    try {
        await cloudinary.uploader.destroy(publicId, { type: "authenticated", resource_type: "image" });
        logger.delete(`Authenticated file ${publicId} deleted from Cloudinary`);
    } catch (error) {
        logger.error("Error deleting authenticated file from Cloudinary", error);
    }
};

export const deleteFileFromCloudinary = async (url: string) => {
    try {
        // Cloudinary URLs embed the public id between the version segment and
        // the extension: .../upload/v1712345678/<public_id>.jpg
        const match = url.match(/\/v\d+\/(.+?)(?:\.[a-zA-Z0-9]+)+$/);

        if (match?.[1]) {
            await cloudinary.uploader.destroy(match[1], { resource_type: "image" });
            logger.delete(`File ${match[1]} deleted from Cloudinary`);
        }
    } catch (error) {
        // Never let a failed cleanup break the request that triggered it — the
        // orphaned asset costs storage, not correctness.
        logger.error("Error deleting file from Cloudinary", error);
    }
};

/**
 * True only for an asset Half Coders itself uploaded (our cloud, under the
 * CLOUDINARY_FOLDER folder). A URL pointing anywhere else is never deleted.
 */
export const isOwnCloudinaryAsset = (url: string | null | undefined): url is string => {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return (
            parsed.hostname === "res.cloudinary.com" &&
            parsed.pathname.startsWith(`/${envVars.CLOUDINARY.CLOUD_NAME}/`) &&
            new RegExp(`/v\\d+/${ROOT_FOLDER}/`).test(parsed.pathname)
        );
    } catch {
        return false;
    }
};

/** True only for an image the course image upload stored (see COURSE_IMAGE_FOLDER). */
export const isCourseImageAsset = (url: string | null | undefined): url is string =>
    isOwnCloudinaryAsset(url) &&
    new RegExp(`/v\\d+/${ROOT_FOLDER}/${COURSE_IMAGE_FOLDER}/`).test(new URL(url).pathname);

/** Students' assignment files: private, each reachable only by its signed link. */
export const SUBMISSION_FILE_FOLDER = "submissions";

/** True only for a file the hand-in upload stored (see SUBMISSION_FILE_FOLDER). */
export const isSubmissionFile = (url: string | null | undefined): url is string =>
    isOwnCloudinaryAsset(url) && new RegExp(`/v\\d+/${ROOT_FOLDER}/${SUBMISSION_FILE_FOLDER}/`).test(new URL(url).pathname);

export const cloudinaryUpload = cloudinary;
export { ROOT_FOLDER as CLOUDINARY_ROOT_FOLDER };
