import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/shared/JsonLd";
import { Eyebrow } from "@/components/site/code";
import FaqList from "@/components/site/FaqList";
import LegalToc from "@/components/site/LegalToc";
import PathBar from "@/components/site/PathBar";
import { Button } from "@/components/ui/button";
import { FAQ_GROUPS } from "@/content/faq";
import { plainText } from "@/lib/blog";
import { faqJsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
    title: "FAQ: Courses, Fees, Payment & Certificates | প্রশ্নোত্তর",
    description: "Half Coders নিয়ে সব প্রশ্নের উত্তর: কোর্স কীভাবে চলে, ফি আর বিকাশে পেমেন্ট, রিফান্ড, মেন্টর সাপোর্ট, সার্টিফিকেট যাচাই আর চাকরির প্রস্তুতি।",
    path: "/faq",
});

/**
 * Every question people ask before enrolling (content/faq.ts), grouped, with
 * a sticky list of the groups beside them — the long-read frame of the legal
 * pages. All the answers are in the HTML, and in the FAQ data for search
 * engines and AI answer engines. Ends with the way to ask anything else.
 */
export default function FaqPage() {
    const all = FAQ_GROUPS.flatMap((group) => group.items);
    const toc = FAQ_GROUPS.map((group) => ({ id: group.id, label: group.title }));
    // Each group numbers on from the last, so every question keeps one number down the page.
    const starts = FAQ_GROUPS.map((_, index) => FAQ_GROUPS.slice(0, index).reduce((sum, group) => sum + group.items.length, 0));

    return (
        <div lang="bn">
            <JsonLd data={faqJsonLd(all.map((item) => ({ q: item.q, a: plainText(item.a) })))} />

            <header data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
                <PathBar steps={[{ label: "Home", href: "/home" }, { label: "FAQ" }]} file="faq.md" />
                <div className="container-page relative py-10 sm:py-14">
                    <div className="max-w-3xl">
                        <Eyebrow className="mb-4">প্রশ্নোত্তর</Eyebrow>
                        <h1 className="text-h1 text-balance">ভর্তির আগে যা জানতে চান</h1>
                        <p className="mt-4 max-w-2xl text-lead text-editor-muted">
                            কোর্স কীভাবে চলে, টাকা কীভাবে দেবেন, আটকে গেলে কী হবে, সার্টিফিকেট কেমন: সবচেয়ে বেশি আসা {all.length.toLocaleString("bn-BD")}টা প্রশ্নের
                            উত্তর এক জায়গায়।
                        </p>
                    </div>
                </div>
            </header>

            <div className="container-page grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[16rem_minmax(0,48rem)]">
                <aside className="lg:sticky lg:top-24 lg:self-start">
                    <details className="group rounded-card border border-border bg-surface lg:hidden">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                            বিষয়গুলো
                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="border-t border-border p-2">
                            <LegalToc items={toc} />
                        </div>
                    </details>

                    <div className="hidden lg:block">
                        <p className="mb-2 px-3 text-xs font-semibold text-muted-foreground">বিষয়গুলো</p>
                        <LegalToc items={toc} />
                    </div>
                </aside>

                <div className="min-w-0 space-y-12">
                    {FAQ_GROUPS.map((group, index) => (
                        <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-28">
                            <h2 id={`${group.id}-title`} className="mb-5 font-heading text-2xl font-bold tracking-tight">
                                {group.title}
                            </h2>
                            <FaqList items={group.items} start={starts[index]} />
                        </section>
                    ))}

                    <div className="flex flex-col items-start gap-4 border-l-2 border-primary bg-surface px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="leading-relaxed">আপনার প্রশ্নটা এখানে নেই? সরাসরি লিখুন, সাধারণত এক দিনের মধ্যে উত্তর দিই।</p>
                        <Button asChild variant="brand" className="shrink-0">
                            <Link href="/contact" lang="en">
                                <MessageCircleQuestion aria-hidden /> Ask us directly
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
