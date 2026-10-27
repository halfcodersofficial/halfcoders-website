"use client";

import { useEffect, useState } from "react";

/**
 * The value, but only once it has stopped changing for `delay` ms.
 *
 * Search boxes in the admin console fire a request per keystroke otherwise —
 * a name typed at speed would send a dozen queries and render the results of
 * whichever one came back last, not necessarily the one for the full term.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}
