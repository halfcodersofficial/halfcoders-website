import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import JsonLd from "@/components/shared/JsonLd";
import { CATALOGUE_SORTS, filtersQuery, sectionFilters } from "@/lib/catalogueQuery";
import { COURSE_PHASES } from "@/lib/courseClassification";
import envConfig from "@/lib/envConfig";
import { getPublicJson, listedCourses } from "@/lib/listedCourses";
import { pageMetadata } from "@/lib/seo";
import type { CourseCard } from "@/types/domain.types";
import CourseCatalogue from "./CourseCatalogue";

/** The course list below is re-read at most hourly, as the sitemap is. */
export const revalidate = 3600;

// Where a visitor to the bare domain lands (next.config.ts), so in search
// results this is the site's front page.
export const metadata: Metadata = pageMetadata({
    // What people type for this page (keyword research, Nov 2026): "programming course in bangladesh",
    // "coding course bangla", "প্রোগ্রামিং কোর্স" — in English first, then in Bangla script.
    title: "Programming & Coding Courses in Bangla | প্রোগ্রামিং কোর্স",
    description:
        "বাংলাদেশে বাংলায় প্রোগ্রামিং কোর্স: C, C++, DSA, প্রোগ্রামিংয়ের গণিত আর সিভি-ইন্টারভিউ প্রস্তুতি। প্রতিটা অ্যাসাইনমেন্ট মেন্টর নিজে রিভিউ করেন, শেষে আইডিসহ সার্টিফিকেট।",
    path: "/courses",
});

/**
 * The bare /courses's sections, read here so the page's HTML carries the
 * courses themselves (titles, links, prices), not placeholders: search
 * engines and link previews read the HTML, and the API can be asleep when a
 * crawler's browser asks it. Stored under the keys the catalogue's own
 * queries use (lib/catalogueQuery.ts). Marked as old, so the browser still
 * asks for a fresh list as it opens the page, as it always did; the courses
 * stay on screen meanwhile. A section the API doesn't answer is left out,
 * and the browser loads it as before.
 */
const prefetchCatalogue = async () => {
    const queryClient = new QueryClient();
    await Promise.all(
        COURSE_PHASES.map(async (phase) => {
            const filters = sectionFilters(phase, { sort: CATALOGUE_SORTS[0] });
            const body = await getPublicJson<CourseCard[]>(`/courses?${filtersQuery(filters)}`);
            if (body) queryClient.setQueryData(["courses", filters], { data: body.data, meta: body.meta }, { updatedAt: 0 });
        }),
    );
    return dehydrate(queryClient);
};

export default async function CoursesPage() {
    const [courses, catalogue] = await Promise.all([listedCourses(), prefetchCatalogue()]);
    // Google's course carousel: the catalogue as a list of links, each to a
    // course page that carries its own Course data.
    const courseListJsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: courses.map((course, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${envConfig.siteUrl}/courses/${course.slug}`,
        })),
    };

    return (
        <>
            {courses.length > 0 && <JsonLd data={courseListJsonLd} />}
            <HydrationBoundary state={catalogue}>
                <CourseCatalogue />
            </HydrationBoundary>
        </>
    );
}
