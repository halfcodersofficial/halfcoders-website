import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import BundleList from "./BundleList";

export const metadata: Metadata = pageMetadata({
    title: "Course bundles",
    description: "Several Half Coders courses together, for less than buying them one by one.",
    path: "/bundles",
});

export default function BundlesPage() {
    return <BundleList />;
}
