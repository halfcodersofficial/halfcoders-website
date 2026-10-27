"use client";

import { Check, Minus, Plus, RotateCcw } from "lucide-react";
import {
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useT } from "@/lib/i18n";

const MAX_ZOOM = 4;
const ZOOM_STEP = 1.15;

interface Point {
    x: number;
    y: number;
}

interface ImageCropModalProps {
    /** Object URL of the picked file. `null` keeps the modal closed. */
    src: string | null;
    /** Width over height of the result — 16 / 9 for a course image. */
    aspect: number;
    /** Width of the exported image in px; the height follows from `aspect`. */
    outputWidth: number;
    title?: string;
    confirmLabel?: string;
    onCancel: () => void;
    /** The crop, as a JPEG. */
    onConfirm: (image: Blob) => void;
}

/**
 * Crop a picked image to a fixed shape before it uploads. The frame always
 * shows exactly what will be saved: drag to reposition, zoom with the slider,
 * the wheel or +/−, or keep the centred crop it opens with.
 *
 * No library — the same approach as the profile photo cropper: the image sits
 * absolutely inside a clipped frame, and the export reads the same transform
 * back onto a canvas.
 */
export function ImageCropModal({
    src,
    aspect,
    outputWidth,
    title,
    confirmLabel,
    onCancel,
    onConfirm,
}: ImageCropModalProps) {
    const t = useT();
    return (
        <Modal
            open={src !== null}
            onOpenChange={(open) => !open && onCancel()}
            closeOnOutsideClick={false}
            title={title ?? t("Adjust image", "ছবি ঠিক করুন")}
            description={t(
                "Drag to reposition and zoom to crop tighter — or keep it as it is.",
                "টেনে জায়গা বদলান, জুম করে আরও কাছ থেকে কাটুন — অথবা যেমন আছে তেমনই রাখুন।",
            )}
        >
            {src && (
                <Cropper
                    src={src}
                    aspect={aspect}
                    outputWidth={outputWidth}
                    confirmLabel={confirmLabel ?? t("Use image", "ছবিটি নিন")}
                    onCancel={onCancel}
                    onConfirm={onConfirm}
                />
            )}
        </Modal>
    );
}

function Cropper({
    src,
    aspect,
    outputWidth,
    confirmLabel,
    onCancel,
    onConfirm,
}: Omit<ImageCropModalProps, "src" | "title"> & { src: string; confirmLabel: string }) {
    const t = useT();
    const frameRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const dragRef = useRef<{ pointer: Point; center: Point } | null>(null);

    const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
    const [failed, setFailed] = useState(false);
    const [frameWidth, setFrameWidth] = useState(0);
    const [zoom, setZoom] = useState(1);
    // The point of the image, in its own pixels, that sits at the frame's centre.
    const [center, setCenter] = useState<Point>({ x: 0, y: 0 });
    const [exporting, setExporting] = useState(false);

    // The frame is as wide as the popup allows, so it's measured, not fixed.
    useEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;
        const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width));
        observer.observe(frame);
        return () => observer.disconnect();
    }, []);

    const frameHeight = frameWidth / aspect;
    // Zoom 1 is "cover": the image just fills the frame on its tighter side.
    const baseScale = natural && frameWidth ? Math.max(frameWidth / natural.w, frameHeight / natural.h) : 1;
    const scale = baseScale * zoom;

    /** Keeps the frame inside the image, so the crop never shows past its edge. */
    const clamp = (point: Point, atScale: number): Point => {
        if (!natural || !frameWidth) return point;
        const halfW = frameWidth / 2 / atScale;
        const halfH = frameHeight / 2 / atScale;
        return {
            x: Math.min(natural.w - halfW, Math.max(halfW, point.x)),
            y: Math.min(natural.h - halfH, Math.max(halfH, point.y)),
        };
    };

    // Clamped on read as well, since zooming out or a narrower frame can push
    // a stored centre out of range.
    const shown = clamp(center, scale);
    const ready = natural !== null && frameWidth > 0;

    const setZoomClamped = (next: number) => setZoom(Math.min(MAX_ZOOM, Math.max(1, next)));

    // Wheel zoom needs a non-passive listener to keep the page from scrolling;
    // React registers `onWheel` as passive.
    useEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            setZoom((current) =>
                Math.min(MAX_ZOOM, Math.max(1, event.deltaY < 0 ? current * ZOOM_STEP : current / ZOOM_STEP)),
            );
        };
        frame.addEventListener("wheel", onWheel, { passive: false });
        return () => frame.removeEventListener("wheel", onWheel);
    }, []);

    const onImageLoad = () => {
        const image = imageRef.current;
        if (!image) return;
        setNatural({ w: image.naturalWidth, h: image.naturalHeight });
        setCenter({ x: image.naturalWidth / 2, y: image.naturalHeight / 2 });
        setZoom(1);
    };

    const reset = () => {
        if (!natural) return;
        setCenter({ x: natural.w / 2, y: natural.h / 2 });
        setZoom(1);
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!ready) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointer: { x: event.clientX, y: event.clientY }, center: shown };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        setCenter(
            clamp(
                {
                    x: drag.center.x - (event.clientX - drag.pointer.x) / scale,
                    y: drag.center.y - (event.clientY - drag.pointer.y) / scale,
                },
                scale,
            ),
        );
    };

    const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
    };

    // Arrows nudge (Shift for bigger steps), + and − zoom — the frame is
    // focusable, so the crop never needs a pointer.
    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!ready) return;
        const step = (event.shiftKey ? 50 : 10) / scale;
        const moves: Record<string, Point> = {
            ArrowLeft: { x: -step, y: 0 },
            ArrowRight: { x: step, y: 0 },
            ArrowUp: { x: 0, y: -step },
            ArrowDown: { x: 0, y: step },
        };
        if (moves[event.key]) {
            event.preventDefault();
            setCenter(clamp({ x: shown.x + moves[event.key].x, y: shown.y + moves[event.key].y }, scale));
        } else if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            setZoomClamped(zoom * ZOOM_STEP);
        } else if (event.key === "-" || event.key === "_") {
            event.preventDefault();
            setZoomClamped(zoom / ZOOM_STEP);
        }
    };

    const confirm = () => {
        const image = imageRef.current;
        if (!image || !ready) return;

        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = Math.round(outputWidth / aspect);
        const context = canvas.getContext("2d");
        if (!context) return;

        // JPEG has no transparency — a transparent PNG would otherwise turn black.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingQuality = "high";

        const sourceW = frameWidth / scale;
        const sourceH = frameHeight / scale;
        context.drawImage(
            image,
            shown.x - sourceW / 2,
            shown.y - sourceH / 2,
            sourceW,
            sourceH,
            0,
            0,
            canvas.width,
            canvas.height,
        );

        setExporting(true);
        canvas.toBlob(
            (blob) => {
                setExporting(false);
                if (blob) onConfirm(blob);
            },
            "image/jpeg",
            0.9,
        );
    };

    return (
        <>
            <ModalBody className="space-y-4">
                <div
                    ref={frameRef}
                    role="application"
                    tabIndex={0}
                    aria-label={t(
                        "Crop area. Drag or use the arrow keys to reposition; plus and minus to zoom.",
                        "ছবি কাটার জায়গা। টেনে বা অ্যারো কী দিয়ে সরান; প্লাস ও মাইনাস দিয়ে জুম করুন।",
                    )}
                    className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-lg bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:cursor-grabbing"
                    style={{ aspectRatio: aspect }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={onKeyDown}
                >
                    {/* Raw <img>, not next/image — the export reads its pixels onto a canvas. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        ref={imageRef}
                        src={src}
                        alt={t("Image being cropped", "যে ছবিটি কাটা হচ্ছে")}
                        draggable={false}
                        onLoad={onImageLoad}
                        onError={() => setFailed(true)}
                        className="pointer-events-none absolute max-w-none"
                        style={
                            ready
                                ? {
                                    left: frameWidth / 2 - shown.x * scale,
                                    top: frameHeight / 2 - shown.y * scale,
                                    width: natural.w * scale,
                                    height: natural.h * scale,
                                }
                                : { opacity: 0 }
                        }
                    />

                    {/* Rule-of-thirds guides. */}
                    {ready && (
                        <div aria-hidden className="pointer-events-none absolute inset-0">
                            <div className="absolute inset-y-0 left-1/3 border-l border-white/40" />
                            <div className="absolute inset-y-0 left-2/3 border-l border-white/40" />
                            <div className="absolute inset-x-0 top-1/3 border-t border-white/40" />
                            <div className="absolute inset-x-0 top-2/3 border-t border-white/40" />
                        </div>
                    )}

                    {failed && (
                        <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted-foreground">
                            {t(
                                "That file couldn't be read as an image. Try another one.",
                                "ফাইলটি ছবি হিসেবে পড়া যায়নি। অন্য একটি চেষ্টা করুন।",
                            )}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 shrink-0 p-0"
                        onClick={() => setZoomClamped(zoom / ZOOM_STEP)}
                        disabled={!ready || zoom <= 1}
                        aria-label={t("Zoom out", "ছোট করুন")}
                    >
                        <Minus />
                    </Button>
                    <input
                        type="range"
                        min={1}
                        max={MAX_ZOOM}
                        step={0.01}
                        value={zoom}
                        disabled={!ready}
                        onChange={(event) => setZoomClamped(Number(event.target.value))}
                        className="w-full accent-primary"
                        aria-label={t("Zoom", "জুম")}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 shrink-0 p-0"
                        onClick={() => setZoomClamped(zoom * ZOOM_STEP)}
                        disabled={!ready || zoom >= MAX_ZOOM}
                        aria-label={t("Zoom in", "বড় করুন")}
                    >
                        <Plus />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!ready}>
                        <RotateCcw /> {t("Reset", "রিসেট")}
                    </Button>
                </div>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    {t("Cancel", "বাতিল")}
                </Button>
                <Button type="button" onClick={confirm} isLoading={exporting} disabled={!ready}>
                    <Check /> {confirmLabel}
                </Button>
            </ModalFooter>
        </>
    );
}
