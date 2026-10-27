/** Any character of the Bengali block — vowel signs, conjunct marks and digits included. */
export const BANGLA = /[ঀ-৿]/;

const BANGLA_LETTERS = /[ঀ-৿]/g;
const LATIN_LETTERS = /[A-Za-z]/g;

/**
 * "bn" for copy that is mostly Bangla, otherwise `undefined` — for the `lang`
 * attribute on text that comes from the database (course titles, summaries,
 * FAQs), where the page can't know the language in advance. Course copy is
 * Bangla with English technical terms ("ডাটা স্ট্রাকচার ও Algorithms"), so it
 * counts as Bangla once the Bangla letters at least match the English ones.
 *
 * `lang="bn"` gets Bangla its taller line (`:lang(bn)` in globals.css) and
 * tells screen readers which voice to use.
 */
export function langOf(text: string | null | undefined): "bn" | undefined {
    if (!text || !BANGLA.test(text)) return undefined;
    const bangla = text.match(BANGLA_LETTERS)?.length ?? 0;
    const latin = text.match(LATIN_LETTERS)?.length ?? 0;
    return bangla >= latin ? "bn" : undefined;
}

/**
 * Whole grapheme clusters, so a conjunct or a vowel sign never appears
 * half-typed — for anything that reveals or splits text a letter at a time.
 */
export const graphemesOf = (text: string): string[] =>
    typeof Intl.Segmenter === "function"
        ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (part) => part.segment)
        : Array.from(text);

const WORD_JOINER = "⁠";

/**
 * "C++", "C#", "F#" held together with invisible word joiners. Firefox's
 * line breaker treats the gap between two `+` as a break inside Bangla text,
 * and a course title wrapping as "… C+" / "+ দিয়ে" reads as a typo. For
 * display only — not for metadata, links or anything that is searched.
 */
export const keepSymbolsTogether = (text: string) =>
    text.replace(/([A-Za-z])([+#]+)/g, (_, letter: string, symbols: string) => [letter, ...symbols].join(WORD_JOINER));
