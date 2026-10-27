import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Five stars, `rating` of them filled. Purely decorative — the label carries the number. */
export default function StarRating({
    rating,
    className,
    size = "size-4",
}: {
    rating: number;
    className?: string;
    size?: string;
}) {
    return (
        <span className={cn("inline-flex gap-0.5", className)} aria-label={`${rating} out of 5`}>
            {Array.from({ length: 5 }).map((_, index) => (
                <Star
                    key={index}
                    aria-hidden
                    className={cn(size, index < rating ? "fill-warning text-warning" : "text-border")}
                />
            ))}
        </span>
    );
}
