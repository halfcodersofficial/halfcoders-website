import { BookOpen, Layers } from "lucide-react";
import Link from "next/link";
import { OpenLabel, THUMBNAIL_CHIP } from "@/components/shared/courseCardParts";
import { FileIcon } from "@/components/site/EditorWindow";
import { SafeImage } from "@/components/ui/safe-image";
import { cn, formatBDT } from "@/lib/utils";
import type { PublicBundle } from "@/types/domain.types";

const bnNumber = (value: number) => value.toLocaleString("bn-BD");

/** How much the bundle takes off buying its courses one by one, as a whole percentage. */
export const bundleSavingPercent = (bundle: PublicBundle) =>
    bundle.quote.combined > 0 ? Math.round((bundle.quote.savings / bundle.quote.combined) * 100) : 0;

/**
 * The bundle's picture: its own image, or the first four course thumbnails
 * tiled, so a bundle without artwork still shows what's in it.
 */
export function BundleArt({ bundle, sizes, className }: { bundle: PublicBundle; sizes: string; className?: string }) {
    if (bundle.thumbnail) {
        return (
            <div className={cn("relative aspect-video overflow-hidden bg-secondary", className)}>
                <SafeImage src={bundle.thumbnail} alt="" fill sizes={sizes} className="object-cover" fallback={<Layers className="size-10 text-muted-foreground" />} />
            </div>
        );
    }
    const tiles = bundle.courses.slice(0, 4);
    return (
        <div className={cn("grid aspect-video grid-cols-2 gap-0.5 overflow-hidden bg-border", className)}>
            {tiles.map((course) => (
                <div key={course.id} className={cn("relative bg-secondary", tiles.length === 2 && "row-span-2", tiles.length === 3 && "first:row-span-2")}>
                    <SafeImage
                        src={course.thumbnail}
                        alt=""
                        fill
                        sizes={sizes}
                        className="object-cover"
                        fallback={<BookOpen className="size-6 text-muted-foreground" />}
                    />
                </div>
            ))}
        </div>
    );
}

/**
 * A bundle on the bundles page, as a folder open in the editor: a strip
 * saying it's a bundle and how many courses, its courses tiled, how much it saves,
 * the first few course names as a file listing, and a footer with the price —
 * the viewer's own, when they already own part of it — against buying them
 * one by one, and "বিস্তারিত →".
 */
export default function BundleCard({ bundle }: { bundle: PublicBundle }) {
    const saving = bundleSavingPercent(bundle);
    const shown = bundle.courses.slice(0, 3);

    return (
        <Link
            href={`/bundles/${bundle.slug}`}
            lang="bn"
            className="group flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/50 hover:shadow-card-hover motion-reduce:transition-none"
        >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5 text-[0.72rem] font-medium text-muted-foreground">
                    <FileIcon name="bundle/" />
                    <span className="truncate">কোর্স বান্ডেল</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[0.72rem] font-semibold text-primary-ink">
                    <Layers className="size-3" aria-hidden />
                    {bnNumber(bundle.courses.length)}টি কোর্স
                </span>
            </div>

            <div className="relative">
                <BundleArt bundle={bundle} sizes="(max-width: 640px) 50vw, 15vw" />
                {saving > 0 && (
                    <span className={cn(THUMBNAIL_CHIP, "absolute right-2 top-2 border-transparent bg-success text-success-foreground")}>
                        -{bnNumber(saving)}% সাশ্রয়
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                <h3 className="line-clamp-2 text-[1.0625rem] font-semibold leading-snug transition-colors group-hover:text-primary">{bundle.title}</h3>
                {bundle.description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{bundle.description}</p>}
                <ul className="mt-3 space-y-1 border-l border-border pl-3">
                    {shown.map((course) => (
                        <li key={course.id} className="flex items-center gap-2 text-xs text-foreground/80">
                            <FileIcon name="course.md" />
                            <span className="truncate">{course.title}</span>
                        </li>
                    ))}
                    {bundle.courses.length > shown.length && (
                        <li className="font-mono text-[0.7rem] text-muted-foreground">+ আরও {bnNumber(bundle.courses.length - shown.length)}টি কোর্স</li>
                    )}
                </ul>
            </div>

            <div className="flex items-end justify-between gap-3 border-t border-border px-4 py-3">
                <span className="flex min-w-0 flex-col font-mono">
                    <span className="h-5 text-[0.7rem] text-muted-foreground line-through tabular-nums">{formatBDT(bundle.quote.combined)}</span>
                    <span className="text-lg font-semibold leading-tight tracking-tight tabular-nums">{formatBDT(bundle.quote.total)}</span>
                </span>
                <OpenLabel />
            </div>
        </Link>
    );
}
