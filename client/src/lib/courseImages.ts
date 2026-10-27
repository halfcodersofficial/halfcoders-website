/**
 * Course images — the thumbnail and the gallery after it. All 16:9, cropped
 * in the browser and re-encoded as JPEG before they upload, so the API only
 * ever stores the same shape and a modest file.
 */

export const COURSE_IMAGE_ASPECT = 16 / 9;

/** What the cropper exports: sharp on a retina purchase card, ~200 KB on the wire. */
export const COURSE_IMAGE_WIDTH = 1280;

/** The thumbnail plus up to five more — the API's gallery ceiling is five. */
export const MAX_COURSE_IMAGES = 6;

/** The picked file, before cropping. What uploads is the much smaller export. */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** For the file input's `accept`. */
export const COURSE_IMAGE_ACCEPT = ACCEPTED_TYPES.join(",");

/** `undefined` when the file can go to the cropper; otherwise what to tell the user. */
export function validateCourseImage(file: File): string | undefined {
    if (!ACCEPTED_TYPES.includes(file.type)) return "Choose a JPEG, PNG or WebP image.";
    if (file.size > MAX_SOURCE_BYTES) return "Image must be 10 MB or smaller.";
    return undefined;
}

/** A course's images in slideshow order: the thumbnail, then the gallery. */
export const courseImagesOf = (course: { thumbnail: string | null; gallery?: string[] | null }): string[] =>
    [course.thumbnail, ...(course.gallery ?? [])].filter((url): url is string => Boolean(url));
