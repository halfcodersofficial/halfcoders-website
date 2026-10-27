"use client";

import ErrorState from "@/components/shared/ErrorState";
import "./globals.css";

/**
 * The root layout itself failed, so this replaces it — <html> and <body>
 * included. The self-hosted fonts are set up in that layout, so this page
 * falls back to the system faces in globals.css's font stack.
 */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body className="min-h-dvh">
                <main className="container-page flex min-h-dvh items-center justify-center">
                    <ErrorState {...props} />
                </main>
            </body>
        </html>
    );
}
