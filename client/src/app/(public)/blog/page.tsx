import { ArrowRight, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/shared/JsonLd";
import { Eyebrow } from "@/components/site/code";
import { FileIcon } from "@/components/site/EditorWindow";
import EmptyState from "@/components/site/EmptyState";
import PathBar from "@/components/site/PathBar";
import { Button } from "@/components/ui/button";
import { banglaDate, postPath, publishedPosts, readingMinutes, visiblePosts } from "@/lib/blog";
import { BRAND_NAME } from "@/lib/brand";
import envConfig from "@/lib/envConfig";
import { ORGANIZATION_ID, pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
    return {
        ...pageMetadata({
            title: "Blog: Programming & Career Guides in Bangla",
            description: "প্রোগ্রামিং কীভাবে শুরু করবেন, কোন ভাষা আগে শিখবেন, কতটুকু গণিত লাগে: শেখার পথে যে প্রশ্নগুলো সবার আসে, সেগুলোর সোজা উত্তর, বাংলায়।",
            path: "/blog",
        }),
        // An empty list isn't worth a search result; it is indexed from the first live post.
        ...(publishedPosts().length === 0 && { robots: { index: false, follow: true } }),
    };
}

/**
 * The blog: every post this build shows, newest first, as files in a folder —
 * the topic, the headline, what the reader gets, the date and the reading
 * time. Drafts show only while developing, marked as drafts.
 */
export default function BlogPage() {
    const posts = visiblePosts();
    const live = publishedPosts();

    const blogJsonLd = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": `${envConfig.siteUrl}/blog#blog`,
        name: `${BRAND_NAME} Blog`,
        url: `${envConfig.siteUrl}/blog`,
        inLanguage: "bn-BD",
        publisher: { "@id": ORGANIZATION_ID },
        blogPost: live.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            url: `${envConfig.siteUrl}${postPath(post)}`,
            ...(post.published && { datePublished: post.published }),
            dateModified: post.updated,
        })),
    };

    return (
        <div lang="bn">
            {live.length > 0 && <JsonLd data={blogJsonLd} />}

            <header data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
                <PathBar steps={[{ label: "Home", href: "/home" }, { label: "Blog" }]} file="blog/" />
                <div className="container-page relative py-10 sm:py-14">
                    <div className="max-w-3xl">
                        <Eyebrow className="mb-4">ব্লগ</Eyebrow>
                        <h1 className="text-h1 text-balance">প্রোগ্রামিং আর ক্যারিয়ারের গাইড, বাংলায়</h1>
                        <p className="mt-4 max-w-2xl text-lead text-editor-muted">
                            কোথা থেকে শুরু করবেন, কোন ভাষা আগে, কতটুকু গণিত লাগে: শেখার পথে যে প্রশ্নগুলো সবার আসে, সেগুলোর সোজা উত্তর।
                        </p>
                    </div>
                </div>
            </header>

            <div className="container-page py-12 sm:py-16">
                {posts.length > 0 ? (
                    <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {posts.map((post) => (
                            <li key={post.slug}>
                                <Link
                                    href={postPath(post)}
                                    className="group flex h-full flex-col rounded-card border border-border bg-card p-6 transition-colors hover:border-primary/50"
                                >
                                    <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                                        <FileIcon name={`${post.slug}.md`} />
                                        <span className="truncate">{post.topic}</span>
                                        {post.status === "draft" && (
                                            <span className="ml-auto shrink-0 rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 font-sans text-[0.7rem] font-semibold text-foreground">
                                                খসড়া
                                            </span>
                                        )}
                                    </span>
                                    <h2 className="mt-3 font-heading text-xl font-semibold leading-snug text-balance group-hover:text-primary">{post.title}</h2>
                                    <p className="mt-2 flex-1 leading-relaxed text-muted-foreground">{post.description}</p>
                                    <span className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                                        <span>
                                            {banglaDate(post.published ?? post.updated)} · {readingMinutes(post).toLocaleString("bn-BD")} মিনিট
                                        </span>
                                        <ArrowRight
                                            className="size-4 shrink-0 transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-primary"
                                            aria-hidden
                                        />
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <EmptyState
                        icon={BookOpen}
                        title="শিগগিরই প্রথম লেখা আসছে"
                        description="এর মধ্যে কোর্সগুলো দেখে নিতে পারেন, বা কোনো প্রশ্ন থাকলে প্রশ্নোত্তর পাতাটা দেখুন।"
                        action={
                            <Button asChild variant="brand">
                                <Link href="/courses" lang="en">
                                    Browse courses
                                </Link>
                            </Button>
                        }
                    />
                )}
            </div>
        </div>
    );
}
