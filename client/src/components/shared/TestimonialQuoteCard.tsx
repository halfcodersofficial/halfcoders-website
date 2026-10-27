import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { langOf } from "@/lib/lang";
import { cn } from "@/lib/utils";

interface TestimonialQuoteCardProps {
    name: string;
    designation: string | null;
    avatar: string | null;
    quote: string;
    rating: number;
    /** Named when there's no designation on the homepage form; on a course page it would only repeat the page. */
    courseTitle?: string | null;
    variant: "home" | "course";
    className?: string;
}

/**
 * A written testimonial as a review comment: who wrote it in a header strip,
 * the stars as a line of mono text, then their words. On a course page's
 * reviews (`variant="course"`) and in the admin's testimonial editor, which
 * previews with this same card, so what it shows is what goes live.
 */
export default function TestimonialQuoteCard({
    name,
    designation,
    avatar,
    quote,
    rating,
    courseTitle,
    variant,
    className,
}: TestimonialQuoteCardProps) {
    const home = variant === "home";
    const caption = home ? (designation ?? courseTitle ?? "Half Coders learner") : designation;

    return (
        <figure className={cn("flex flex-col overflow-hidden rounded-card border border-border bg-card", className)}>
            <figcaption className="flex items-center gap-3 border-b border-border bg-surface/60 px-4 py-3">
                <Avatar src={avatar} name={name} size={32} className="shrink-0" />
                <div className="min-w-0 flex-1">
                    <p lang={langOf(name)} className="truncate text-sm font-semibold">
                        {name}
                    </p>
                    {caption && (
                        <p lang={langOf(caption)} className="truncate text-xs text-muted-foreground">
                            {caption}
                        </p>
                    )}
                </div>
                <MessageSquare className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
            </figcaption>
            <div className="flex flex-1 flex-col px-4 py-4">
                <p className="font-mono text-sm tracking-widest text-syn-number" aria-label={`${rating} out of 5`}>
                    {"★".repeat(Math.max(0, Math.min(5, rating)))}
                    <span className="text-border-strong">{"★".repeat(Math.max(0, 5 - rating))}</span>
                </p>
                <blockquote lang={langOf(quote)} className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-foreground/85">
                    {quote}
                </blockquote>
            </div>
        </figure>
    );
}
