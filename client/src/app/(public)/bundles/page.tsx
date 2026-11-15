import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import JsonLd from "@/components/shared/JsonLd";
import envConfig from "@/lib/envConfig";
import { getPublicJson } from "@/lib/listedCourses";
import { pageMetadata } from "@/lib/seo";
import type { PublicBundle } from "@/types/domain.types";
import BundleList from "./BundleList";

export const metadata: Metadata = pageMetadata({
    title: "Course bundles",
    description: "Several Half Coders courses together, for less than buying them one by one.",
    path: "/bundles",
});

/**
 * The bundles on sale, read here so the page's HTML lists them (search
 * engines read the HTML), at the price a visitor who isn't signed in pays.
 * Marked as old, so the browser asks again as the page opens, for the price
 * this viewer pays, exactly as it did before.
 */
export default async function BundlesPage() {
    const body = await getPublicJson<PublicBundle[]>("/bundles");
    const bundles = body?.data ?? [];
    const queryClient = new QueryClient();
    if (body) queryClient.setQueryData(["bundles"], bundles, { updatedAt: 0 });

    return (
        <>
            {bundles.length > 0 && (
                <JsonLd
                    data={{
                        "@context": "https://schema.org",
                        "@type": "ItemList",
                        itemListElement: bundles.map((bundle, index) => ({
                            "@type": "ListItem",
                            position: index + 1,
                            name: bundle.title,
                            url: `${envConfig.siteUrl}/bundles/${bundle.slug}`,
                        })),
                    }}
                />
            )}
            <HydrationBoundary state={dehydrate(queryClient)}>
                <BundleList />
            </HydrationBoundary>
        </>
    );
}
