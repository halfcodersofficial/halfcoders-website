import { Plus } from "lucide-react";
import RichText from "@/components/blog/RichText";

/**
 * Questions that open in place, each a native `<details>` — no JavaScript,
 * and every answer is in the page's HTML for search engines. The same rows as
 * the homepage's FAQ: a number, the question, a plus that turns into a cross,
 * a violet edge while open. Answers may use the inline marks of
 * components/blog/RichText (bold, code, links).
 */
export default function FaqList({
    items,
    start = 0,
}: {
    items: { q: string; a: string }[];
    /** Where numbering starts, for a list split into groups. */
    start?: number;
}) {
    return (
        <div className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-card">
            {items.map((item, index) => (
                <details
                    key={item.q}
                    className="faq-item group relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:origin-top before:scale-y-0 before:bg-primary before:transition-[scale] before:duration-300 open:bg-surface/40 open:before:scale-y-100"
                >
                    <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-4 transition-colors hover:bg-surface [&::-webkit-details-marker]:hidden">
                        <span
                            aria-hidden
                            className="w-5 shrink-0 pt-1 text-right font-mono text-xs text-syn-comment transition-colors group-open:font-semibold group-open:text-primary"
                        >
                            {String(start + index + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1 font-semibold">{item.q}</span>
                        <span
                            aria-hidden
                            className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-[rotate,background-color,border-color,color] duration-300 group-open:rotate-45 group-open:border-primary group-open:bg-primary group-open:text-primary-foreground motion-reduce:transition-none"
                        >
                            <Plus className="size-3.5" />
                        </span>
                    </summary>
                    <p className="pb-5 pl-14 pr-6 leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
                        <RichText text={item.a} />
                    </p>
                </details>
            ))}
        </div>
    );
}
