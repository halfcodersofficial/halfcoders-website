"use client";

import ErrorState from "@/components/shared/ErrorState";

/**
 * Reached only when a section's layout itself fails (the pages have their own
 * boundaries), so it brings no Navbar or Footer — they may be what broke.
 */
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main className="container-page flex min-h-dvh items-center justify-center">
            <ErrorState {...props} />
        </main>
    );
}
