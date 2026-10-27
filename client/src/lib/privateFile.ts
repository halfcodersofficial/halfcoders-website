import envConfig from "./envConfig";

/**
 * Where to send the browser to open a file. Private files — the curriculum
 * PDF, files on a hand-in — are stored as signed Cloudinary links that can't
 * be opened directly (a PDF there just answers 401), so they go through the
 * API, which checks the link and forwards to one that works. Any other link
 * is returned as it is.
 */
export const privateFileHref = (url: string) =>
    /^https?:\/\/res\.cloudinary\.com\/[^/]+\/[a-z]+\/authenticated\//.test(url)
        ? `${envConfig.apiBaseUrl}/files/private?url=${encodeURIComponent(url)}`
        : url;
