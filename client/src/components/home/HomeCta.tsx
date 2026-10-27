import CtaButton from "@/components/site/CtaButton";
import { Prompt } from "@/components/site/code";
import EditorWindow from "@/components/site/EditorWindow";
import { CTA } from "./content";

/**
 * The closing call to action: a terminal where the visitor's first branch has
 * just been made, the ask under it, and the two ways in.
 */
export default function HomeCta() {
    return (
        <section aria-labelledby="home-cta-title" className="container-page pt-6">
            <EditorWindow tabs={[{ name: "terminal.sh", label: "Terminal", active: true }]} className="relative">
                <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
                <div className="relative grid grid-cols-1 gap-8 p-7 sm:p-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div>
                        <p lang="en" aria-hidden className="font-mono text-xs sm:text-sm">
                            <Prompt>{CTA.command}</Prompt>
                        </p>
                        <p lang="en" aria-hidden className="mt-1 font-mono text-xs text-editor-muted sm:text-sm">
                            {CTA.output}
                        </p>
                        <h2 id="home-cta-title" className="mt-8 text-h2 text-balance">
                            {CTA.title}
                        </h2>
                        <p className="mt-3 max-w-xl leading-relaxed text-editor-muted sm:text-lg">{CTA.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <CtaButton kind="enroll" size="lg" />
                        <CtaButton kind="courses" size="lg" />
                    </div>
                </div>
            </EditorWindow>
        </section>
    );
}
