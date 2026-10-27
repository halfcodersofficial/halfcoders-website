import { ArrowRight, ChevronDown, Mail } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/shared/FooterBits";
import { FileIcon } from "@/components/site/EditorWindow";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { cn } from "@/lib/utils";
import LegalToc, { type LegalTocItem } from "./LegalToc";

export type LegalDoc = "terms" | "privacy" | "refund";

const DOCS: { key: LegalDoc; href: string; file: string; label: string; blurb: string }[] = [
    { key: "terms", href: "/terms", file: "terms.md", label: "ব্যবহারের শর্তাবলী", blurb: "অ্যাকাউন্ট, কনটেন্ট, আচরণ আর পেমেন্টের নিয়ম" },
    { key: "privacy", href: "/privacy-policy", file: "privacy.md", label: "প্রাইভেসি পলিসি", blurb: "কোন তথ্য রাখি, কীভাবে ব্যবহার করি" },
    { key: "refund", href: "/refund-policy", file: "refund.md", label: "রিফান্ড নীতি", blurb: "কখন আর কীভাবে রিফান্ড চাইবেন" },
];

/**
 * The legal pages' shared frame, as docs open in the editor. A dark header
 * with the three documents as editor tabs, this one's title and when it was
 * last updated;
 * then the document in a reading column beside a sticky contents list
 * (`LegalToc`, numbered `§01…`, marking the part being read) and the support
 * email; the page's own closing note, set like a markdown quote; and the
 * other two documents to go on to. Wide screens only get the side column — on
 * a phone the contents are folded into a disclosure above the text.
 *
 * The page supplies the words: `title`, `updated` (already in Bangla), the
 * parts for the contents list (each must be an element with that `id` in
 * `children`), and the closing note.
 */
export default function LegalPage({
    doc,
    title,
    updated,
    lead,
    toc,
    closing,
    children,
}: {
    doc: LegalDoc;
    title: string;
    updated: string;
    /** A line under the title. */
    lead?: ReactNode;
    toc: LegalTocItem[];
    closing: ReactNode;
    children: ReactNode;
}) {
    const others = DOCS.filter((item) => item.key !== doc);

    return (
        <div lang="bn">
            <header data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
                <nav aria-label="নীতিমালা" className="relative border-b border-editor-line bg-editor-panel">
                    <ul className="container-page no-scrollbar flex overflow-x-auto">
                        {DOCS.map((item) => {
                            const current = item.key === doc;
                            return (
                                <li key={item.key} className="flex">
                                    <Link
                                        href={item.href}
                                        aria-current={current ? "page" : undefined}
                                        data-active={current || undefined}
                                        className={cn(
                                            "editor-tab -ml-px flex items-center gap-2 border-x border-editor-line px-3.5 py-2 font-mono text-[0.72rem] transition-colors",
                                            current ? "bg-editor text-editor-fg" : "text-editor-muted hover:text-editor-fg",
                                        )}
                                    >
                                        <FileIcon name={item.file} />
                                        <span className="font-sans text-[0.78rem] font-medium">{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
                <div className="container-page relative py-10 sm:py-14">
                    <h1 lang="en" className="text-h1 text-balance">
                        {title}
                    </h1>
                    {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-editor-muted">{lead}</p>}
                    <p className="mt-6 text-sm text-editor-muted">
                        সর্বশেষ আপডেট: <span className="font-semibold text-editor-fg">{updated}</span>
                    </p>
                </div>
            </header>

            <div className="container-page grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[16rem_minmax(0,46rem)]">
                <aside className="lg:sticky lg:top-24 lg:self-start">
                    {/* Narrow screens: folded away above the text, so the document starts near the top. */}
                    <details className="group rounded-card border border-border bg-surface lg:hidden">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                            সূচিপত্র
                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="border-t border-border p-2">
                            <LegalToc items={toc} />
                        </div>
                    </details>

                    <div className="hidden lg:block">
                        <p className="mb-2 px-3 text-xs font-semibold text-muted-foreground">সূচিপত্র</p>
                        <LegalToc items={toc} />
                    </div>

                    <div className="mt-8 hidden rounded-card border border-border bg-surface p-4 lg:block">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                            <Mail className="size-4 text-primary" aria-hidden />
                            প্রশ্ন থাকলে লিখুন
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                            <a href={`mailto:${SUPPORT_EMAIL}`} className="min-w-0 truncate text-sm font-medium text-primary hover:underline">
                                {SUPPORT_EMAIL}
                            </a>
                            <CopyButton value={SUPPORT_EMAIL} label="Copy email address" />
                        </div>
                    </div>
                </aside>

                <article className="min-w-0">
                    {children}

                    <footer className="mt-14 border-l-2 border-primary bg-surface px-6 py-5 sm:px-7">
                        <div className="min-w-0 leading-relaxed">{closing}</div>
                    </footer>

                    <nav aria-label="অন্যান্য নীতিমালা" className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {others.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                className="group flex items-center gap-4 rounded-card border border-border bg-card p-5 transition-colors hover:border-primary/50"
                            >
                                <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-surface">
                                    <FileIcon name={item.file} className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold">{item.label}</span>
                                    <span className="mt-0.5 block text-sm text-muted-foreground">{item.blurb}</span>
                                </span>
                                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                            </Link>
                        ))}
                    </nav>
                </article>
            </div>
        </div>
    );
}

/**
 * One numbered part of a legal document: a big number, a short heading for
 * what it covers, then its text — on hairlines, with an anchor for the
 * contents list.
 */
export function LegalClause({ id, number, title, children }: { id: string; number: number; title: string; children: ReactNode }) {
    return (
        <section id={id} className="scroll-mt-28 border-t border-border py-7 first:border-t-0 first:pt-0">
            <div className="flex gap-5">
                <span aria-hidden className="w-10 shrink-0 pt-1 font-mono text-sm text-syn-comment tabular-nums">
                    §{String(number).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold leading-snug">{title}</h3>
                    <div className="mt-2.5 leading-relaxed text-foreground/80">{children}</div>
                </div>
            </div>
        </section>
    );
}
