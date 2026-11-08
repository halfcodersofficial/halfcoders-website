/**
 * Every API request still waiting on an answer, and when it went out — so
 * the page can tell the visitor to hang on when the server is slow to wake
 * (`SlowServerNotice`). A tiny store for `useSyncExternalStore`; `httpClient`
 * adds and removes the entries.
 *
 * Only reads (GET) count: an upload or a long save is slow for its own
 * reasons, and saying "getting things ready" over it would be wrong.
 */

const pending = new Map<number, number>();
const listeners = new Set<() => void>();
let nextId = 0;
let oldest: number | null = null;

const changed = () => {
    oldest = pending.size ? Math.min(...pending.values()) : null;
    listeners.forEach((listener) => listener());
};

/** A request went out: returns its ticket for `requestDone`. */
export const requestStarted = (): number => {
    nextId += 1;
    pending.set(nextId, Date.now());
    changed();
    return nextId;
};

/** It came back — answered or failed. */
export const requestDone = (ticket: number | undefined) => {
    if (ticket === undefined || !pending.delete(ticket)) return;
    changed();
};

export const subscribePendingRequests = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** When the longest-waiting request went out, or null when nothing is waiting. */
export const oldestPendingRequest = () => oldest;
