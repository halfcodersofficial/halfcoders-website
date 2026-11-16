/**
 * First, last, current ±1, and an ellipsis over any gap — the numbered strip
 * a long list needs instead of just "Page 3 of 8", without ever rendering
 * every page's button at once: 1 … 4 5 6 … 34.
 */
export const paginationRange = (current: number, total: number): (number | "…")[] => {
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 1) pages.push(i);
    }

    const withDots: (number | "…")[] = [];
    let previous: number | undefined;
    for (const page of pages) {
        if (previous !== undefined && page - previous > 1) withDots.push("…");
        withDots.push(page);
        previous = page;
    }
    return withDots;
};
