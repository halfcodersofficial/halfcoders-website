import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/shared/JsonLd";
import { BRAND_NAME, DEFAULT_SOCIAL_IMAGE } from "@/lib/brand";
import envConfig from "@/lib/envConfig";
import { isMissing } from "@/lib/listedCourses";
import { pageMetadata, snippet } from "@/lib/seo";
import type { ApiResponse } from "@/types/api.types";
import type { PublicBundle } from "@/types/domain.types";
import BundleDetail from "./BundleDetail";

/**
 * The bundle as a visitor sees it, for the page's title, description and
 * structured data. Null when the API says there's no such bundle (a 4xx);
 * undefined when it can't be reached, and then the page loads it in the
 * browser as usual.
 */
const getBundle = async (slug: string): Promise<PublicBundle | null | undefined> => {
    try {
        const res = await fetch(`${envConfig.apiBaseUrl}/bundles/${slug}`, { next: { revalidate: 120 } });
        if (isMissing(res.status)) return null;
        if (!res.ok) return undefined;
        return ((await res.json()) as ApiResponse<PublicBundle>).data;
    } catch {
        return undefined;
    }
};

const describe = (bundle: PublicBundle) =>
    bundle.description
        ? snippet(bundle.description)
        : `${bundle.courses.length} ${BRAND_NAME} courses together: ${bundle.courses.map((course) => course.title).join(", ")}.`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const bundle = await getBundle((await params).slug);
    if (bundle === null) return { title: "Bundle not found", robots: { index: false } };
    if (!bundle) return { title: "Course bundle" };
    return pageMetadata({
        title: bundle.title,
        description: describe(bundle),
        path: `/bundles/${bundle.slug}`,
        image: bundle.thumbnail ?? DEFAULT_SOCIAL_IMAGE,
    });
}

/**
 * The bundle's page is priced for whoever is looking, so the browser asks
 * the API for it. The server's copy, at a visitor's price, goes into the
 * page's HTML first (the `HydrationBoundary`), so search engines read the
 * bundle itself, not placeholders; it's marked as old, so the browser still
 * asks for the viewer's own as it opens the page. The same bundle goes into
 * structured data. A bundle that doesn't exist is a real "not found", not an
 * empty page that could be indexed.
 */
export default async function BundlePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const bundle = await getBundle(slug);
    if (bundle === null) notFound();

    const bundleUrl = `${envConfig.siteUrl}/bundles/${slug}`;
    const queryClient = new QueryClient();
    if (bundle) queryClient.setQueryData(["bundle", slug], bundle, { updatedAt: 0 });

    return (
        <>
            {bundle && (
                <>
                    <JsonLd
                        data={{
                            "@context": "https://schema.org",
                            "@type": "ItemList",
                            "@id": `${bundleUrl}#bundle`,
                            name: bundle.title,
                            description: describe(bundle),
                            url: bundleUrl,
                            ...(bundle.thumbnail && { image: bundle.thumbnail }),
                            numberOfItems: bundle.courses.length,
                            itemListElement: bundle.courses.map((course, index) => ({
                                "@type": "ListItem",
                                position: index + 1,
                                name: course.title,
                                url: `${envConfig.siteUrl}/courses/${course.slug}`,
                            })),
                        }}
                    />
                    <JsonLd
                        data={{
                            "@context": "https://schema.org",
                            "@type": "BreadcrumbList",
                            itemListElement: [
                                { "@type": "ListItem", position: 1, name: "Home", item: `${envConfig.siteUrl}/home` },
                                { "@type": "ListItem", position: 2, name: "Bundles", item: `${envConfig.siteUrl}/bundles` },
                                { "@type": "ListItem", position: 3, name: bundle.title },
                            ],
                        }}
                    />
                </>
            )}
            <HydrationBoundary state={dehydrate(queryClient)}>
                <BundleDetail slug={slug} />
            </HydrationBoundary>
        </>
    );
}
