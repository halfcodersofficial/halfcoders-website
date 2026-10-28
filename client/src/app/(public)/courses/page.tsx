import type { Metadata } from "next";
import JsonLd from "@/components/shared/JsonLd";
import envConfig from "@/lib/envConfig";
import { listedCourses } from "@/lib/listedCourses";
import { pageMetadata } from "@/lib/seo";
import CourseCatalogue from "./CourseCatalogue";

/** The course list below is re-read at most hourly, as the sitemap is. */
export const revalidate = 3600;

// Where a visitor to the bare domain lands (next.config.ts), so in search
// results this is the site's front page.
export const metadata: Metadata = pageMetadata({
    title: "Courses in Bangla — Coding, Engineering & Career",
    description:
        "Half Coders-এর সব কোর্স এক জায়গায়: কোডিং, ইঞ্জিনিয়ারিং আর ক্যারিয়ার। ক্লাস বাংলায়, প্রতিটা অ্যাসাইনমেন্ট মেন্টর নিজে রিভিউ করেন, আর শেষে পাবেন আইডিসহ সার্টিফিকেট।",
    path: "/courses",
});

export default async function CoursesPage() {
    const courses = await listedCourses();
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
            <CourseCatalogue />
        </>
    );
}
