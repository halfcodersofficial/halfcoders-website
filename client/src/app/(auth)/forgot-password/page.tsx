import type { Metadata } from "next";
import { Suspense } from "react";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-80" />}>
            <ForgotPasswordForm />
        </Suspense>
    );
}
