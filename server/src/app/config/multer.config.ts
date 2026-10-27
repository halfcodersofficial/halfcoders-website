import { NextFunction, Request, Response } from "express";
import status from "http-status";
import multer from "multer";
import AppError from "../errorHelpers/AppError";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { CLOUDINARY_ROOT_FOLDER, cloudinaryUpload, folderForFile } from "./cloudinary.config";

const storage = new CloudinaryStorage({
    cloudinary: cloudinaryUpload,
    params: async (_req, file) => {
        const originalName = file.originalname;
        const fileNameWithoutExtension = originalName
            .split(".")
            .slice(0, -1)
            .join(".")
            .toLowerCase()
            .replace(/\s+/g, "-")
            // eslint-disable-next-line no-useless-escape
            .replace(/[^a-z0-9\-]/g, "");

        const uniqueName = `${Math.random().toString(36).substring(2)}-${Date.now()}-${fileNameWithoutExtension}`;

        return {
            folder: `${CLOUDINARY_ROOT_FOLDER}/${folderForFile(originalName)}`,
            public_id: uniqueName,
            resource_type: "auto",
        };
    },
});

// Upload restrictions:
//  - 5 MB ceiling: enough for course thumbnails, mentor photos and PDF
//    assignment attachments, small enough that one student can't drain the
//    shared Cloudinary bandwidth budget.
//  - MIME allowlist: only what the UI actually renders. Anything else (zip,
//    exe, html, svg) is rejected before it reaches Cloudinary.
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
]);

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
    } else {
        // An AppError, so the person uploading is told why (a plain Error is masked as a 500).
        cb(new AppError(status.BAD_REQUEST, `“${file.originalname}” isn't a JPEG, PNG, WebP or PDF file.`));
    }
};

export const multerUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5,
    },
});

/**
 * In-memory variant for routes that need the buffer themselves (e.g. calling
 * `uploadFileToCloudinary` directly). Same ceiling, allowlist and file cap —
 * never use bare `multer.memoryStorage()` in a route, or a large upload can
 * OOM the process.
 */
export const multerMemoryUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5,
    },
});

// ── Magic-byte (content-sniffing) validation ────────────────────────────────
// `fileFilter` above can only see the CLIENT-SUPPLIED Content-Type, which is
// trivially spoofed — an attacker uploads an HTML or SVG payload labelled
// `image/png`. This middleware reads the real leading bytes and confirms they
// match the claimed type. Runs AFTER a `multerMemoryUpload` handler, once the
// buffers exist.
const startsWith = (buf: Buffer, sig: number[], offset = 0) =>
    buf.length >= offset + sig.length && sig.every((b, i) => buf[offset + i] === b);

const matchesSignature = (mimetype: string, buf: Buffer): boolean => {
    switch (mimetype) {
        case "image/jpeg":
        case "image/jpg":
            return startsWith(buf, [0xff, 0xd8, 0xff]);
        case "image/png":
            return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case "image/webp":
            // "RIFF"...."WEBP"
            return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
        case "application/pdf":
            return startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
        default:
            return false;
    }
};

const collectFiles = (req: Request): Express.Multer.File[] => {
    const files: Express.Multer.File[] = [];
    if (req.file) files.push(req.file);
    if (Array.isArray(req.files)) {
        files.push(...req.files);
    } else if (req.files && typeof req.files === "object") {
        for (const group of Object.values(req.files)) files.push(...(group as Express.Multer.File[]));
    }
    return files;
};

export const verifyFileSignatures = (req: Request, res: Response, next: NextFunction) => {
    for (const file of collectFiles(req)) {
        if (!file.buffer || file.buffer.length === 0 || !matchesSignature(file.mimetype, file.buffer)) {
            return res.status(400).json({
                success: false,
                message: `Rejected file "${file.originalname}": contents do not match a permitted image or PDF format.`,
            });
        }
    }
    next();
};
