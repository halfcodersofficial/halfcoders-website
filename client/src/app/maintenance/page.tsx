import { Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Logo from "@/components/shared/Logo";
import EditorWindow from "@/components/site/EditorWindow";
import { Button } from "@/components/ui/button";
import { BRAND_NAME, BRAND_SHORT_NAME, SUPPORT_EMAIL } from "@/lib/brand";
import RetryButton from "./RetryButton";

// Kept out of search results: while it's up, every address shows this page.
export const metadata: Metadata = {
    title: { absolute: `Under maintenance | ${BRAND_NAME}` },
    robots: { index: false, follow: false },
};

/**
 * What every address shows while DEPLOYMENT_MODE is "staging" — middleware.ts
 * rewrites to it, keeping the visitor's own address in the bar. A small
 * editor window with an update running (a progress bar that keeps moving),
 * then what's happening in plain Bangla, the reassurance that nothing is
 * lost, and the two ways forward.
 */
export default function MaintenancePage() {
    return (
        <div lang="bn" className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />

            <header className="container-page relative pt-6 sm:pt-8">
                <Logo variant="horizontal" priority />
            </header>

            <main className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-5 pb-14 pt-10 text-center sm:px-8">
                <EditorWindow tabs={[{ name: "update.sh", label: "আপডেট চলছে", active: true }]} className="w-full text-left">
                    <div aria-hidden className="space-y-3 px-5 py-5">
                        <p className="text-sm text-editor-muted">নতুন ফিচার যোগ হচ্ছে…</p>
                        <div className="h-2 overflow-hidden rounded-full bg-editor-raised">
                            <div className="h-full w-1/3 animate-[maintenance-progress_2.4s_ease-in-out_infinite] rounded-full bg-violet-400 motion-reduce:w-2/3 motion-reduce:animate-none" />
                        </div>
                        <p className="text-xs text-editor-gutter">একটু পরেই সব আবার চালু হবে</p>
                    </div>
                </EditorWindow>

                <h1 className="mt-10 text-balance text-3xl font-bold sm:text-4xl">একটু পরেই ফিরছি</h1>
                <p className="mt-4 text-pretty text-muted-foreground">
                    কোর্স আর লেসনগুলো আরও ভালো করতে কিছু কাজ চলছে, তাই কিছুক্ষণের জন্য{" "}
                    <span className="whitespace-nowrap">{BRAND_SHORT_NAME}</span> বন্ধ রাখতে হয়েছে। কাজ শেষ হলেই সব আবার আগের মতো চলবে।
                </p>

                <p className="mt-6 inline-flex items-start gap-2.5 rounded-md border border-primary/20 bg-card px-4 py-3 text-left text-sm text-foreground/80">
                    <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                    আপনার প্রোগ্রেস আর সার্টিফিকেট যেমন ছিল তেমনই আছে — কিছুই হারাবে না।
                </p>

                <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
                    <RetryButton />
                    <Button asChild variant="outline" size="lg" className="w-full bg-card sm:w-auto">
                        <a href={`mailto:${SUPPORT_EMAIL}`}>
                            <Mail aria-hidden />
                            <span lang="en">{SUPPORT_EMAIL}</span>
                        </a>
                    </Button>
                </div>

                <p className="mt-12 text-sm font-medium text-muted-foreground">ধৈর্য ধরার জন্য ধন্যবাদ — {BRAND_SHORT_NAME} টিম</p>
            </main>
        </div>
    );
}
