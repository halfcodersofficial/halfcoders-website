import { BadgeCheck, Headset, Languages, Radio, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import CtaButton from "@/components/site/CtaButton";
import { TECH_STACK_ICONS } from "@/lib/techStackIcons";
import { cn } from "@/lib/utils";
import { HERO, type HeroFactIcon } from "./content";

/** Page-load rise, staggered with `animationDelay`; CSS, so it runs from the first paint. */
const RISE = "animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both motion-reduce:animate-none";

/** A logo arriving: a small pop instead of a rise. */
const POP = "animate-in fade-in zoom-in-75 duration-500 ease-out fill-mode-both motion-reduce:animate-none";

const FACT_ICON: Record<HeroFactIcon, { icon: LucideIcon; tone: string }> = {
    language: { icon: Languages, tone: "border-syn-func/30 bg-syn-func/10 text-syn-func" },
    live: { icon: Radio, tone: "border-syn-tag/30 bg-syn-tag/10 text-syn-tag" },
    mentor: { icon: Headset, tone: "border-syn-string/30 bg-syn-string/10 text-syn-string" },
    certificate: { icon: BadgeCheck, tone: "border-syn-number/30 bg-syn-number/10 text-syn-number" },
};

/**
 * The top of the homepage: one centred column on the dark editor surface.
 * First a row of logos — what the courses teach, each on a disc in its own
 * colour, bobbing gently — then the two-line headline (its first word
 * selected as in an editor, its last lit lavender with the editor's squiggle),
 * a line on what Half Coders is, the two ways in, and a card of what every
 * course gives.
 *
 * Behind it, the graph paper, a violet glow, and C++ scrolling slowly up the
 * edges, faint, clear of the words in the middle. Everything arrives in a
 * short stagger on load; with reduced motion asked for, nothing moves.
 */
export default function HomeHero() {
    return (
        <section data-nav-tone="dark" aria-labelledby="home-hero-title" className="editor relative overflow-hidden">
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 opacity-70" />
            <CodeField />
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-[40%] size-176 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
            <div aria-hidden className="pointer-events-none absolute -right-48 -top-56 size-144 rounded-full bg-violet-700/15 blur-3xl" />

            <div className="container-page relative flex flex-col items-center pb-16 pt-12 text-center sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
                <TechRow />

                <h1 id="home-hero-title" className="mt-9 max-w-4xl text-display text-balance sm:mt-11">
                    <span className={cn(RISE, "block")} style={{ animationDelay: "250ms" }}>
                        <span className="selected-text">{HERO.title.selected}</span>
                        {HERO.title.first}
                    </span>
                    <span className={cn(RISE, "block")} style={{ animationDelay: "400ms" }}>
                        {HERO.title.lead} <span className="hero-mark squiggle">{HERO.title.mark}</span>
                    </span>
                </h1>

                <p className={cn(RISE, "mt-6 max-w-2xl text-lead text-editor-muted")} style={{ animationDelay: "550ms" }}>
                    {HERO.description.map((part, index) =>
                        part.mark ? (
                            <strong key={index} className="font-semibold text-syn-keyword">
                                {part.text}
                            </strong>
                        ) : (
                            <span key={index}>{part.text}</span>
                        ),
                    )}
                </p>

                <div className={cn(RISE, "mt-9 flex flex-wrap justify-center gap-3")} style={{ animationDelay: "700ms" }}>
                    <CtaButton kind="enroll" size="lg" />
                    <CtaButton kind="courses" size="lg" />
                </div>

                <dl
                    className={cn(
                        RISE,
                        "mt-12 grid w-full max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-panel border border-editor-line bg-editor-line text-left shadow-panel sm:mt-14 lg:grid-cols-4",
                    )}
                    style={{ animationDelay: "850ms" }}
                >
                    {HERO.facts.map((fact) => {
                        const { icon: Icon, tone } = FACT_ICON[fact.icon];
                        return (
                            <div key={fact.icon} className="flex items-center gap-3 bg-editor-panel/95 px-4 py-4 sm:px-5">
                                <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-md border", tone)}>
                                    <Icon className="size-5" />
                                </span>
                                <div className="min-w-0">
                                    <dt className="text-xs text-editor-muted">{fact.label}</dt>
                                    <dd className="mt-0.5 font-semibold leading-snug text-editor-fg">{fact.value}</dd>
                                </div>
                            </div>
                        );
                    })}
                </dl>
            </div>
        </section>
    );
}

/**
 * The programming stack, as logo badges (see `HERO.stack`): each a glossy
 * disc in the tool's official colours with its logo on it. Each pops in,
 * then bobs on its own beat; under the pointer it lifts and glows in its
 * colour. The names are for screen readers only — nothing pops up on hover.
 */
function TechRow() {
    return (
        // Two even rows of six until there's room for all twelve on one line — never a lone logo on a row of its own.
        <ul aria-label={HERO.stackLabel} className="grid grid-cols-6 justify-items-center gap-2 sm:gap-3 lg:grid-cols-12">
            {HERO.stack.map(({ key, bg, fg }, index) => {
                const tech = TECH_STACK_ICONS[key];
                if (!tech) return null;
                const Icon = tech.icon;
                const colours = { "--from": bg[0], "--to": bg[1], "--fg": fg } as CSSProperties;
                return (
                    <li key={key} lang="en" className={POP} style={{ animationDelay: `${index * 55}ms` }}>
                        {/* A negative delay starts each one partway through its bob, so they never move in step. */}
                        <span className="hero-float block" style={{ animationDelay: `${-index * 0.7}s` }}>
                            <span className="hero-tech" style={colours}>
                                <Icon aria-hidden className="relative size-5 sm:size-6" />
                                <span className="sr-only">{tech.label}</span>
                            </span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

/* The code behind the hero: C++ of the kind the first course writes, plus a
   little HTML and git. Twelve distinct rows, each the snippets run together
   from a different start and offset, so no two rows line up; the field
   repeats them, which lets the drift loop seamlessly (see .hero-code-drift). */
const SNIPPETS = [
    "#include <iostream>",
    "using namespace std;",
    "int main() {",
    "for (int i = 0; i < n; i++) {",
    "sum += a[i];",
    "if (a[mid] < key) lo = mid + 1;",
    "else hi = mid - 1;",
    "vector<int> dp(n + 1, 0);",
    "sort(v.begin(), v.end());",
    'cout << "Hello, Half Coders!" << endl;',
    "while (lo <= hi) {",
    "int mid = (lo + hi) / 2;",
    "return 0;",
    "struct Node { int val; Node* next; };",
    'printf("%d\\n", ans);',
    "<h1>Hello, world</h1>",
    'git commit -m "first step"',
    "learn(); build(); grow();",
    "stack<int> st; st.push(x);",
    "map<string, int> freq;",
    "queue<int> q; q.push(src);",
    "long long ans = 0;",
];
const ROW_CHARS = 300;
const DISTINCT_ROWS = 12;
const FIELD_ROWS = 72;

const CODE_TEXT = (() => {
    const rows = Array.from({ length: DISTINCT_ROWS }, (_, row) => {
        let line = "";
        for (let i = (row * 7) % SNIPPETS.length; line.length < ROW_CHARS + 40; i = (i + 1) % SNIPPETS.length) {
            line += `${SNIPPETS[i]}    `;
        }
        const offset = (row * 13) % 40;
        return line.slice(offset, offset + ROW_CHARS);
    });
    return Array.from({ length: FIELD_ROWS }, (_, index) => rows[index % DISTINCT_ROWS]).join("\n");
})();

/** The faint code field: desktop widths only — narrower, the edges it lives in run into the words. */
function CodeField() {
    return (
        <div aria-hidden className="hero-code-field pointer-events-none absolute inset-0 hidden overflow-hidden select-none lg:block">
            <pre className="hero-code-drift absolute left-1/2 top-0 w-max -translate-x-1/2 font-mono text-[11px] leading-4.5 text-syn-keyword/10">
                {CODE_TEXT}
            </pre>
        </div>
    );
}
