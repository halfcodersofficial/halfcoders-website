import path from "node:path";

/**
 * Text in the generated PDFs mixes scripts: a Taka sign, a Bangla course title
 * or student name, English around them. PDFKit's built-in Helvetica only
 * carries the WinAnsi character set, and a single character outside it turns
 * the whole string to mojibake ("৳1,099" printed as "Ÿ3"Ã#S"). So each run is
 * drawn in a font that has it: Helvetica for WinAnsi, Noto Sans Bengali for
 * the rest (Bangla, ৳, −). Noto Sans Bengali carries no Latin letters, which is
 * why the two are mixed rather than one replacing the other.
 *
 * The fonts ship in src/app/assets/fonts (SIL OFL, see OFL.txt beside them),
 * resolved from the working directory like the email templates, and copied
 * into the production image by Dockerfile.prod.
 */
const FONT_DIR = path.resolve(process.cwd(), "src/app/assets/fonts");

const UNICODE = "NotoSansBengali";
const UNICODE_BOLD = "NotoSansBengali-Bold";

/** Makes the Unicode fonts available to `doc`. Call once per document. */
export const registerPdfFonts = (doc: PDFKit.PDFDocument) => {
    doc.registerFont(UNICODE, path.join(FONT_DIR, "NotoSansBengali-Regular.ttf"));
    doc.registerFont(UNICODE_BOLD, path.join(FONT_DIR, "NotoSansBengali-Bold.ttf"));
};

/** The characters WinAnsi places in 0x80–0x9F, which Helvetica therefore has. */
const WIN_ANSI_EXTRA = new Set([
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
    0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const helveticaHas = (char: string) => {
    const code = char.codePointAt(0)!;
    return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(code);
};

interface Run {
    text: string;
    font: string;
}

/** Splits text into runs of one font each. */
const runsOf = (text: string, bold: boolean): Run[] => {
    const latin = bold ? "Helvetica-Bold" : "Helvetica";
    const unicode = bold ? UNICODE_BOLD : UNICODE;
    const runs: Run[] = [];
    for (const char of text) {
        // A space goes with whatever it follows, so a Bangla phrase stays one run.
        const font = char === " " && runs.length > 0 ? runs[runs.length - 1].font : helveticaHas(char) ? latin : unicode;
        const last = runs[runs.length - 1];
        if (last && last.font === font) last.text += char;
        else runs.push({ text: char, font });
    }
    return runs;
};

const widthOf = (doc: PDFKit.PDFDocument, runs: Run[], size: number) =>
    runs.reduce((sum, run) => sum + doc.font(run.font).fontSize(size).widthOfString(run.text), 0);

export interface MixedTextOptions {
    size: number;
    color: string;
    bold?: boolean;
    align?: "left" | "right";
    /** Wraps at spaces to this width; also the box a right-aligned line is set against. */
    width: number;
    lineHeight?: number;
}

/**
 * Draws `text` at (x, y) — y being the top of the first line, as for
 * `doc.text` in Helvetica — wrapping it to `width`, each run in a font that
 * has its characters and all of them on one baseline. Returns the height used.
 */
export const drawMixedText = (
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    { size, color, bold = false, align = "left", width, lineHeight = size * 1.3 }: MixedTextOptions,
): number => {
    // Greedy word wrap: a word that doesn't fit starts a new line.
    const lines: Run[][] = [];
    let line: Run[] = [];
    let lineWidth = 0;
    for (const token of text.split(/(\s+)/).filter(Boolean)) {
        const isSpace = /^\s+$/.test(token);
        const runs = runsOf(isSpace ? " " : token, bold);
        const tokenWidth = widthOf(doc, runs, size);
        if (!isSpace && line.length > 0 && lineWidth + tokenWidth > width) {
            lines.push(line);
            line = [];
            lineWidth = 0;
        }
        if (isSpace && line.length === 0) continue;
        line.push(...runs);
        lineWidth += tokenWidth;
    }
    if (line.length > 0) lines.push(line);

    // Helvetica's ascender, so a line sits where `doc.text` would have put it.
    const baselineOffset = size * 0.718;
    lines.forEach((runs, index) => {
        while (runs.length > 0 && /^\s+$/.test(runs[runs.length - 1].text)) runs.pop();
        const total = widthOf(doc, runs, size);
        let cursor = align === "right" ? x + width - total : x;
        const baseline = y + index * lineHeight + baselineOffset;
        for (const run of runs) {
            doc.font(run.font).fontSize(size).fillColor(color)
                .text(run.text, cursor, baseline, { lineBreak: false, baseline: "alphabetic" });
            cursor += doc.widthOfString(run.text);
        }
    });

    return lines.length * lineHeight;
};
