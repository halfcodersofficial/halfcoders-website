"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { extractYoutubeId } from "@/lib/validation";

interface TestimonialVideoCardProps {
    videoUrl: string;
    name: string;
    designation: string | null;
}

/**
 * One video testimonial: a thumbnail carrying a play button that swaps to an
 * embedded player on click — same click-to-embed idea as `CoursePromoCard`,
 * kept as its own small component rather than shared, since the two have
 * different data (a course has one promo video with its own thumbnail; a
 * testimonial has neither, so this derives its thumbnail from the YouTube id).
 */
export default function TestimonialVideoCard({
    videoUrl,
    name,
    designation,
}: TestimonialVideoCardProps) {
    const [playing, setPlaying] = useState(false);
    const videoId = extractYoutubeId(videoUrl);

    if (!videoId) return null;

    return (
        <figure className="w-72 shrink-0 overflow-hidden rounded-card border border-border bg-card">
            <div className="relative aspect-video bg-black">
                {playing ? (
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                        title={`${name} — ভিডিও রিভিউ`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="size-full"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setPlaying(true)}
                        aria-label={`${name}-এর ভিডিও রিভিউ চালান`}
                        className="group absolute inset-0"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                            alt=""
                            aria-hidden
                            className="size-full object-cover"
                        />
                        <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/35">
                            <span className="grid size-12 place-items-center rounded-md bg-primary text-primary-foreground shadow-lg ring-4 ring-white/15 transition-transform group-hover:scale-105">
                                <Play className="ml-0.5 size-5 fill-current" />
                            </span>
                        </span>
                    </button>
                )}
            </div>
            <figcaption className="border-t border-border p-3">
                <p className="text-sm font-semibold">{name}</p>
                {designation && <p className="text-xs text-muted-foreground">{designation}</p>}
            </figcaption>
        </figure>
    );
}
