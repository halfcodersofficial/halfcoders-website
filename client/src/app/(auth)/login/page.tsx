import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";
import GuestOnly from "@/components/shared/GuestOnly";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-80" />}>
            <GuestOnly>
                <LoginForm />
            </GuestOnly>
        </Suspense>
    );
}
