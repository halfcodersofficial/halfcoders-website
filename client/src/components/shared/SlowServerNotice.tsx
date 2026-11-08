"use client";

import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { oldestPendingRequest, subscribePendingRequests } from "@/lib/pendingRequests";
import { cn } from "@/lib/utils";

/** Quicker than this is an ordinary load — nothing to say. */
const SHOW_AFTER_MS = 4_000;
/** Past the usual wake-up time: say so, and point at the connection. */
const LONG_AFTER_MS = 150_000;

/** On learning pages the thing being readied is "the course"; elsewhere, "the page". */
const COURSE_PAGES = /^\/(courses|learn|bundles|dashboard|checkout)(\/|$)/;

/** What the visitor reads while they wait, in plain Bangla. */
export function PreparingMessage({ pathname, long = false, className }: { pathname: string; long?: boolean; className?: string }) {
    const what = COURSE_PAGES.test(pathname) ? "কোর্স" : "পেজ";
    return (
        <div lang="bn" className={cn("flex items-start gap-3", className)}>
            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
            <div className="min-w-0">
                <p className="text-sm font-semibold">{long ? "একটু বেশি সময় লাগছে…" : `${what} প্রস্তুত হচ্ছে, একটু অপেক্ষা করুন`}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {long
                        ? "আপনার ইন্টারনেট সংযোগ ঠিক আছে কিনা দেখে নিন। পেজটা নিজে থেকেই আবার চেষ্টা করছে।"
                        : "অনেকক্ষণ পর খুললে প্রথমবার ২ মিনিট পর্যন্ত লাগতে পারে। পেজটা নিজে থেকেই লোড হয়ে যাবে, রিফ্রেশ করার দরকার নেই।"}
                </p>
            </div>
        </div>
    );
}

/**
 * Shown over any page whose data is slow to come: after a quiet spell the
 * API takes a minute or two to wake, and a skeleton alone looks stuck. It
 * appears only once a read has waited a few seconds, never names the
 * hosting, and goes the moment the answer arrives. Mounted once, in the root
 * layout; `httpClient` feeds it (`lib/pendingRequests`).
 */
export default function SlowServerNotice() {
    const pathname = usePathname();
    const oldest = useSyncExternalStore(subscribePendingRequests, oldestPendingRequest, () => null);
    const [now, setNow] = useState(() => Date.now());

    // Tick only while something is waiting.
    useEffect(() => {
        if (oldest === null) return;
        const tick = window.setInterval(() => setNow(Date.now()), 1_000);
        return () => window.clearInterval(tick);
    }, [oldest]);

    if (oldest === null || now - oldest < SHOW_AFTER_MS) return null;

    return (
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-md rounded-card border border-border bg-card px-4 py-3 shadow-panel animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
                <PreparingMessage pathname={pathname} long={now - oldest >= LONG_AFTER_MS} />
            </div>
        </div>
    );
}
