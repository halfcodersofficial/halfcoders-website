/** `GET /testimonials`: up to twelve published reviews, in the order set in Admin → Testimonials. */
export interface PublicTestimonial {
    id: string;
    name: string;
    designation: string | null;
    avatar: string | null;
    quote: string;
    rating: number;
    course: { title: string; slug: string } | null;
}

/**
 * The reviews dealt into columns for a moving wall. Every column gets all the
 * reviews, each starting further along the list, so a phone's single column
 * still shows them all and the columns side by side don't line up; a column
 * repeats them until it holds at least `minPerColumn`, so it always overflows
 * its window and the loop never shows a gap.
 */
export function testimonialColumns<T>(items: T[], columns: number, minPerColumn: number): T[][] {
    return Array.from({ length: columns }, (_, column) => {
        const start = Math.floor((column * items.length) / columns);
        let list = [...items.slice(start), ...items.slice(0, start)];
        while (list.length > 0 && list.length < minPerColumn) list = [...list, ...list];
        return list;
    });
}
