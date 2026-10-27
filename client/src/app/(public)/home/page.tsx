import type { Metadata } from "next";
import HomeAudience from "@/components/home/HomeAudience";
import HomeCertificate from "@/components/home/HomeCertificate";
import HomeCommunity from "@/components/home/HomeCommunity";
import HomeCta from "@/components/home/HomeCta";
import HomeDay from "@/components/home/HomeDay";
import HomeFaq from "@/components/home/HomeFaq";
import HomeHero from "@/components/home/HomeHero";
import HomeInside from "@/components/home/HomeInside";
import HomeReviews from "@/components/home/HomeReviews";
import HomeSupport from "@/components/home/HomeSupport";
import HomeTicker from "@/components/home/HomeTicker";
import HomeTracks from "@/components/home/HomeTracks";
import HomeWhy from "@/components/home/HomeWhy";
import HomeWorkflow from "@/components/home/HomeWorkflow";
import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
    title: { absolute: `${BRAND_NAME} — Learn Coding & Career Skills in Bangla` },
    description:
        "কোডিং, ইঞ্জিনিয়ারিংয়ের গণিত আর চাকরির প্রস্তুতি — সব শেখানো হয় বাংলায়। লাইভ ক্লাস, মেন্টরের রিভিউ, হাতে-কলমে অ্যাসাইনমেন্ট আর অনলাইনে যাচাইযোগ্য সার্টিফিকেট।",
    path: "/home",
});

/**
 * The homepage, dressed as a friendly code editor. Static by design — every
 * word and figure comes from components/home/content.ts, none from the API
 * (the reviews are the exception: real reviews only). It speaks of all of
 * Half Coders — coding, engineering and career — not any one course.
 *
 * The copy is Bangla, so the whole page says `lang="bn"`: it gets Bangla's
 * taller line and fonts, and the right voice in a screen reader. Button
 * labels and code stay English and say `lang="en"` themselves.
 */
export default function HomePage() {
    return (
        <div lang="bn">
            {/* The promise, a code window, four facts */}
            <HomeHero />

            {/* What Half Coders teaches, scrolling past */}
            <HomeTicker />

            {/* The four areas: coding, engineering, building, career */}
            <HomeTracks />

            {/* Learning alone against learning here, as a before/after */}
            <HomeWhy />

            {/* A day's timeline, a playhead gliding between the learning blocks */}
            <HomeDay />

            {/* What's inside every course, as an explorer */}
            <HomeInside />

            {/* Enrol to certificate in five steps */}
            <HomeWorkflow />

            {/* A support session acted out in the editor */}
            <HomeSupport />

            {/* Who it's for */}
            <HomeAudience />

            {/* The certificate, and the check anyone can run */}
            <HomeCertificate />

            {/* What "Half Coders" means */}
            <HomeCommunity />

            {/* Reviews — only published ones, hidden when there are none */}
            <HomeReviews />

            {/* Questions */}
            <HomeFaq />

            {/* The closing terminal */}
            <HomeCta />
        </div>
    );
}
