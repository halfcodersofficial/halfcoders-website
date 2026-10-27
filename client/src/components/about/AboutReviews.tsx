import { MessageSquare } from "lucide-react";
import Section from "@/components/site/Section";
import { Avatar } from "@/components/ui/avatar";
import envConfig from "@/lib/envConfig";
import { langOf } from "@/lib/lang";
import { REVIEWS } from "./content";
import { DocHeading } from "./paper";

/**
 * The reviews, from the static list in `REVIEWS.items`, each set out like a
 * comment on an issue. Placeholders (`sample`) show only in development; a
 * production build leaves them out, and the band with them until there's a
 * real review.
 */
export default function AboutReviews() {
    const items = REVIEWS.items.filter((review) => !review.sample || !envConfig.isProduction);
    if (items.length === 0) return null;

    return (
        <Section tone="dark" labelledBy="about-reviews-title">
            <DocHeading id="about-reviews-title" title={REVIEWS.heading} lead={REVIEWS.description} />
            <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
                {items.map((review) => (
                    <article
                        key={review.name}
                        className="mb-5 break-inside-avoid overflow-hidden rounded-card border border-editor-line bg-editor-panel"
                    >
                        <header className="flex items-center gap-3 border-b border-editor-line px-4 py-3">
                            <Avatar src={review.photo} name={review.name} size={32} className="shrink-0" />
                            <p className="min-w-0 flex-1 truncate text-sm">
                                <span lang={langOf(review.name)} className="font-semibold text-editor-fg">
                                    {review.name}
                                </span>
                                {review.role && <span className="text-editor-muted"> · {review.role}</span>}
                            </p>
                            <MessageSquare className="size-4 shrink-0 text-editor-gutter" aria-hidden />
                        </header>
                        <div className="px-4 py-4">
                            <p className="font-mono text-sm tracking-widest text-syn-number" aria-label={`${review.rating} out of 5`}>
                                {"★".repeat(review.rating)}
                                <span className="text-editor-gutter">{"★".repeat(Math.max(0, 5 - review.rating))}</span>
                            </p>
                            <p lang={langOf(review.quote)} className="mt-3 leading-relaxed text-editor-fg/90">
                                {review.quote}
                            </p>
                            {review.batch && <p className="mt-4 font-mono text-xs text-syn-func">#{review.batch}</p>}
                        </div>
                    </article>
                ))}
            </div>
        </Section>
    );
}
