import { Minus, Plus } from "lucide-react";
import EditorWindow from "@/components/site/EditorWindow";
import Section from "@/components/site/Section";
import SectionHeader from "@/components/site/SectionHeader";
import { WHY } from "./content";

/**
 * Learning alone against learning here, set the way an editor shows a change:
 * the struggle on the left in red with a minus, what Half Coders does about it
 * on the right in green with a plus, row by row. Stacked on a phone.
 */
export default function HomeWhy() {
    return (
        <Section tone="surface" labelledBy="home-why-title">
            <SectionHeader id="home-why-title" eyebrow={WHY.eyebrow} title={WHY.title} description={WHY.description} align="center" />
            <EditorWindow tone="light" tabs={[{ name: "compare.diff", label: "পার্থক্য", active: true }]} className="mx-auto max-w-5xl">
                <div className="hidden grid-cols-2 border-b border-border text-sm font-semibold md:grid">
                    <p className="flex items-center gap-2 px-5 py-3 text-destructive-ink">
                        <Minus className="size-4" aria-hidden /> {WHY.alone}
                    </p>
                    <p className="flex items-center gap-2 border-l border-border px-5 py-3 text-success-ink">
                        <Plus className="size-4" aria-hidden /> {WHY.together}
                    </p>
                </div>
                <ul className="divide-y divide-border">
                    {WHY.rows.map((row) => (
                        <li key={row.together} className="grid md:grid-cols-2">
                            <p className="flex gap-3 bg-destructive/[0.04] px-5 py-4 text-muted-foreground">
                                <Minus className="mt-1 size-4 shrink-0 text-destructive-ink" aria-label={WHY.alone} />
                                {row.alone}
                            </p>
                            <p className="flex gap-3 bg-success/[0.05] px-5 py-4 font-medium md:border-l md:border-border">
                                <Plus className="mt-1 size-4 shrink-0 text-success-ink" aria-label={WHY.together} />
                                {row.together}
                            </p>
                        </li>
                    ))}
                </ul>
            </EditorWindow>
        </Section>
    );
}
