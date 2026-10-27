"use client";

import { ArrowRight, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import EditorWindow from "@/components/site/EditorWindow";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
    error: Error & { digest?: string };
    reset: () => void;
    /** The section's own front page, so "back" keeps the visitor where they were. */
    homeHref?: string;
    homeLabel?: string;
};

/**
 * What every error boundary shows when a page fails to render: the failure as
 * a terminal would print it — an `Error:` line and, in production, the digest
 * (the only handle support has on the error; the message is hidden) — then
 * the ways forward.
 *
 * "Retry" refreshes the route as well as resetting the boundary — `reset`
 * alone re-renders with the server data that just failed.
 */
export default function ErrorState({ error, reset, homeHref = "/courses", homeLabel = "Browse all courses" }: ErrorStateProps) {
    const router = useRouter();
    const [retrying, startRetry] = useTransition();

    const retry = () =>
        startRetry(() => {
            router.refresh();
            reset();
        });

    return (
        <div className="flex flex-col items-center py-16 sm:py-24">
            <EditorWindow tabs={[{ name: "terminal.sh", label: "Terminal", active: true }]} className="w-full max-w-2xl">
                <div aria-hidden className="space-y-1 px-5 py-5 font-mono text-[0.8rem] leading-6 sm:px-6">
                    <p className="text-syn-tag">Error: this page failed to render</p>
                    <p className="text-editor-muted">    at the way to you (network or server)</p>
                    {error.digest && <p className="text-editor-muted">    digest: {error.digest}</p>}
                    <p className="pt-3 text-syn-comment">{"// retrying usually fixes it"}</p>
                </div>
            </EditorWindow>

            <h1 className="mt-10 text-center text-h2 text-balance">পেজটা লোড হলো না</h1>
            <p lang="bn" className="mt-3 max-w-md text-balance text-center text-muted-foreground">
                পথে কোথাও একটা সমস্যা হয়েছে। আবার চেষ্টা করলে সাধারণত ঠিক হয়ে যায়; না হলে আমাদের জানান।
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-2">
                <Button size="lg" variant="brand" onClick={retry} disabled={retrying}>
                    <RotateCw className={cn(retrying && "animate-spin motion-reduce:animate-none")} /> Retry
                </Button>
                <Button asChild size="lg" variant="outline">
                    <Link href={homeHref}>
                        {homeLabel} <ArrowRight />
                    </Link>
                </Button>
            </div>

            <p className="mt-10 max-w-md text-center text-sm text-muted-foreground">
                Still stuck? Email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary hover:underline">
                    {SUPPORT_EMAIL}
                </a>
                {error.digest ? (
                    <>
                        {" "}and mention <span className="font-mono text-foreground">{error.digest}</span>.
                    </>
                ) : (
                    "."
                )}
            </p>
        </div>
    );
}
