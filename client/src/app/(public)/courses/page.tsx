import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import CourseCatalogue from "./CourseCatalogue";

// Where a visitor to the bare domain lands (next.config.ts), so in search
// results this is the site's front page.
export const metadata: Metadata = pageMetadata({
    title: "Courses in Bangla — Coding, Engineering & Career",
    description:
        "Half Coders-এর সব কোর্স এক জায়গায়: কোডিং, ইঞ্জিনিয়ারিং আর ক্যারিয়ার। ক্লাস বাংলায়, প্রতিটা অ্যাসাইনমেন্ট মেন্টর নিজে রিভিউ করেন, আর শেষে পাবেন আইডিসহ সার্টিফিকেট।",
    path: "/courses",
});

export default function CoursesPage() {
    return <CourseCatalogue />;
}
