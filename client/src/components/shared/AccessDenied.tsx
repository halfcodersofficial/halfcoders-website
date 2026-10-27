"use client";

import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout, type SessionAccessDenied } from "@/hooks/useSession";
import { confirmSignOut } from "@/lib/confirm";

const COPY: Record<string, { title: string; body: string }> = {
    LEARNING_BLOCKED: {
        title: "Your Half Coders access is blocked",
        body: "A Half Coders administrator has paused this account's access to courses. Please contact Half Coders support if you think this is a mistake.",
    },
    LEARNING_REMOVED: {
        title: "Your Half Coders access was removed",
        body: "This account no longer has access to Half Coders. Please contact Half Coders support if you think this is a mistake.",
    },
    ACCOUNT_INACTIVE: {
        title: "Your account isn't active",
        body: "Your account has been suspended, so it can't be used on Half Coders. Please contact support.",
    },
    ACCOUNT_UNVERIFIED: {
        title: "Verify your email first",
        body: "Sign out, then sign in again — we'll email you a code to verify your address.",
    },
};

/**
 * Shown instead of a console when the person is signed in but may not use
 * Half Coders right now. Deliberately not a redirect to sign in —
 * that would bounce straight back here.
 */
export default function AccessDenied({ denial }: { denial: SessionAccessDenied }) {
    const copy = COPY[denial.code] ?? { title: "You can't use Half Coders right now", body: denial.message };
    const logout = useLogout();

    return (
        <div className="container-page grid min-h-[60vh] place-items-center py-12">
            <div className="max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
                    <ShieldAlert className="size-6" />
                </span>
                <div className="space-y-2">
                    <h1 className="text-xl font-bold">{copy.title}</h1>
                    <p className="text-sm text-muted-foreground">{copy.body}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                    <Button
                        variant="ghost"
                        isLoading={logout.isPending}
                        onClick={async () => {
                            if (await confirmSignOut("Sign out")) logout.mutate();
                        }}
                    >
                        <LogOut className="size-3.5" /> Sign out
                    </Button>
                </div>
            </div>
        </div>
    );
}
