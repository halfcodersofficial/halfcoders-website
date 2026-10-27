import type { Metadata } from "next";
import AboutClosing from "@/components/about/AboutClosing";
import AboutFaq from "@/components/about/AboutFaq";
import AboutGallery from "@/components/about/AboutGallery";
import AboutGoal from "@/components/about/AboutGoal";
import AboutHero from "@/components/about/AboutHero";
import AboutJourney from "@/components/about/AboutJourney";
import AboutPrinciples from "@/components/about/AboutPrinciples";
import AboutReviews from "@/components/about/AboutReviews";
import AboutTeam from "@/components/about/AboutTeam";
import AboutTimeline from "@/components/about/AboutTimeline";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
    title: "About",
    description:
        "Half Coders বাংলাদেশের একটা লার্নিং কমিউনিটি: কোডিং, ইঞ্জিনিয়ারিং আর ক্যারিয়ার স্কিল বাংলায়, মেন্টরের রিভিউ, লাইভ সাপোর্ট আর যাচাইযোগ্য সার্টিফিকেট।",
    path: "/about",
});

/**
 * The About page, in Bangla and fully static (components/about/content.ts):
 * who we are (with a class on show), what we want learners to leave with,
 * the story as a long read, the people and classes in photos, the road so
 * far, the rules, the team, the reviews, questions, and a sign-off.
 */
export default function AboutPage() {
    // Bangla throughout: Bangla's taller line and fonts, and the right voice in a screen reader.
    // Button labels, names and code stay English and say `lang="en"` themselves.
    return (
        <div lang="bn">
            <AboutHero />
            <AboutGoal />
            <AboutJourney />
            <AboutGallery />
            <AboutTimeline />
            <AboutPrinciples />
            <AboutTeam />
            <AboutReviews />
            <AboutFaq />
            <AboutClosing />
        </div>
    );
}
