import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyEmailForm from "@/components/auth/VerifyEmailForm";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };

export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-80" />}>
            <VerifyEmailForm />
        </Suspense>
    );
}
