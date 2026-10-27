"use client";

import { Check, Circle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import AuthModeToggle from "@/components/shared/AuthModeToggle";
import Logo from "@/components/shared/Logo";
import EditorWindow from "@/components/site/EditorWindow";
import { BRAND_TAGLINE } from "@/lib/brand";

/** Only sign-in and sign-up get the switch — a password reset isn't a mode of it. */
const TOGGLE_ROUTES: Record<string, "login" | "register"> = {
    "/login": "login",
    "/register": "register",
};

/** What an account gives you, one numbered line each in the panel's window. */
const POINTS = [
    "ধাপে ধাপে সাজানো কোর্স — একদম শুরু থেকে",
    "মেন্টর আপনার কাজ রিভিউ করবেন",
    "আইডিসহ সার্টিফিকেট, যে কেউ যাচাই করতে পারে",
];

/**
 * Split shell for the account screens: the form on the left, the Half Coders
 * panel on the right — on the dark editor surface, the badge, the brand line,
 * and what an account opens as a small editor window. On a phone the panel
 * goes; there the form is the only thing worth the screen.
 *
 * The Sign In / Sign Up switch lives here rather than in each page so it
 * survives the navigation between them: its thumb glides across because the
 * element is the same one, not a fresh copy that starts in its final place.
 * The form beneath it remounts and slides in via `template.tsx`.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const mode = TOGGLE_ROUTES[pathname];

    return (
        <div className="grid min-h-dvh bg-background lg:grid-cols-2">
            <div className="relative flex flex-col px-5 py-8 sm:px-10 lg:px-16 lg:py-10">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 opacity-70" />

                <Link href="/" className="relative inline-flex w-fit items-center rounded-md" aria-label="Half Coders home">
                    <Logo priority />
                </Link>

                <main className="relative flex flex-1 flex-col justify-center py-10">
                    <div className="mx-auto w-full max-w-104">
                        {mode && (
                            <div className="mb-8">
                                <Suspense fallback={<div className="h-12 rounded-md bg-secondary" />}>
                                    <AuthModeToggle active={mode} />
                                </Suspense>
                            </div>
                        )}
                        {children}
                    </div>
                </main>

                <footer className="relative mx-auto max-w-md text-center">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Sign in to pick up your courses, keep your streak going and get help from your mentor.
                    </p>
                </footer>
            </div>

            {/* Pinned to the viewport, so the longer sign-up form scrolls past it rather than dragging it along. */}
            <aside
                className="editor auth-panel relative hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:items-center lg:justify-center lg:self-start"
                aria-hidden
            >
                <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />

                <div className="relative w-full max-w-md px-10 text-center">
                    <div className="relative mx-auto w-fit">
                        <div className="absolute inset-2 rounded-full bg-violet-500/35 blur-2xl" />
                        <Image src="/brand/trimmed/icon.png" alt="" width={160} height={160} priority className="relative size-32 drop-shadow-2xl" />
                    </div>
                    <p className="mt-8 font-heading text-4xl font-bold leading-tight">
                        {BRAND_TAGLINE.replace("Grow Together.", "")}
                        <span className="block text-syn-keyword">Grow Together.</span>
                    </p>

                    <EditorWindow
                        tabs={[{ name: "account.md", label: "অ্যাকাউন্টে যা পাবেন", active: true }]}
                        className="mt-10 bg-editor-panel/80 text-left backdrop-blur-sm"
                        status={
                            <>
                                <span>Half Coders</span>
                                <span lang="bn" className="inline-flex items-center gap-1.5 font-sans text-[0.72rem]">
                                    <Circle className="size-2 fill-green-300 text-green-300" /> একদম ফ্রি অ্যাকাউন্ট
                                </span>
                            </>
                        }
                    >
                        <ol className="code-lines py-3 text-[0.95rem] leading-8" lang="bn">
                            {POINTS.map((point) => (
                                <li key={point} className="flex items-start gap-2.5 pl-12 pr-4 text-editor-fg/90">
                                    <Check className="mt-1.5 size-4 shrink-0 text-syn-string" strokeWidth={3} />
                                    {point}
                                </li>
                            ))}
                        </ol>
                    </EditorWindow>
                </div>

                <p className="absolute inset-x-0 bottom-8 text-center font-mono text-xs text-syn-comment">
                    {"// your password is hashed — nobody at Half Coders can read it"}
                </p>
            </aside>
        </div>
    );
}
