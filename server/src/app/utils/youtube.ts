import status from "http-status";
import AppError from "../errorHelpers/AppError";

/**
 * Accepts every YouTube URL shape a mentor is likely to paste from the browser
 * or the share sheet — watch pages, youtu.be short links, /embed, /shorts, and
 * /live — and returns the 11-character video id.
 *
 * Unlisted videos (plan §12) use exactly the same URL shapes as public ones,
 * so no special handling is needed: the id is all we store.
 */
export const extractYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;

    let parsed: URL;
    try {
        parsed = new URL(url.trim());
    } catch {
        // A bare id pasted on its own is a reasonable thing to accept.
        return /^[A-Za-z0-9_-]{11}$/.test(url.trim()) ? url.trim() : null;
    }

    const host = parsed.hostname.replace(/^www\./, "");
    const isYouTube =
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com" ||
        host === "youtu.be";

    if (!isYouTube) return null;

    const candidate =
        host === "youtu.be"
            ? parsed.pathname.slice(1)
            : parsed.searchParams.get("v") ??
            parsed.pathname.replace(/^\/(embed|shorts|live|v)\//, "");

    const id = candidate?.split("/")[0] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
};

/** Same, but rejects unparseable links with a 400 the client can display. */
export const requireYoutubeVideoId = (url: string): string => {
    const id = extractYoutubeVideoId(url);
    if (!id) {
        throw new AppError(
            status.BAD_REQUEST,
            "That doesn't look like a YouTube video link. Paste the full URL from the video's Share button.",
        );
    }
    return id;
};

/** Default thumbnail served by YouTube for any video id. */
export const youtubeThumbnailUrl = (videoId: string): string =>
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

/** Accepts "18:42", "1:04:07", or a plain number of seconds. */
export const toSeconds = (value: string | number | undefined): number => {
    if (value === undefined) return 0;
    if (typeof value === "number") return value;

    const parts = value.split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;

    return parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : parts[0] * 60 + parts[1];
};

/** Formats a duration in seconds as "18:42", or "1:04:07" past the hour. */
export const formatDuration = (totalSeconds: number): string => {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};
