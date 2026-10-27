"use client";

import ErrorState from "@/components/shared/ErrorState";

/** The learning player failed to render — under the Navbar, back to My learning. */
export default function LearnError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="container-page">
            <ErrorState {...props} homeHref="/dashboard" homeLabel="Back to My learning" />
        </div>
    );
}
