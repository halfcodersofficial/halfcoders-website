"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { canOptimizeImage } from "@/lib/imageHosts";
import { cn, initials } from "@/lib/utils";

interface AvatarProps {
    src?: string | null;
    name: string;
    size?: number;
    className?: string;
}

/**
 * Falls back to initials — most accounts have no photo, and a stored URL can
 * stop resolving (deleted asset, typo'd link) long after it was saved. A photo
 * on a host Next doesn't optimize is loaded as-is, as SafeImage does: given to
 * the optimizer, it would throw while rendering and take the page down.
 */
export const Avatar = ({ src, name, size = 40, className }: AvatarProps) => {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (src && !failed) {
        return (
            <Image
                src={src}
                alt={name}
                width={size}
                height={size}
                className={cn("rounded-full object-cover", className)}
                unoptimized={!canOptimizeImage(src)}
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
                className,
            )}
            style={{ width: size, height: size, fontSize: size * 0.38 }}
            aria-hidden
        >
            {initials(name)}
        </span>
    );
};
