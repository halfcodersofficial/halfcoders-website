/**
 * Hosts whose images may go through Next's image optimizer.
 *
 * `next.config.ts` builds `images.remotePatterns` from this list, and
 * `SafeImage` reads it to decide whether a URL can be optimized. The two have
 * to agree: for a host that isn't configured, `next/image` *throws while
 * rendering* rather than failing to load, so no `onError` handler can catch
 * it and the whole page goes down.
 *
 * Keep this to hosts the platform actually uploads to. Admins and mentors can
 * paste any URL into a thumbnail or avatar field — those are handled by
 * falling back to an unoptimized <img>, not by widening this list, which would
 * turn the optimizer into a proxy that resizes images for arbitrary origins.
 */
export const OPTIMIZED_IMAGE_HOSTS = [
    // Course videos are unlisted YouTube uploads, so their thumbnails come
    // straight from YouTube's CDN.
    "i.ytimg.com",
    "img.youtube.com",
    // Course thumbnails, mentor photos and assignment attachments.
    "res.cloudinary.com",
] as const;

/**
 * Whether `next/image` can optimize this source without throwing.
 *
 * Local paths are always fine. Remote sources must be https on a listed host —
 * `remotePatterns` pins the protocol, so an http URL to an allowed host is
 * rejected just as an unknown host is.
 */
export const canOptimizeImage = (src: string): boolean => {
    if (src.startsWith("/")) return true;

    try {
        const url = new URL(src);
        return (
            url.protocol === "https:" &&
            (OPTIMIZED_IMAGE_HOSTS as readonly string[]).includes(url.hostname)
        );
    } catch {
        // Not a parseable URL — let SafeImage's fallback deal with it.
        return false;
    }
};
