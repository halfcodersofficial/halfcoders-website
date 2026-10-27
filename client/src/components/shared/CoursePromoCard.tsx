"use client";

import { ChevronLeft, ChevronRight, ImageOff, Play, PlayCircle } from "lucide-react";
import { useRef, useState } from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { bnDigits, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { extractYoutubeId } from "@/lib/validation";

interface CoursePromoCardProps {
    title: string;
    /** The thumbnail, then the gallery — see `courseImagesOf`. */
    images: string[];
    promoVideoUrl: string | null;
    /** Skip `priority` in previews, where the image isn't above the fold. */
    priority?: boolean;
    /** Under the placeholder icon when the course has no image yet. */
    emptyLabel?: string;
}

/** `number` counts images only, so the video slide doesn't renumber the gallery. */
type Slide = { kind: "image"; src: string; number: number } | { kind: "video"; videoId: string };

/**
 * The media slot at the top of the purchase card.
 *
 * The promo video and the images are one slideshow: the video always first,
 * then the thumbnail and the rest of the gallery.
 * Swipe or scroll on touch (native scroll-snap), prev/next arrows and dots
 * everywhere — never on a timer, which would pull the picture out from under
 * someone reading it.
 *
 * The video slide shows YouTube's own poster, and the embed only mounts on
 * click: an autoplaying iframe on every course page would cost a YouTube
 * player download before the reader has decided they care. It plays inside
 * its slide, so the arrows still lead back to the images (a swipe over the
 * player goes to YouTube, not the track); moving off it unmounts the player,
 * which stops the sound.
 */
export default function CoursePromoCard({
    title,
    images,
    promoVideoUrl,
    priority = false,
    emptyLabel,
}: CoursePromoCardProps) {
    const t = useT();
    const [playing, setPlaying] = useState(false);
    const [index, setIndex] = useState(0);
    const trackRef = useRef<HTMLDivElement>(null);
    const videoId = promoVideoUrl ? extractYoutubeId(promoVideoUrl) : null;

    const slides: Slide[] = images.map((src, i) => ({ kind: "image", src, number: i + 1 }));
    if (videoId) slides.unshift({ kind: "video", videoId });
    const count = slides.length;
    // The admin preview can remove a slide from under the current one.
    const current = Math.min(index, count - 1);

    const renderSlide = (slide: Slide, position: number) => {
        if (slide.kind === "video") {
            if (playing) {
                return (
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${slide.videoId}?autoplay=1&rel=0&modestbranding=1`}
                        title={`${title} — introduction`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 size-full bg-black"
                    />
                );
            }
            return (
                <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    aria-label={t("Play the course introduction", "কোর্সের পরিচিতি ভিডিও চালান")}
                    className="group/play absolute inset-0 grid place-items-center bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
                >
                    <SafeImage
                        src={`https://img.youtube.com/vi/${slide.videoId}/hqdefault.jpg`}
                        alt=""
                        aria-hidden
                        fill
                        sizes="(max-width: 1024px) 100vw, 380px"
                        className="object-cover"
                        priority={priority}
                        wrapperClassName="absolute inset-0"
                        fallback={null}
                    />
                    <span className="absolute inset-0 bg-black/25 transition-colors group-hover/play:bg-black/35" />
                    <span className="relative grid size-14 place-items-center rounded-md bg-primary text-primary-foreground shadow-lg ring-4 ring-white/15 transition-transform group-hover/play:scale-105">
                        <Play className="ml-0.5 size-6 fill-current" />
                    </span>
                    <span className="absolute bottom-3 left-3 rounded-sm bg-editor/80 px-2 py-1 font-mono text-[0.7rem] text-editor-fg">
                        ▶ {t("intro.mp4", "পরিচিতি ভিডিও")}
                    </span>
                </button>
            );
        }

        return (
            <SafeImage
                src={slide.src}
                alt={slide.number === 1 ? title : t(`${title} — image ${slide.number}`, `${title} — ছবি ${bnDigits(slide.number)}`)}
                fill
                sizes="(max-width: 1024px) 100vw, 380px"
                className="object-cover"
                priority={priority && position === 0}
                fallback={<ImageOff className="size-10 text-muted-foreground" />}
            />
        );
    };

    if (count <= 1) {
        return (
            <div className="relative aspect-video bg-secondary">
                {count === 1 ? (
                    renderSlide(slides[0], 0)
                ) : (
                    <div className="grid size-full place-items-center text-center">
                        <div>
                            <PlayCircle className="mx-auto size-12 text-muted-foreground" />
                            {emptyLabel && <p className="mt-1 text-xs text-muted-foreground">{emptyLabel}</p>}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const goTo = (next: number) => {
        const track = trackRef.current;
        if (!track) return;
        const target = (next + count) % count;
        track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
    };

    return (
        <div
            className="relative aspect-video bg-secondary"
            role="region"
            aria-roledescription="carousel"
            aria-label={t(`${title} — images and video`, `${title} — ছবি ও ভিডিও`)}
        >
            <div
                ref={trackRef}
                onScroll={(event) => {
                    const track = event.currentTarget;
                    const next = Math.round(track.scrollLeft / track.clientWidth);
                    setIndex(next);
                    if (slides[next]?.kind !== "video") setPlaying(false);
                }}
                className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
            >
                {slides.map((slide, position) => (
                    <div
                        key={slide.kind === "video" ? "video" : slide.src}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={t(`${position + 1} of ${count}`, `${bnDigits(count)}টির মধ্যে ${bnDigits(position + 1)}`)}
                        className="relative size-full shrink-0 snap-center"
                    >
                        {renderSlide(slide, position)}
                    </div>
                ))}
            </div>

            <SlideArrow side="left" label={t("Previous", "আগেরটি")} onClick={() => goTo(current - 1)} />
            <SlideArrow side="right" label={t("Next", "পরেরটি")} onClick={() => goTo(current + 1)} />

            {/* Bottom-right, level with the video slide's "Watch the introduction". */}
            <div className="absolute bottom-3 right-3 flex h-6 items-center gap-1.5 rounded-sm bg-editor/60 px-2">
                {slides.map((slide, position) => {
                    const active = position === current;
                    return slide.kind === "video" ? (
                        <button
                            key="video"
                            type="button"
                            onClick={() => goTo(position)}
                            aria-label={t("Show the introduction video", "পরিচিতি ভিডিও দেখান")}
                            aria-current={active ? "true" : undefined}
                            className={cn(
                                "grid place-items-center rounded-full drop-shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                                active ? "text-white" : "text-white/60 hover:text-white/80",
                            )}
                        >
                            <Play className="size-2.5 fill-current" />
                        </button>
                    ) : (
                        <button
                            key={slide.src}
                            type="button"
                            onClick={() => goTo(position)}
                            aria-label={t(
                                `Show image ${slide.number} of ${images.length}`,
                                `${bnDigits(images.length)}টির মধ্যে ${bnDigits(slide.number)} নম্বর ছবি দেখান`,
                            )}
                            aria-current={active ? "true" : undefined}
                            className={cn(
                                "h-1.5 rounded-[1px] shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                                active ? "w-4 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80",
                            )}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function SlideArrow({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
    const Icon = side === "left" ? ChevronLeft : ChevronRight;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
                "absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md bg-editor/60 text-white shadow transition-colors hover:bg-editor/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                side === "left" ? "left-2" : "right-2",
            )}
        >
            <Icon className="size-5" />
        </button>
    );
}
