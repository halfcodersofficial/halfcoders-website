import type { Metadata } from "next";
import { Suspense } from "react";
import ChangePasswordScreen from "@/components/auth/ChangePasswordScreen";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Change your password", robots: { index: false } };

export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-80" />}>
            <ChangePasswordScreen />
        </Suspense>
    );
}
