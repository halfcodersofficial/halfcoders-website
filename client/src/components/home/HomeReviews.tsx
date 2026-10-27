"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import httpClient from "@/lib/httpClient";
import { langOf } from "@/lib/lang";
import type { PublicTestimonial } from "@/lib/publicTestimonials";
import type { ApiResponse } from "@/types/api.types";
import { REVIEWS } from "./content";

const testimonialsQuery = queryOptions({
    queryKey: ["public", "testimonials"],
    queryFn: () =>
        httpClient
            .get<ApiResponse<PublicTestimonial[]>>("/testimonials", { _silent: true })
            .then((response) => response.data.data),
    staleTime: 10 * 60_000,
});

/** At most this many: a band of reviews, not a wall. */
const LIMIT = 9;

/**
 * Real reviews from Admin → Testimonials, each set out like a code-review
 * comment: who, an "approved" mark, the stars as a line of text, their words,
 * and the course as a tag. Nothing at all until there is at least one.
 */
export default function HomeReviews() {
    const { data } = useQuery(testimonialsQuery);
    const reviews = (data ?? []).slice(0, LIMIT);
    if (reviews.length === 0) return null;

    return (
        <Section tone="surface" labelledBy="home-reviews-title">
            <SectionHeader id="home-reviews-title" eyebrow={REVIEWS.eyebrow} title={REVIEWS.title} description={REVIEWS.description} />

            <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
                {reviews.map((review) => (
                    <article key={review.id} className="mb-5 break-inside-avoid overflow-hidden rounded-card border border-border bg-card">
                        <header className="flex items-center gap-3 border-b border-border bg-surface/60 px-4 py-3">
                            <Avatar src={review.avatar} name={review.name} size={34} className="shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p lang={langOf(review.name)} className="truncate text-sm font-semibold">
                                    {review.name}
                                </p>
                                {review.designation && (
                                    <p lang={langOf(review.designation)} className="truncate text-xs text-muted-foreground">
                                        {review.designation}
                                    </p>
                                )}
                            </div>
                            <Badge variant="success" lang="en">
                                <Check className="size-3" aria-hidden /> approved
                            </Badge>
                        </header>
                        <div className="px-4 py-4">
                            <p className="font-mono text-sm tracking-widest text-syn-number" aria-label={`${review.rating} out of 5`}>
                                {"★".repeat(review.rating)}
                                <span className="text-border-strong">{"★".repeat(Math.max(0, 5 - review.rating))}</span>
                            </p>
                            <p lang={langOf(review.quote)} className="mt-3 text-[0.95rem] leading-relaxed text-foreground/90">
                                {review.quote}
                            </p>
                            {review.course && (
                                <p lang={langOf(review.course.title)} className="mt-4 truncate font-mono text-xs text-syn-func">
                                    #{review.course.title}
                                </p>
                            )}
                        </div>
                    </article>
                ))}
            </div>
        </Section>
    );
}
