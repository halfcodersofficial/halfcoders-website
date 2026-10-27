"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import AccessDenied from "@/components/shared/AccessDenied";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { areaNameFor, homeFor } from "@/lib/access";
import { redirectToSignIn } from "@/lib/auth";
import type { Role } from "@/types/api.types";

interface RoleGuardProps {
    /** Roles allowed through. Omit to mean "any signed-in account". */
    allow?: readonly Role[];
    children: React.ReactNode;
    /** Replaces the default skeleton while the session resolves. */
    fallback?: React.ReactNode;
}

const DefaultFallback = () => (
    <div className="container-page space-y-4 py-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
    </div>
);

/**
 * The single navigation gate for every signed-in area.
 *
 * Anonymous visitors are sent to sign in (and back here afterwards); someone
 * signed in but not allowed in sees why; an account on a temporary password
 * chooses its own first (`/change-password`); and a
 * signed-in account that has wandered into somebody else's console is sent to
 * its own home with a word about why, rather than being shown an empty version
 * of a page that was never meant for it. Children never render for an account that fails the
 * check, so a page can't fire its queries and collect a 403 on the way out.
 *
 * This is navigation, not security: the API re-checks the same roles on every
 * request and is the boundary that actually holds.
 */
export default function RoleGuard({ allow, children, fallback }: RoleGuardProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isLoading, isAuthenticated, accessDenied } = useSession();

    const allowed = isAuthenticated && (!allow || (user != null && allow.includes(user.role)));

    // One toast per bounce: the effect re-runs while the redirect is in flight.
    const warned = useRef(false);

    useEffect(() => {
        if (isLoading || accessDenied) return;

        if (!isAuthenticated) {
            redirectToSignIn(window.location.href);
            return;
        }

        // Temporary password (e.g. a newly made mentor): they choose their
        // own first, then come back here.
        if (user?.needPasswordChange) {
            router.replace(`/change-password?next=${encodeURIComponent(pathname)}`);
            return;
        }

        if (allowed) return;

        if (!warned.current) {
            warned.current = true;
            toast.error(`That area isn't part of your ${areaNameFor(user?.role)}.`);
        }
        router.replace(homeFor(user?.role));
    }, [isLoading, allowed, isAuthenticated, accessDenied, user?.role, user?.needPasswordChange, router, pathname]);

    if (accessDenied) return <AccessDenied denial={accessDenied} />;

    if (isLoading || !allowed || user?.needPasswordChange) return <>{fallback ?? <DefaultFallback />}</>;

    return <>{children}</>;
}
