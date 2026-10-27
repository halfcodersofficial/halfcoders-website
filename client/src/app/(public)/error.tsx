"use client";

import ErrorState from "@/components/shared/ErrorState";

/** A visitor page that failed to render — inside the site's header and footer. */
export default function PublicError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="container-page">
            <ErrorState {...props} />
        </div>
    );
}
