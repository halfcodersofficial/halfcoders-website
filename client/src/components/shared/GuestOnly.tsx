"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { resolveLandingPath } from "@/lib/access";

/**
 * The credential screens, for people who don't have a session yet.
 *
 * Someone already signed in has no business on `/login` — leaving it reachable
 * meant an admin could sign in as themselves twice and, worse, that the back
 * button after signing in landed on a form that would just do it again. They go
 * to wherever they belong instead, honouring `?next=` when their role can
 * actually open it.
 *
 * Only people who *arrive* signed in are sent on. A sign-in that happens on
 * this screen is the form's to finish: it goes through the hand-off screen
 * (`/redirecting`), and leaping straight to the destination here would skip it.
 */
const noop = () => () => {};

export default function GuestOnly({ children }: { children: React.ReactNode }) {
    // False on the server and while hydrating, true after: the session's
    // loading flag can differ between the two, so the first paint is always
    // the placeholder and the form arrives once the page is live.
    const mounted = useSyncExternalStore(noop, () => true, () => false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading, isAuthenticated } = useSession();

    // Fixed the first time the session is known, and never again.
    const [arrival, setArrival] = useState<"guest" | "member" | null>(null);
    if (arrival === null && mounted && !isLoading) setArrival(isAuthenticated ? "member" : "guest");

    useEffect(() => {
        if (arrival !== "member" || !user) return;
        router.replace(resolveLandingPath(searchParams.get("next"), user.role));
    }, [arrival, user, router, searchParams]);

    if (arrival !== "guest") return <Skeleton className="h-80" />;

    return <>{children}</>;
}
