import type { ReactNode } from "react";
import { ProfileSidebar } from "@/components/profile/ProfileSidebar";

/**
 * The shell a student's profile pages share: the checklist sidebar (desktop) /
 * identity card + pill nav (mobile) on the left, page content on the right.
 * Worn by `/dashboard/profile/*` and by `/dashboard/devices`, which sits in
 * the same sidebar but keeps the `/<home>/devices` address every role has.
 */
export function ProfileShell({ children }: { children: ReactNode }) {
    return (
        <div className="container-page max-w-6xl py-8 sm:py-12">
            <div className="lg:flex lg:gap-8">
                <ProfileSidebar />
                <main className="mt-6 min-w-0 flex-1 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both motion-reduce:animate-none lg:mt-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
