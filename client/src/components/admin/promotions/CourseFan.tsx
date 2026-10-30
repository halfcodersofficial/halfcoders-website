import { BookOpen } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

/** Courses as a fan of covers, the first on top — a bundle's, or what an offer gives. */
export default function CourseFan({
    courses,
    max = 5,
    className,
}: {
    courses: { id: string; title: string; thumbnail: string | null }[];
    /** How many covers it shows before it says "+N". */
    max?: number;
    className?: string;
}) {
    const shown = courses.slice(0, max);
    const more = courses.length - shown.length;
    return (
        <div className={cn("flex items-center", className)} aria-hidden>
            {shown.map((course, index) => (
                <span
                    key={course.id}
                    className="relative -ml-6 aspect-video w-19 shrink-0 overflow-hidden rounded-md bg-secondary shadow-card ring-2 ring-card first:ml-0"
                    style={{ zIndex: shown.length - index }}
                >
                    <SafeImage
                        src={course.thumbnail}
                        alt=""
                        fill
                        sizes="76px"
                        className="object-cover"
                        fallback={<BookOpen className="size-4 text-muted-foreground" />}
                    />
                </span>
            ))}
            {more > 0 && (
                <span className="-ml-6 grid aspect-video w-19 shrink-0 place-items-center rounded-md bg-primary-950 pl-4 text-xs font-semibold text-white ring-2 ring-card">
                    +{more}
                </span>
            )}
        </div>
    );
}
