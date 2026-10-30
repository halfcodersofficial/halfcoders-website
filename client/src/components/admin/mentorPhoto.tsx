"use client";

import { Camera, Check } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useField } from "@/components/ui/form";
import { ImageCropModal } from "@/components/ui/image-crop";
import { cn } from "@/lib/utils";
import { selectField } from "@/lib/validation";

/**
 * A mentor's photo: one the admin uploads, or a default avatar. Shared by the
 * create wizard (CreateMentorModal), where it's required, and the edit modal.
 *
 * The form holds the choice — "upload" for the photo in the first tile, or an
 * avatar — and the uploaded image itself lives in `usePhotoUpload`.
 */

/** Square, like every avatar. The cropper's export and the avatar render. */
const PHOTO_SIZE = 512;

/** The picked file, before cropping. What uploads is the much smaller export. */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const DEFAULT_AVATARS = {
    male: { label: "Male avatar", src: "/avatars/mentor-male.svg" },
    female: { label: "Female avatar", src: "/avatars/mentor-female.svg" },
} as const;

type DefaultAvatar = keyof typeof DEFAULT_AVATARS;

const isDefaultAvatar = (choice: string): choice is DefaultAvatar => choice in DEFAULT_AVATARS;

export const photoField = selectField("Upload a photo or choose an avatar");

export interface PhotoUpload {
    image: Blob;
    /** Object URL of `image`, for the previews. */
    preview: string;
}

/**
 * The photo behind the "upload" choice. Kept by the form rather than the
 * picker, which unmounts with its wizard step while the review still shows
 * the photo — and kept when an avatar is chosen after it, so the admin can
 * switch back.
 */
export function usePhotoUpload() {
    const [upload, setUpload] = useState<PhotoUpload | null>(null);
    const previewRef = useRef<string | null>(null);

    useEffect(
        () => () => {
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        },
        [],
    );

    const set = (image: Blob) => {
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = URL.createObjectURL(image);
        setUpload({ image, preview: previewRef.current });
    };

    return [upload, set] as const;
}

/** What the choice looks like: the uploaded photo (or the saved one), or the avatar. */
export const photoPreview = (choice: string, upload: PhotoUpload | null, current?: string | null) => {
    if (isDefaultAvatar(choice)) return DEFAULT_AVATARS[choice].src;
    if (choice === "upload") return upload?.preview ?? current ?? null;
    return null;
};

/** The choice in words, for a review. */
export const photoLabel = (choice: string) =>
    isDefaultAvatar(choice) ? DEFAULT_AVATARS[choice].label : choice === "upload" ? "Uploaded photo" : "None";

/** Whether saving uploads a photo. False keeps the saved one, if there is one. */
export const choosesNewPhoto = (choice: string, upload: PhotoUpload | null) =>
    isDefaultAvatar(choice) || (choice === "upload" && upload !== null);

/**
 * The image to upload for a choice that `choosesNewPhoto`. An avatar is drawn
 * to a JPEG: the API stores photos, not SVG, and each mentor gets their own
 * copy, so replacing one mentor's photo never deletes another's.
 */
export async function photoImage(choice: string, upload: PhotoUpload | null): Promise<Blob> {
    if (isDefaultAvatar(choice)) return renderAvatar(choice);
    if (upload) return upload.image;
    throw new Error("No photo was chosen.");
}

const renderAvatar = (avatar: DefaultAvatar) =>
    new Promise<Blob>((resolve, reject) => {
        const failed = () => reject(new Error("Couldn't prepare the avatar. Try again."));
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = PHOTO_SIZE;
            canvas.height = PHOTO_SIZE;
            const context = canvas.getContext("2d");
            if (!context) return failed();
            context.drawImage(image, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
            canvas.toBlob((blob) => (blob ? resolve(blob) : failed()), "image/jpeg", 0.92);
        };
        image.onerror = failed;
        image.src = DEFAULT_AVATARS[avatar].src;
    });

interface MentorPhotoPickerProps {
    upload: PhotoUpload | null;
    onUpload: (image: Blob) => void;
    /** The saved photo, shown in the first tile until a new one is uploaded. */
    current?: string | null;
    disabled?: boolean;
}

/**
 * The photo control for a `FormField`: the uploaded (or saved) photo and the
 * two default avatars as one set of radios, and a picker that crops the
 * chosen file to a square before it counts as uploaded.
 */
export function MentorPhotoPicker({ upload, onUpload, current, disabled }: MentorPhotoPickerProps) {
    const field = useField();
    const inputRef = useRef<HTMLInputElement>(null);
    const [cropSource, setCropSource] = useState<string | null>(null);

    const photo = upload?.preview ?? current ?? null;
    const choice = typeof field?.value === "string" ? field.value : "";
    const choose = (next: string) => {
        field?.setValue(next);
        field?.onBlur();
    };

    const onFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
            toast.error("Choose a JPEG, PNG or WebP image.");
            return;
        }
        if (file.size > MAX_SOURCE_BYTES) {
            toast.error("Image must be 10 MB or smaller.");
            return;
        }
        setCropSource(URL.createObjectURL(file));
    };

    const closeCrop = () => {
        setCropSource((source) => {
            if (source) URL.revokeObjectURL(source);
            return null;
        });
    };

    const onCropped = (image: Blob) => {
        closeCrop();
        onUpload(image);
        choose("upload");
    };

    const pick = () => inputRef.current?.click();

    return (
        <div className="space-y-2">
            <div
                id={field?.id}
                role="radiogroup"
                tabIndex={-1}
                aria-label="Photo"
                aria-describedby={field?.describedBy}
                aria-invalid={field?.error ? true : undefined}
                className="grid grid-cols-3 gap-2 outline-none sm:gap-3"
            >
                {photo ? (
                    <PhotoOption
                        name={field?.id}
                        label={upload ? "Uploaded photo" : "Current photo"}
                        src={photo}
                        checked={choice === "upload"}
                        onSelect={() => choose("upload")}
                        disabled={disabled}
                        invalid={Boolean(field?.error)}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={pick}
                        disabled={disabled}
                        className={cn(
                            "flex flex-col items-center gap-2 rounded-md border border-dashed p-3 text-center text-xs font-medium text-primary transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                            field?.error ? "border-destructive/60" : "border-border hover:border-primary/40",
                        )}
                    >
                        <span className="grid size-16 place-items-center rounded-full bg-secondary sm:size-20">
                            <Camera className="size-6 text-muted-foreground" aria-hidden />
                        </span>
                        Upload photo
                    </button>
                )}

                {(Object.keys(DEFAULT_AVATARS) as DefaultAvatar[]).map((avatar) => (
                    <PhotoOption
                        key={avatar}
                        name={field?.id}
                        label={DEFAULT_AVATARS[avatar].label}
                        src={DEFAULT_AVATARS[avatar].src}
                        checked={choice === avatar}
                        onSelect={() => choose(avatar)}
                        disabled={disabled}
                        invalid={Boolean(field?.error)}
                    />
                ))}
            </div>

            {photo && (
                <Button type="button" variant="ghost" size="sm" onClick={pick} disabled={disabled}>
                    <Camera /> {upload ? "Replace photo" : "Upload a new photo"}
                </Button>
            )}

            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={onFile}
            />

            <ImageCropModal
                src={cropSource}
                aspect={1}
                outputWidth={PHOTO_SIZE}
                title="Adjust photo"
                confirmLabel="Use photo"
                onCancel={closeCrop}
                onConfirm={onCropped}
            />
        </div>
    );
}

interface PhotoOptionProps {
    name?: string;
    label: string;
    src: string;
    checked: boolean;
    onSelect: () => void;
    disabled?: boolean;
    invalid?: boolean;
}

/** One tile: a native radio, so arrow keys move between tiles for free. */
function PhotoOption({ name, label, src, checked, onSelect, disabled, invalid }: PhotoOptionProps) {
    return (
        <label
            className={cn(
                "relative flex cursor-pointer flex-col items-center gap-2 rounded-md border p-3 text-center text-xs font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                checked
                    ? "border-primary bg-primary/5 text-foreground"
                    : cn(
                        "text-muted-foreground hover:border-primary/40 hover:bg-secondary/50",
                        invalid ? "border-destructive/60" : "border-border",
                    ),
                disabled && "pointer-events-none opacity-50",
            )}
        >
            <input
                type="radio"
                name={name}
                checked={checked}
                onChange={onSelect}
                disabled={disabled}
                className="sr-only"
            />
            {/* A blob: preview, a local SVG or a stored photo — a plain <img> for all three. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-16 rounded-full object-cover sm:size-20" />
            {label}
            {checked && (
                <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" aria-hidden />
                </span>
            )}
        </label>
    );
}
