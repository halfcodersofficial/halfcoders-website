import type { MetadataRoute } from "next";
import envConfig from "@/lib/envConfig";
import { getPublicJson, listedCourses, type Listed } from "@/lib/listedCourses";

/** Rebuilt at most hourly: a newly published course shows up within the hour. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const url = (path: string) => `${envConfig.siteUrl}${path}`;
    const [courses, bundles] = await Promise.all([listedCourses(), getPublicJson<Listed[]>("/bundles")]);

    return [
        { url: url("/courses"), changeFrequency: "daily", priority: 1 },
        { url: url("/home"), changeFrequency: "weekly", priority: 0.8 },
        { url: url("/bundles"), changeFrequency: "weekly", priority: 0.7 },
        { url: url("/about"), changeFrequency: "monthly", priority: 0.5 },
        { url: url("/contact"), changeFrequency: "monthly", priority: 0.4 },
        { url: url("/certificate"), changeFrequency: "yearly", priority: 0.3 },
        { url: url("/terms"), changeFrequency: "yearly", priority: 0.2 },
        { url: url("/privacy-policy"), changeFrequency: "yearly", priority: 0.2 },
        { url: url("/refund-policy"), changeFrequency: "yearly", priority: 0.2 },
        ...courses.map((course) => ({
            url: url(`/courses/${course.slug}`),
            lastModified: course.updatedAt,
            changeFrequency: "weekly" as const,
            priority: 0.9,
        })),
        ...(bundles?.data ?? []).map((bundle) => ({
            url: url(`/bundles/${bundle.slug}`),
            changeFrequency: "weekly" as const,
            priority: 0.6,
        })),
    ];
}
