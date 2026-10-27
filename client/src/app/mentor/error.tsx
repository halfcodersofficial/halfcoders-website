"use client";

import ErrorState from "@/components/shared/ErrorState";

/** A mentor screen that failed to render — the console's sidebar stays usable. */
export default function MentorError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return <ErrorState {...props} homeHref="/mentor" homeLabel="Back to the dashboard" />;
}
