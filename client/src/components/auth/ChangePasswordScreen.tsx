"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { resolveLandingPath } from "@/lib/access";
import { redirectToSignIn } from "@/lib/auth";

/**
 * Choosing your own password — where an account an admin made on a temporary
 * password lands before anything else (RoleGuard sends it here), and anyone
 * else who comes to change theirs.
 */
export default function ChangePasswordScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading, isAuthenticated } = useSession();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) redirectToSignIn(window.location.href);
    }, [isLoading, isAuthenticated]);

    if (isLoading || !user) return <Skeleton className="h-80" />;

    const temporary = user.needPasswordChange;
    return (
        <div className="space-y-6">
            <header className="text-center">
                <span className="mx-auto mb-4 grid size-12 place-items-center rounded-md border border-primary/30 bg-primary/5 text-primary">
                    <ShieldCheck className="size-6" />
                </span>
                <h1 className="text-2xl font-bold">{temporary ? "Choose your own password" : "Change your password"}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {temporary
                        ? "Your account was set up with a temporary password. Replace it with one only you know to carry on."
                        : "Enter your current password, then the new one."}
                </p>
            </header>
            <ChangePasswordForm
                submitLabel={temporary ? "Save and continue" : "Change password"}
                onDone={() => router.replace(resolveLandingPath(searchParams.get("next"), user.role))}
            />
        </div>
    );
}
