/**
 * Files attached to a hand-in are stored privately with a generated name —
 * "k2x9a-1760541234567-report-final.pdf". This reads the person's own name
 * back out of the link: "report-final.pdf".
 */
export const submissionFileName = (url: string) => {
    let last = url;
    try {
        last = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? url);
    } catch {
        // Not a URL — show it as it is.
    }
    return last.replace(/^[a-z0-9]+-\d{13}-/, "") || last;
};

export const isImageFile = (url: string) => /\.(png|jpe?g|webp)(\?|$)/i.test(url);

/** What the upload accepts — the server checks the same, by content. */
export const SUBMISSION_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export const SUBMISSION_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const SUBMISSION_FILE_MAX_COUNT = 5;
