"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { canOptimizeImage } from "@/lib/imageHosts";
import { cn } from "@/lib/utils";

interface SafeImageProps extends Omit<ImageProps, "src" | "onError"> {
    src: string | null | undefined;
    /** Rendered instead of the image when there's no src, or it fails to load. */
    fallback: ReactNode;
    wrapperClassName?: string;
}

/**
 * `next/image` with a fallback for a source that doesn't resolve.
 *
 * Course thumbnails and profile photos are URLs typed in by an admin or a
 * mentor, and they go stale: an asset gets deleted from Cloudinary, someone
 * pastes a typo, a host goes down. Next's optimizer answers with
 * "upstream image response failed" and the layout is left with a hole.
 *
 * It also covers the harsher failure: for a host missing from
 * `images.remotePatterns`, `next/image` throws *during render* instead of
 * firing `onError`, taking the page down with it. Since these URLs are typed
 * in by hand, that host is often one nobody anticipated. Such a source is
 * rendered unoptimized — the browser loads it directly, exactly as a plain
 * <img> would, so an unexpected host costs optimization rather than the page.
 *
 * Anything user-supplied that could 404 should come through here rather than
 * `next/image` directly.
 */
export function SafeImage({
    src,
    fallback,
    wrapperClassName,
    className,
    alt,
    ...props
}: SafeImageProps) {
    const [failed, setFailed] = useState(false);

    // A changed src deserves a fresh attempt — otherwise fixing a broken URL in
    // the admin form would still show the fallback until a reload.
    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) {
        return (
            <div className={cn("grid h-full w-full place-items-center", wrapperClassName)}>
                {fallback}
            </div>
        );
    }

    return (
        <Image
            {...props}
            src={src}
            alt={alt}
            className={className}
            unoptimized={props.unoptimized || !canOptimizeImage(src)}
            onError={() => setFailed(true)}
        />
    );
}
