import { ArrowRight, CalendarDays, ChevronDown, Clock, FileWarning, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PostBody from "@/components/blog/PostBody";
import RichText from "@/components/blog/RichText";
import JsonLd from "@/components/shared/JsonLd";
import { Eyebrow } from "@/components/site/code";
import { FileIcon } from "@/components/site/EditorWindow";
import FaqList from "@/components/site/FaqList";
import LegalToc from "@/components/site/LegalToc";
import PathBar from "@/components/site/PathBar";
import Prose from "@/components/site/Prose";
import { Button } from "@/components/ui/button";
import { articleJsonLd, banglaDate, plainText, postBySlug, postPath, readingMinutes, visiblePosts } from "@/lib/blog";
import { BRAND_NAME, DEFAULT_SOCIAL_IMAGE } from "@/lib/brand";
import { faqJsonLd, pageMetadata } from "@/lib/seo";

/** Only the posts this build shows get a page; any other address is a 404 (a draft, in production). */
export const dynamicParams = false;

export function generateStaticParams() {
    return visiblePosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const post = postBySlug((await params).slug);
    if (!post) return { title: "Post not found", robots: { index: false } };

    const base = pageMetadata({ title: post.seoTitle, description: post.description, path: postPath(post) });
    return {
        ...base,
        // An article's card, with its dates, in place of the website card.
        openGraph: {
            type: "article",
            siteName: BRAND_NAME,
            locale: "bn_BD",
            title: post.seoTitle,
            description: post.description,
            url: postPath(post),
            images: [DEFAULT_SOCIAL_IMAGE],
            ...(post.published && { publishedTime: post.published }),
            modifiedTime: post.updated,
        },
        // Only reachable while developing, but never let a draft be indexed.
        ...(post.status === "draft" && { robots: { index: false, follow: false } }),
    };
}

/**
 * A blog post (content/blog/posts/), dressed like the site's other long
 * reads: the dark editor header with the path bar and the headline, then the
 * text in a reading column beside a sticky contents list, the questions it
 * answers, the one course it leads to, and other posts to read next. A draft
 * says so in a band under the header (drafts never reach production).
 */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const post = postBySlug((await params).slug);
    if (!post) notFound();

    const faqs = post.faqs ?? [];
    const toc = [
        ...post.sections.map((section) => ({ id: section.id, label: section.heading })),
        ...(faqs.length > 0 ? [{ id: "faq", label: "প্রশ্নোত্তর" }] : []),
    ];
    const others = visiblePosts()
        .filter((other) => other.slug !== post.slug)
        .slice(0, 2);
    const minutes = readingMinutes(post);

    return (
        <div lang="bn">
            <JsonLd data={articleJsonLd(post)} />
            {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs.map((faq) => ({ q: faq.q, a: plainText(faq.a) })))} />}

            <header data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
                <PathBar steps={[{ label: "Home", href: "/home" }, { label: "Blog", href: "/blog" }, { label: post.title }]} file={`${post.slug}.md`} />
                <div className="container-page relative py-10 sm:py-14">
                    <div className="max-w-3xl">
                        <Eyebrow className="mb-4">{post.topic}</Eyebrow>
                        <h1 className="text-h1 text-balance">{post.title}</h1>
                        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-editor-muted">
                            <li className="flex items-center gap-1.5">
                                <CalendarDays className="size-4" aria-hidden />
                                {post.published ? `প্রকাশ: ${banglaDate(post.published)}` : `সর্বশেষ আপডেট: ${banglaDate(post.updated)}`}
                            </li>
                            <li className="flex items-center gap-1.5">
                                <Clock className="size-4" aria-hidden />
                                পড়তে লাগবে {minutes.toLocaleString("bn-BD")} মিনিট
                            </li>
                            <li className="flex items-center gap-1.5">
                                <UserCheck className="size-4" aria-hidden />
                                {post.reviewedBy ? `রিভিউ করেছেন: ${post.reviewedBy}` : `লিখেছে ${BRAND_NAME} টিম`}
                            </li>
                        </ul>
                    </div>
                </div>
            </header>

            {post.status === "draft" && (
                <p className="border-b border-warning/40 bg-warning/10">
                    <span className="container-page flex items-center gap-2.5 py-3 text-sm">
                        <FileWarning className="size-4 shrink-0 text-warning" aria-hidden />
                        খসড়া: অনুমোদনের অপেক্ষায়। এটা শুধু ডেভেলপমেন্টে দেখা যায়, লাইভ সাইটে না (content/blog/types.ts দেখুন)।
                    </span>
                </p>
            )}

            <div className="container-page grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[16rem_minmax(0,46rem)]">
                <aside className="lg:sticky lg:top-24 lg:self-start">
                    {/* Narrow screens: folded away above the text, so the post starts near the top. */}
                    <details className="group rounded-card border border-border bg-surface lg:hidden">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                            এই লেখায়
                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="border-t border-border p-2">
                            <LegalToc items={toc} />
                        </div>
                    </details>

                    <div className="hidden lg:block">
                        <p className="mb-2 px-3 text-xs font-semibold text-muted-foreground">এই লেখায়</p>
                        <LegalToc items={toc} />
                    </div>
                </aside>

                <article className="min-w-0">
                    <Prose lang="bn">
                        <p className="text-lg leading-relaxed text-foreground">
                            <RichText text={post.lead} />
                        </p>
                        <PostBody sections={post.sections} />
                    </Prose>

                    {faqs.length > 0 && (
                        <section aria-labelledby="faq" className="mt-14">
                            <h2 id="faq" className="mb-5 scroll-mt-32 font-heading text-2xl font-bold tracking-tight">
                                প্রশ্নোত্তর
                            </h2>
                            <FaqList items={faqs} />
                        </section>
                    )}

                    {post.course && (
                        <aside className="mt-14 overflow-hidden rounded-panel border border-border bg-card">
                            <div className="flex items-center gap-2 border-b border-border bg-surface px-5 py-2.5 font-mono text-xs text-muted-foreground">
                                <FileIcon name="next-step.md" />
                                <span>পরের ধাপ</span>
                            </div>
                            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p lang="en" className="font-heading text-lg font-semibold">
                                        {post.course.name}
                                    </p>
                                    <p className="mt-1.5 leading-relaxed text-muted-foreground">{post.course.pitch}</p>
                                </div>
                                <Button asChild variant="brand" className="shrink-0">
                                    <Link href={`/courses/${post.course.slug}`} lang="en">
                                        View the course <ArrowRight aria-hidden />
                                    </Link>
                                </Button>
                            </div>
                        </aside>
                    )}

                    {others.length > 0 && (
                        <nav aria-label="আরও পড়ুন" className="mt-12">
                            <p className="mb-4 text-sm font-semibold text-muted-foreground">আরও পড়ুন</p>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {others.map((other) => (
                                    <Link
                                        key={other.slug}
                                        href={postPath(other)}
                                        className="group flex flex-col rounded-card border border-border bg-card p-5 transition-colors hover:border-primary/50"
                                    >
                                        <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                                            <FileIcon name={`${other.slug}.md`} />
                                            {other.topic}
                                        </span>
                                        <span className="mt-2 font-semibold leading-snug group-hover:text-primary">{other.title}</span>
                                    </Link>
                                ))}
                            </div>
                        </nav>
                    )}
                </article>
            </div>
        </div>
    );
}
