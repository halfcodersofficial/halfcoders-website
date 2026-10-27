"use client";

import { ChevronLeft, ChevronRight, ImageOff, ImagePlus, RefreshCw, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useField } from "@/components/ui/form";
import { ImageCropModal } from "@/components/ui/image-crop";
import { Progress } from "@/components/ui/progress";
import { SafeImage } from "@/components/ui/safe-image";
import { getApiErrorMessage } from "@/lib/httpClient";
import { bnMessage, useDigits, useT, useUiLanguage } from "@/lib/i18n";
import {
    COURSE_IMAGE_ACCEPT,
    COURSE_IMAGE_ASPECT,
    COURSE_IMAGE_WIDTH,
    MAX_COURSE_IMAGES,
    validateCourseImage,
} from "@/lib/courseImages";
import { cn } from "@/lib/utils";
import { curriculumAuthoring } from "@/services/curriculum";

/** An image on its way up: shown from the local crop until its URL comes back. */
interface Upload {
    key: number;
    preview: string;
    progress: number;
    /** The saved image this one replaces, or null for a new one. */
    replaces: string | null;
}

/**
 * The course's images as a form control inside `FormField`: the thumbnail
 * first, then up to five more, each cropped to 16:9 before it uploads.
 *
 * An image uploads the moment its crop is confirmed, and its URL joins the
 * field's value when the upload lands; the course only changes when the form
 * is saved (and a save that drops an image deletes it on the server).
 */
export function CourseImagesField({ courseId }: { courseId: string }) {
    const field = useField();
    const t = useT();
    const lang = useUiLanguage();
    const digits = useDigits();
    const images = Array.isArray(field?.value) ? (field.value as string[]) : [];

    // Uploads finish in any order and after any number of renders, so each
    // writes against the latest list, not the one it started with.
    const latest = useRef(images);
    latest.current = images;
    const write = (next: string[]) => {
        latest.current = next;
        field?.setValue(next);
    };

    const inputRef = useRef<HTMLInputElement>(null);
    const nextKey = useRef(0);
    const [uploads, setUploads] = useState<Upload[]>([]);
    const [crop, setCrop] = useState<{ src: string; replaces: string | null } | null>(null);
    // Which saved image the next picked file replaces, if any.
    const replaceTarget = useRef<string | null>(null);

    // Object URLs live until the tab closes unless revoked.
    const previews = useRef(new Set<string>());
    useEffect(() => {
        const urls = previews.current;
        return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }, []);

    const adding = uploads.filter((upload) => upload.replaces === null).length;
    const canAdd = images.length + adding < MAX_COURSE_IMAGES;

    const pick = (replaces: string | null) => {
        replaceTarget.current = replaces;
        inputRef.current?.click();
    };

    const onFile = (file: File) => {
        const error = validateCourseImage(file);
        if (error) {
            toast.error(lang === "bn" ? bnMessage(error) : error);
            return;
        }
        setCrop({ src: URL.createObjectURL(file), replaces: replaceTarget.current });
    };

    const closeCrop = () =>
        setCrop((current) => {
            if (current) URL.revokeObjectURL(current.src);
            return null;
        });

    const upload = async (blob: Blob, replaces: string | null) => {
        const key = nextKey.current++;
        const preview = URL.createObjectURL(blob);
        previews.current.add(preview);
        setUploads((current) => [...current, { key, preview, progress: 0, replaces }]);

        const finish = () => {
            setUploads((current) => current.filter((item) => item.key !== key));
            URL.revokeObjectURL(preview);
            previews.current.delete(preview);
        };

        try {
            const url = await curriculumAuthoring.uploadCourseImage(courseId, blob, (progress) =>
                setUploads((current) => current.map((item) => (item.key === key ? { ...item, progress } : item))),
            );
            const list = latest.current;
            // A replaced image moved or removed meanwhile: keep the new one anyway, at the end.
            write(replaces !== null && list.includes(replaces)
                ? list.map((image) => (image === replaces ? url : image))
                : [...list, url].slice(0, MAX_COURSE_IMAGES));
        } catch (error) {
            toast.error(getApiErrorMessage(error, t("Couldn't upload that image.", "ছবিটি আপলোড করা যায়নি।")));
        } finally {
            finish();
        }
    };

    const onCropped = (blob: Blob) => {
        const replaces = crop?.replaces ?? null;
        closeCrop();
        void upload(blob, replaces);
    };

    const move = (from: number, to: number) => {
        const next = [...images];
        const [image] = next.splice(from, 1);
        next.splice(to, 0, image);
        write(next);
    };

    const remove = (index: number) => write(images.filter((_, i) => i !== index));

    const pendingNew = uploads.filter((item) => item.replaces === null);

    return (
        <div className="space-y-2">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((image, index) => {
                    const replacing = uploads.find((item) => item.replaces === image);
                    const label =
                        index === 0 ? t("thumbnail", "থাম্বনেইল") : t(`image ${index + 1}`, `${digits(index + 1)} নম্বর ছবি`);

                    return (
                        <li
                            key={image}
                            className={cn(
                                "group relative aspect-video overflow-hidden rounded-lg border bg-secondary",
                                index === 0 ? "border-primary ring-1 ring-primary" : "border-border",
                            )}
                        >
                            {replacing ? (
                                <UploadingPreview upload={replacing} />
                            ) : (
                                <SafeImage
                                    src={image}
                                    alt={label}
                                    fill
                                    sizes="240px"
                                    className="object-cover"
                                    fallback={<ImageOff className="size-6 text-muted-foreground" />}
                                />
                            )}

                            <span
                                className={cn(
                                    "absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                                    index === 0 ? "bg-primary text-primary-foreground" : "bg-black/60 text-white",
                                )}
                            >
                                {index === 0 ? t("Thumbnail", "থাম্বনেইল") : digits(index + 1)}
                            </span>

                            {!replacing && (
                                <div className="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-linear-to-t from-black/70 to-transparent px-1 pb-1 pt-4">
                                    <TileButton
                                        label={t(`Move ${label} earlier`, `${label} আগে নিন`)}
                                        disabled={index === 0}
                                        onClick={() => move(index, index - 1)}
                                    >
                                        <ChevronLeft />
                                    </TileButton>
                                    <TileButton
                                        label={t(`Move ${label} later`, `${label} পরে নিন`)}
                                        disabled={index === images.length - 1}
                                        onClick={() => move(index, index + 1)}
                                    >
                                        <ChevronRight />
                                    </TileButton>
                                    {index > 0 && (
                                        <TileButton
                                            label={t(`Make image ${index + 1} the thumbnail`, `${label} থাম্বনেইল করুন`)}
                                            onClick={() => move(index, 0)}
                                        >
                                            <Star />
                                        </TileButton>
                                    )}
                                    <span className="flex-1" />
                                    <TileButton label={t(`Replace ${label}`, `${label} বদলান`)} onClick={() => pick(image)}>
                                        <RefreshCw />
                                    </TileButton>
                                    <TileButton
                                        label={t(`Remove ${label}`, `${label} সরান`)}
                                        // The thumbnail is required: the last image can be
                                        // replaced, not removed.
                                        disabled={images.length === 1}
                                        onClick={() => remove(index)}
                                        destructive
                                    >
                                        <Trash2 />
                                    </TileButton>
                                </div>
                            )}
                        </li>
                    );
                })}

                {pendingNew.map((item) => (
                    <li key={item.key} className="relative aspect-video overflow-hidden rounded-lg border border-border bg-secondary">
                        <UploadingPreview upload={item} />
                    </li>
                ))}

                {canAdd && (
                    <li>
                        <button
                            type="button"
                            id={field?.id}
                            onClick={() => pick(null)}
                            aria-describedby={field?.describedBy}
                            className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ImagePlus className="size-5" />
                            {images.length + pendingNew.length === 0
                                ? t("Add the thumbnail", "থাম্বনেইল যোগ করুন")
                                : t("Add image", "ছবি যোগ করুন")}
                        </button>
                    </li>
                )}
            </ul>

            <p className="text-xs text-muted-foreground">
                {t(
                    `${images.length + pendingNew.length} / ${MAX_COURSE_IMAGES} images`,
                    `${digits(images.length + pendingNew.length)} / ${digits(MAX_COURSE_IMAGES)}টি ছবি`,
                )}
            </p>

            <input
                ref={inputRef}
                type="file"
                accept={COURSE_IMAGE_ACCEPT}
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) onFile(file);
                }}
            />

            <ImageCropModal
                src={crop?.src ?? null}
                aspect={COURSE_IMAGE_ASPECT}
                outputWidth={COURSE_IMAGE_WIDTH}
                title={crop?.replaces ? t("Replace image", "ছবি বদলান") : t("Add image", "ছবি যোগ করুন")}
                confirmLabel={t("Upload", "আপলোড করুন")}
                onCancel={closeCrop}
                onConfirm={onCropped}
            />
        </div>
    );
}

function UploadingPreview({ upload }: { upload: Upload }) {
    const t = useT();
    const digits = useDigits();
    return (
        <>
            {/* A local blob: URL, so a plain <img> rather than the optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={upload.preview} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
            <div className="absolute inset-x-2 bottom-2 space-y-1">
                <p className="text-xs font-medium text-white drop-shadow">
                    {t("Uploading…", "আপলোড হচ্ছে…")} {digits(upload.progress)}%
                </p>
                <Progress value={upload.progress} className="h-1.5" />
            </div>
        </>
    );
}

function TileButton({
    label,
    onClick,
    disabled = false,
    destructive = false,
    children,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    destructive?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={cn(
                "grid size-7 place-items-center rounded-md text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4",
                destructive ? "hover:bg-destructive" : "hover:bg-white/20",
            )}
        >
            {children}
        </button>
    );
}
