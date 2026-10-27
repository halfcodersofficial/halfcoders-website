"use client";

import ErrorState from "@/components/shared/ErrorState";

/** An admin screen that failed to render — the console's sidebar stays usable. */
export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return <ErrorState {...props} homeHref="/admin" homeLabel="Back to the dashboard" />;
}
