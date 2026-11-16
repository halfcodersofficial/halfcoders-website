import type { Metadata } from "next";
import HomeAudience from "@/components/home/HomeAudience";
import HomeCareer from "@/components/home/HomeCareer";
import HomeCertificate from "@/components/home/HomeCertificate";
import HomeCta from "@/components/home/HomeCta";
import HomeDay from "@/components/home/HomeDay";
import HomeFaq from "@/components/home/HomeFaq";
import HomeHero from "@/components/home/HomeHero";
import HomeInside from "@/components/home/HomeInside";
import HomeReviews from "@/components/home/HomeReviews";
import HomeStats from "@/components/home/HomeStats";
import HomeSupport from "@/components/home/HomeSupport";
import HomeTicker from "@/components/home/HomeTicker";
import HomeWhy from "@/components/home/HomeWhy";
import { FAQ } from "@/components/home/content";
import JsonLd from "@/components/shared/JsonLd";
import { BRAND_NAME } from "@/lib/brand";
import { faqJsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
    title: { absolute: `${BRAND_NAME} — Learn Coding & Career Skills in Bangla` },
    description:
        "কোডিং, ইঞ্জিনিয়ারিংয়ের গণিত আর চাকরির প্রস্তুতি — সব শেখানো হয় বাংলায়। লাইভ ক্লাস, মেন্টরের রিভিউ, হাতে-কলমে অ্যাসাইনমেন্ট আর অনলাইনে যাচাইযোগ্য সার্টিফিকেট।",
    path: "/home",
});

/**
 * The homepage, dressed as a friendly code editor. Its words and figures
 * come from components/home/content.ts; only the reviews read the API (real
 * reviews only, hidden when there are none). It speaks of all of Half Coders
 * — coding, engineering and career — not any one course.
 *
 * The order tells one story: the promise, the road to a developer job, the
 * proof, why learn here, what a course holds, how it fits a
 * busy day, who it's for, the help when stuck, the certificate at the end,
 * what others say, the questions, and the ask. Dark and light bands alternate, so no two
 * neighbours blur into one — keep it that way when adding a section.
 *
 * The copy is Bangla, so the whole page says `lang="bn"`: it gets Bangla's
 * taller line and fonts, and the right voice in a screen reader. Button
 * labels and code stay English and say `lang="en"` themselves.
 */
export default function HomePage() {
    return (
        <div lang="bn">
            {/* The questions answered below, for search and AI answer engines. */}
            <JsonLd data={faqJsonLd(FAQ.items)} />

            {/* The promise: the stack, the headline, the two ways in, four facts (dark) */}
            <HomeHero />

            {/* What Half Coders teaches, scrolling past */}
            <HomeTicker />

            {/* The road through them to a developer job, seven steps zigzagging down the page (lavender) */}
            <HomeCareer />

            {/* By the numbers, as one dashboard: students as dots, success as a ring, courses as a road (dark) */}
            <HomeStats />

            {/* Learning alone against learning here, as problem → solution */}
            <HomeWhy />

            {/* What's inside every course, as an explorer (dark) */}
            <HomeInside />

            {/* An ordinary day with the learning fitted into its gaps, written as a file */}
            <HomeDay />

            {/* Who it's for, and the course each can start with (tinted) */}
            <HomeAudience />

            {/* A support session acted out in the editor (dark) */}
            <HomeSupport />

            {/* The certificate, and the check anyone can run */}
            <HomeCertificate />

            {/* Reviews — only published ones, hidden when there are none */}
            <HomeReviews />

            {/* Questions */}
            <HomeFaq />

            {/* The ask, and a terminal printing what every course gives */}
            <HomeCta />
        </div>
    );
}
