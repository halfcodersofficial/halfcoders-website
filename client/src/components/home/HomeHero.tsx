import { Check, Circle, GitBranch, TerminalSquare } from "lucide-react";
import CtaButton from "@/components/site/CtaButton";
import { Prompt } from "@/components/site/code";
import EditorWindow from "@/components/site/EditorWindow";
import { cn } from "@/lib/utils";
import { HERO, type CodeLine } from "./content";

const KIND: Record<NonNullable<CodeLine["parts"][number]["kind"]>, string> = {
    kw: "text-syn-keyword",
    str: "text-syn-string",
    fn: "text-syn-func",
    num: "text-syn-number",
    cmt: "text-syn-comment",
    tag: "text-syn-tag",
    plain: "",
};

/* When each terminal line types itself in, after the page settles. */
const TERMINAL_DELAYS = ["0.5s", "1.5s", "2.2s"];

/**
 * The top of the homepage, on the dark editor surface and graph paper. On the
 * left the promise — a badge over a two-line headline whose last word wears
 * the editor's squiggle — and the two ways in. On the right a code window:
 * a first program with line numbers, a terminal under it that
 * compiles and runs it (each line types in once; nothing with reduced motion
 * asked for), and a violet status bar. Along the foot, four facts every
 * course gives.
 */
export default function HomeHero() {
    const { window: code } = HERO;

    return (
        <section data-nav-tone="dark" aria-labelledby="home-hero-title" className="editor relative overflow-hidden">
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
            <div aria-hidden className="pointer-events-none absolute -right-40 -top-48 size-168 rounded-full bg-violet-600/20 blur-3xl" />

            <div className="container-page relative grid grid-cols-1 gap-12 pb-14 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-14 lg:pb-20 lg:pt-20">
                <div>
                    <p className="inline-flex items-center gap-2 rounded-sm border border-editor-line bg-editor-panel px-3 py-1.5 text-sm text-editor-fg">
                        <TerminalSquare className="size-4 text-syn-string" aria-hidden />
                        {HERO.badge}
                    </p>
                    <h1 id="home-hero-title" className="mt-6 text-display text-balance">
                        <span className="block">{HERO.title.first}</span>
                        <span className="block">
                            {HERO.title.lead} <span className="squiggle text-syn-dark-keyword">{HERO.title.mark}</span>
                        </span>
                    </h1>
                    <p className="mt-6 max-w-xl text-lead text-editor-muted">{HERO.description}</p>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <CtaButton kind="enroll" size="lg" />
                        <CtaButton kind="courses" size="lg" />
                    </div>

                    <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-editor-muted">
                        {HERO.checks.map((check) => (
                            <li key={check} className="inline-flex items-center gap-1.5">
                                <Check className="size-4 text-syn-string" aria-hidden />
                                {check}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* The code window: decoration, so it's hidden from screen readers. */}
                <div aria-hidden lang="en" className="relative">
                    <EditorWindow
                        tabs={[{ name: code.file, active: true }, { name: code.other }]}
                        status={
                            <>
                                <span className="flex items-center gap-3">
                                    <span className="inline-flex items-center gap-1">
                                        <GitBranch className="size-3" /> {code.status.branch}
                                    </span>
                                    <span className="hidden sm:inline">{code.status.lang}</span>
                                </span>
                                <span className="flex items-center gap-3">
                                    <span className="hidden sm:inline">{code.status.position}</span>
                                    <span lang="bn" className="inline-flex items-center gap-1">
                                        <Circle className="size-2 fill-green-300 text-green-300" /> {code.status.state}
                                    </span>
                                </span>
                            </>
                        }
                    >
                        <ol className="code-lines overflow-x-auto py-4 font-mono text-[0.78rem] leading-6 sm:text-[0.82rem]">
                            {code.code.map((line, index) => (
                                <li key={index} className="whitespace-pre pl-12 pr-4">
                                    {"    ".repeat(line.indent ?? 0)}
                                    {line.parts.map((part, partIndex) => (
                                        <span
                                            key={partIndex}
                                            lang={part.kind === "cmt" ? "bn" : undefined}
                                            className={KIND[part.kind ?? "plain"]}
                                        >
                                            {part.text}
                                        </span>
                                    ))}
                                    {line.parts.length === 0 && " "}
                                </li>
                            ))}
                        </ol>

                        <div className="border-t border-editor-line bg-editor-panel px-4 py-3.5 font-mono text-[0.78rem] leading-6">
                            <p className="mb-1 text-[0.65rem] uppercase tracking-[0.16em] text-editor-gutter">Terminal</p>
                            {code.terminal.map((line, index) => (
                                <p
                                    key={line.text}
                                    lang={line.kind === "ok" ? "bn" : undefined}
                                    className={cn(
                                        "w-max max-w-full animate-type-in truncate motion-reduce:animate-none",
                                        line.kind === "out" && "text-editor-fg",
                                        line.kind === "ok" && "text-syn-string",
                                    )}
                                    style={{ animationDelay: TERMINAL_DELAYS[index] }}
                                >
                                    {line.kind === "cmd" ? <Prompt path="~/codebee">{line.text}</Prompt> : line.kind === "ok" ? `✓ ${line.text}` : line.text}
                                </p>
                            ))}
                            <p className="text-syn-keyword">
                                ${" "}
                                <span className="caret" />
                            </p>
                        </div>
                    </EditorWindow>
                </div>
            </div>

            <div className="relative border-t border-editor-line">
                <dl className="container-page grid grid-cols-2 lg:grid-cols-4">
                    {HERO.facts.map((fact, index) => (
                        <div
                            key={fact.label}
                            className={cn(
                                "flex flex-col gap-1.5 border-editor-line py-6 pr-4 sm:py-7",
                                index % 2 === 1 && "border-l pl-5 sm:pl-6",
                                index >= 2 && "border-t lg:border-t-0",
                                index === 2 && "lg:border-l lg:pl-6",
                            )}
                        >
                            <dt className="order-2 text-sm text-editor-muted">{fact.label}</dt>
                            <dd className="order-1 font-mono text-2xl font-semibold text-editor-fg sm:text-3xl">{fact.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}
