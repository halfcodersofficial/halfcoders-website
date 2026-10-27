import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-80" />}>
            <ResetPasswordForm />
        </Suspense>
    );
}
