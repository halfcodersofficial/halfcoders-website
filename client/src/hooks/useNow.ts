"use client";

import { useEffect, useState } from "react";

/**
 * The current time, re-read every `intervalMs`. For status that is purely a
 * function of the clock — an outline item reading "Published" once its planned
 * time passes — so the page flips on its own instead of waiting for a refetch.
 */
export function useNow(intervalMs = 30_000): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);

    return now;
}
