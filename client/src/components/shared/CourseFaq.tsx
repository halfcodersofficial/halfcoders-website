import { Plus } from "lucide-react";
import EditorWindow from "@/components/site/EditorWindow";
import Reveal from "@/components/site/Reveal";
import { langOf } from "@/lib/lang";
import { emphasiseLatin } from "@/lib/scriptEmphasis";
import type { CourseFaq as Faq } from "@/types/domain.types";

/**
 * A course's own questions, on the course page and in its admin preview, in
 * an editor pane: numbered like lines, each opening in place
 * (native `<details>`, so it works without JavaScript and a screen reader
 * announces it), the first open to begin with. The answers keep the admin's
 * line breaks, with their English terms in the stronger ink.
 */
export default function CourseFaq({ faqs, animate = false }: { faqs: Faq[]; animate?: boolean }) {
    if (faqs.length === 0) return null;

    const list = (
        <EditorWindow tone="light" tabs={[{ name: "faq.md", label: "প্রশ্নোত্তর", active: true }]} bodyClassName="divide-y divide-border">
            {faqs.map((faq, index) => (
                <details key={`${index}-${faq.question}`} data-reveal className="group" open={index === 0}>
                    <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-4 transition-colors hover:bg-surface [&::-webkit-details-marker]:hidden">
                        <span aria-hidden className="w-5 shrink-0 pt-1 text-right font-mono text-xs text-syn-comment">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 lang={langOf(faq.question)} className="flex-1 font-semibold">
                            {faq.question}
                        </h3>
                        <Plus
                            aria-hidden
                            className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:text-primary motion-reduce:transition-none"
                        />
                    </summary>
                    <p lang={langOf(faq.answer)} className="whitespace-pre-line pb-5 pl-14 pr-6 leading-relaxed text-muted-foreground">
                        {emphasiseLatin(faq.answer, "text-foreground")}
                    </p>
                </details>
            ))}
        </EditorWindow>
    );

    return animate ? <Reveal>{list}</Reveal> : list;
}
