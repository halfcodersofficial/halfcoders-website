import { ChevronRight } from "lucide-react";
import Link from "next/link";
import JsonLd from "@/components/shared/JsonLd";
import { langOf } from "@/lib/lang";

export interface Crumb {
    label: string;
    /** Omitted on the final crumb — the page you're already on isn't a link. */
    href?: string;
}

/**
 * Renders both the visible trail and the matching `BreadcrumbList` JSON-LD.
 *
 * Google shows the trail in place of a bare URL in results, which matters a
 * lot for course pages — "Half Coders › Web Development › MERN Stack" reads as a
 * catalogue entry where `half-coders.tech/courses/mern-stack` reads as
 * nothing.
 */
export default function Breadcrumbs({ items, siteUrl }: { items: Crumb[]; siteUrl?: string }) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.label,
            ...(item.href && siteUrl ? { item: `${siteUrl}${item.href}` } : {}),
        })),
    };

    return (
        <>
            <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                    {items.map((item, index) => {
                        const isLast = index === items.length - 1;

                        return (
                            <li key={item.label} className="flex items-center gap-1">
                                {index > 0 && (
                                    <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
                                )}

                                {item.href && !isLast ? (
                                    <Link
                                        href={item.href}
                                        lang={langOf(item.label)}
                                        className="rounded transition-colors hover:text-foreground"
                                    >
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span
                                        lang={langOf(item.label)}
                                        className="line-clamp-1 font-medium text-foreground"
                                        aria-current={isLast ? "page" : undefined}
                                    >
                                        {item.label}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <JsonLd data={jsonLd} />
        </>
    );
}
