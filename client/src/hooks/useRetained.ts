import { useState } from "react";

/**
 * The value, or — once it goes back to null — the last one it held.
 *
 * A modal opened for an item usually closes by clearing the item, and that
 * would empty it mid-animation: the card shrinks to its × as it pops out.
 * Rendering from the retained item keeps the content on screen until the
 * modal has gone (and its content unmounts, so the next open starts clean).
 *
 * Pass state, not an object built during render: a new identity every render
 * would never settle.
 */
export function useRetained<T>(value: T | null): T | null {
    const [last, setLast] = useState(value);
    // Adjusting state while rendering, React's pattern for "remember the
    // previous prop" — cheaper than an effect, and never a frame behind.
    if (value !== null && value !== last) setLast(value);
    return value ?? last;
}
