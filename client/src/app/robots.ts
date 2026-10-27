import type { MetadataRoute } from "next";
import envConfig from "@/lib/envConfig";

/**
 * Search engines get the catalogue and the visitor pages. Everything behind a
 * sign-in is kept out, and so are certificate pages and course leaderboards:
 * they carry students' names. A certificate's link is for LinkedIn or a CV,
 * a leaderboard's for the course's own students.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [
                "/api/",
                "/admin",
                "/mentor",
                "/learn",
                "/dashboard",
                "/checkout",
                "/orders",
                "/settings",
                "/conceptual-sessions",
                "/certificate/",
                "/leaderboard",
                "/login",
                "/register",
                "/forgot-password",
                "/verify-email",
                "/reset-password",
                "/change-password",
                "/redirecting",
                "/maintenance",
            ],
        },
        sitemap: `${envConfig.siteUrl}/sitemap.xml`,
    };
}
