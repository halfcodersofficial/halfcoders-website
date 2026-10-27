"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ZoomIn } from "lucide-react";
import {
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { getApiErrorMessage } from "@/lib/httpClient";
import { authService } from "@/services";
import type { CurrentUser } from "@/types/domain.types";

// The picked file never leaves the browser as-is: the crop step redraws it as
// a 512px JPEG (well under the server's 5 MB), so a phone camera's full-size
// photo is fine here. The cap only stops a huge file stalling the tab.
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const VIEWPORT_SIZE = 280; // the square crop window shown in the dialog, in css px
const OUTPUT_SIZE = 512; // the exported square photo, in px
const MAX_ZOOM = 3;

/**
 * Every role's "Profile photo" field (My Profile for a student, the profile
 * page for staff): a preview thumbnail next to a file picker, opening an
 * optional crop-and-zoom step before the photo uploads to
 * `PATCH /auth/me/avatar`. It saves on its own, outside any form around it.
 */
export function ProfilePhotoField({ src, name }: { src: string | null; name: string }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const [preview, setPreview] = useState<string | null>(null);
    const [cropSrc, setCropSrc] = useState<string | null>(null);

    // Object URLs are only good for this tab's lifetime — drop the old one
    // whenever a new preview replaces it, or on unmount.
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const upload = useMutation({
        mutationFn: (file: File) => authService.updateAvatar(file),
        onSuccess: (updated) => {
            queryClient.setQueryData<CurrentUser | null>(SESSION_QUERY_KEY, (current) =>
                current ? { ...current, image: updated.image } : current,
            );
            queryClient.invalidateQueries({ queryKey: ["student-profile", "overview"] });
            toast.success("Profile photo updated.");
        },
        onError: (error) => {
            toast.error(getApiErrorMessage(error, "Couldn't update your photo."));
            setPreview(null);
        },
    });

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
            toast.error("Use a JPEG, PNG or WebP image.");
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            toast.error("That image is too large. Pick one under 15 MB.");
            return;
        }

        setCropSrc(URL.createObjectURL(file));
    };

    const closeCrop = () => {
        setCropSrc((current) => {
            if (current) URL.revokeObjectURL(current);
            return null;
        });
    };

    const onCropped = (blob: Blob) => {
        const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        setPreview((current) => {
            if (current) URL.revokeObjectURL(current);
            return URL.createObjectURL(file);
        });
        closeCrop();
        upload.mutate(file);
    };

    return (
        <div className="space-y-1.5 sm:col-span-2">
            <Label>Profile photo</Label>
            <div className="flex items-center gap-4">
                <Avatar src={preview ?? src} name={name} size={64} className="shrink-0 ring-2 ring-border" />
                <div className="space-y-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                        isLoading={upload.isPending}
                    >
                        <Camera className="size-3.5" /> {preview ?? src ? "Change photo" : "Add a photo"}
                    </Button>
                    <p className="text-xs text-muted-foreground">JPEG, PNG or WebP. You can crop it before it&apos;s saved.</p>
                </div>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onChange}
            />

            {cropSrc && <CropDialog src={cropSrc} onCancel={closeCrop} onConfirm={onCropped} />}
        </div>
    );
}

interface Point {
    x: number;
    y: number;
}

/**
 * A minimal drag-to-reposition, slide-to-zoom cropper: no library, just a
 * source `<img>` positioned absolutely inside a clipped square viewport and a
 * canvas export that reads back the same transform to cut the final photo.
 */
function CropDialog({
    src,
    onCancel,
    onConfirm,
}: {
    src: string;
    onCancel: () => void;
    onConfirm: (blob: Blob) => void;
}) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const naturalSize = useRef({ w: 0, h: 0 });
    const dragRef = useRef<{ start: Point; origin: Point } | null>(null);

    const [ready, setReady] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pos, setPos] = useState<Point>({ x: 0, y: 0 });
    const [exporting, setExporting] = useState(false);

    const baseScale = () => {
        const { w, h } = naturalSize.current;
        if (!w || !h) return 1;
        return Math.max(VIEWPORT_SIZE / w, VIEWPORT_SIZE / h);
    };

    const clamp = (next: Point, scale: number): Point => {
        const { w, h } = naturalSize.current;
        const minX = Math.min(0, VIEWPORT_SIZE - w * scale);
        const minY = Math.min(0, VIEWPORT_SIZE - h * scale);
        return {
            x: Math.min(0, Math.max(minX, next.x)),
            y: Math.min(0, Math.max(minY, next.y)),
        };
    };

    const onImageLoad = () => {
        const img = imgRef.current;
        if (!img) return;
        naturalSize.current = { w: img.naturalWidth, h: img.naturalHeight };
        const scale = baseScale();
        setPos({
            x: (VIEWPORT_SIZE - img.naturalWidth * scale) / 2,
            y: (VIEWPORT_SIZE - img.naturalHeight * scale) / 2,
        });
        setZoom(1);
        setReady(true);
    };

    const scale = baseScale() * zoom;

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { start: { x: event.clientX, y: event.clientY }, origin: pos };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        const dx = event.clientX - dragRef.current.start.x;
        const dy = event.clientY - dragRef.current.start.y;
        setPos(clamp({ x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy }, scale));
    };

    const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        dragRef.current = null;
    };

    const onZoomChange = (next: number) => {
        setZoom(next);
        setPos((current) => clamp(current, baseScale() * next));
    };

    const confirm = () => {
        const img = imgRef.current;
        if (!img || !ready) return;

        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        setExporting(true);
        // JPEG has no transparency: without a ground, a transparent PNG's
        // clear pixels come out black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        const srcSize = VIEWPORT_SIZE / scale;
        ctx.drawImage(img, -pos.x / scale, -pos.y / scale, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

        canvas.toBlob(
            (blob) => {
                setExporting(false);
                if (blob) onConfirm(blob);
            },
            "image/jpeg",
            0.92,
        );
    };

    return (
        <Modal open onOpenChange={(open) => !open && onCancel()} size="sm" title="Adjust Photo" closeOnOutsideClick={false}>
            <ModalBody>
                <div
                    className="relative mx-auto touch-none select-none overflow-hidden rounded-full border border-border bg-secondary"
                    style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                >
                    {/* Raw <img>, not next/image — the crop export reads pixels straight off this element via canvas. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        ref={imgRef}
                        src={src}
                        alt="Crop preview"
                        draggable={false}
                        onLoad={onImageLoad}
                        className="pointer-events-none absolute max-w-none"
                        style={{
                            left: pos.x,
                            top: pos.y,
                            width: naturalSize.current.w * scale || undefined,
                            height: naturalSize.current.h * scale || undefined,
                            opacity: ready ? 1 : 0,
                        }}
                    />
                </div>

                <div className="mt-4 flex items-center gap-3">
                    <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <input
                        type="range"
                        min={1}
                        max={MAX_ZOOM}
                        step={0.01}
                        value={zoom}
                        disabled={!ready}
                        onChange={(event) => onZoomChange(Number(event.target.value))}
                        className="w-full accent-primary"
                        aria-label="Zoom"
                    />
                </div>

                <p className="mt-2 text-center text-xs text-muted-foreground">
                    Drag to reposition — or leave it as-is and save.
                </p>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="button" onClick={confirm} isLoading={exporting} disabled={!ready}>
                    Save Photo
                </Button>
            </ModalFooter>
        </Modal>
    );
}
