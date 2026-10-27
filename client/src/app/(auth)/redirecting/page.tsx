import type { Metadata } from "next";
import { Suspense } from "react";
import RedirectingScreen from "@/components/auth/RedirectingScreen";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Signing you in", robots: { index: false } };

export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-80" />}>
            <RedirectingScreen />
        </Suspense>
    );
}
