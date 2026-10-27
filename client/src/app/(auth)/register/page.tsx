import type { Metadata } from "next";
import { Suspense } from "react";
import RegisterForm from "@/components/auth/RegisterForm";
import GuestOnly from "@/components/shared/GuestOnly";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function Page() {
    return (
        <Suspense fallback={<Skeleton className="h-80" />}>
            <GuestOnly>
                <RegisterForm />
            </GuestOnly>
        </Suspense>
    );
}
