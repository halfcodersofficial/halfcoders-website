import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@/lib/brand";
import envConfig from "@/lib/envConfig";
import { pageMetadata } from "@/lib/seo";
import type { ApiResponse } from "@/types/api.types";
import type { PublicBundle } from "@/types/domain.types";
import BundleDetail from "./BundleDetail";

/** The bundle as a visitor sees it, for the page's title and description. */
const getBundle = async (slug: string): Promise<PublicBundle | null> => {
    try {
        const res = await fetch(`${envConfig.apiBaseUrl}/bundles/${slug}`, { next: { revalidate: 120 } });
        if (!res.ok) return null;
        return ((await res.json()) as ApiResponse<PublicBundle>).data;
    } catch {
        return null;
    }
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const bundle = await getBundle((await params).slug);
    if (!bundle) return { title: "Course bundle" };
    return pageMetadata({
        title: bundle.title,
        description: bundle.description ?? `${bundle.courses.length} Half Coders courses together: ${bundle.courses.map((course) => course.title).join(", ")}.`,
        path: `/bundles/${bundle.slug}`,
        image: bundle.thumbnail ?? DEFAULT_SOCIAL_IMAGE,
    });
}

export default async function BundlePage({ params }: { params: Promise<{ slug: string }> }) {
    return <BundleDetail slug={(await params).slug} />;
}
