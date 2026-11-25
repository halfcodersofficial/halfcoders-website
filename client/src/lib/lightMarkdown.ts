/**
 * Lesson text — what staff write in a text lesson and students in their notes,
 * through `RichTextEditor`'s toolbar — turned into HTML.
 *
 * Plain markdown for what markdown has (headings, **bold**, *italic*,
 * ~~strike~~, `code`, links, pictures, lists, checklists, quotes, tables, code
 * blocks, lines) and a few `{name=value}…{/name}` marks for what it doesn't:
 * colour, highlight, font, size, underline, super- and subscript, and
 * `:::center` … `:::` blocks for alignment.
 *
 * Safe by construction: the source is HTML-escaped before anything else, every
 * tag and class in the output is one written here, links and pictures must be
 * http(s), and a colour, font or size must be one of the lists below. So
 * nothing anyone types can add markup, a script or a style of its own.
 */

// Quotes too: a link's address goes inside an attribute, where a bare `"`
// would end it and let the rest of the text add attributes of its own.
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The text colours the toolbar offers — each readable in both themes. */
export const TEXT_COLORS = {
    red: { label: "Red", text: "text-red-600 dark:text-red-400", swatch: "bg-red-500" },
    orange: { label: "Orange", text: "text-orange-600 dark:text-orange-400", swatch: "bg-orange-500" },
    yellow: { label: "Yellow", text: "text-amber-600 dark:text-amber-300", swatch: "bg-amber-400" },
    green: { label: "Green", text: "text-green-600 dark:text-green-400", swatch: "bg-green-500" },
    teal: { label: "Teal", text: "text-teal-600 dark:text-teal-400", swatch: "bg-teal-500" },
    blue: { label: "Blue", text: "text-blue-600 dark:text-blue-400", swatch: "bg-blue-500" },
    purple: { label: "Purple", text: "text-violet-600 dark:text-violet-400", swatch: "bg-violet-500" },
    pink: { label: "Pink", text: "text-pink-600 dark:text-pink-400", swatch: "bg-pink-500" },
    gray: { label: "Grey", text: "text-zinc-500 dark:text-zinc-400", swatch: "bg-zinc-400" },
} as const;

/** The highlighter colours — soft enough that the text on them still reads. */
export const HIGHLIGHT_COLORS = {
    yellow: { label: "Yellow", bg: "bg-yellow-200/80 dark:bg-yellow-400/30", swatch: "bg-yellow-300" },
    green: { label: "Green", bg: "bg-green-200/80 dark:bg-green-400/25", swatch: "bg-green-300" },
    blue: { label: "Blue", bg: "bg-sky-200/80 dark:bg-sky-400/25", swatch: "bg-sky-300" },
    pink: { label: "Pink", bg: "bg-pink-200/80 dark:bg-pink-400/25", swatch: "bg-pink-300" },
    purple: { label: "Purple", bg: "bg-violet-200/80 dark:bg-violet-400/25", swatch: "bg-violet-300" },
    orange: { label: "Orange", bg: "bg-orange-200/80 dark:bg-orange-400/25", swatch: "bg-orange-300" },
} as const;

/** Fonts: the site's own faces, so Bangla still has a font in each. */
export const TEXT_FONTS = {
    serif: { label: "Serif", className: "font-serif" },
    rounded: { label: "Display", className: "font-heading" },
    mono: { label: "Code", className: "font-mono" },
} as const;

/** Sizes, relative to the text around them. */
export const TEXT_SIZES = {
    small: { label: "Small", className: "text-[0.85em]" },
    large: { label: "Large", className: "text-[1.2em]" },
    huge: { label: "Huge", className: "text-[1.5em] leading-snug" },
} as const;

const ALIGN = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
    justify: "text-justify",
} as const;

/** Placeholders for finished HTML while the rest of a line is still being worked on. */
const SLOT_OPEN = "\u0000";
const SLOT_CLOSE = "\u0001";

/** Every link opens in a new tab — a meeting or a form shouldn't take the student off the lesson. */
const anchor = (href: string, html: string) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer" class="break-all text-primary underline underline-offset-2">${html}</a>`;

/** A bare address stops before whitespace, a placeholder, a tag or an escaped `<`, `>` or quote. */
const BARE_URL = /https?:\/\/(?:(?!&(?:lt|gt|quot|#39);)[^\s<\u0000\u0001])+/g;

/** Bold, italic, strike and the `{…}` marks — on text that's already escaped. */
const formatMarks = (html: string): string => {
    let out = html;
    // Up to three rounds, so marks inside other marks are reached too.
    for (let round = 0; round < 3; round++) {
        const before = out;
        out = out
            .replace(/\{(color|highlight|font|size)=([a-z]+)\}([\s\S]*?)\{\/\1\}/g, (_match, kind: string, value: string, inner: string) => {
                const className =
                    kind === "color"
                        ? TEXT_COLORS[value as keyof typeof TEXT_COLORS]?.text
                        : kind === "highlight"
                          ? HIGHLIGHT_COLORS[value as keyof typeof HIGHLIGHT_COLORS]?.bg
                          : kind === "font"
                            ? TEXT_FONTS[value as keyof typeof TEXT_FONTS]?.className
                            : TEXT_SIZES[value as keyof typeof TEXT_SIZES]?.className;
                if (!className) return inner;
                return kind === "highlight"
                    ? `<mark class="rounded-sm px-0.5 text-inherit ${className}">${inner}</mark>`
                    : `<span class="${className}">${inner}</span>`;
            })
            .replace(/\{(u|sup|sub|highlight)\}([\s\S]*?)\{\/\1\}/g, (_match, kind: string, inner: string) => {
                if (kind === "u") return `<u class="underline-offset-2">${inner}</u>`;
                if (kind === "sup") return `<sup>${inner}</sup>`;
                if (kind === "sub") return `<sub>${inner}</sub>`;
                return `<mark class="rounded-sm px-0.5 text-inherit ${HIGHLIGHT_COLORS.yellow.bg}">${inner}</mark>`;
            });
        if (out === before) break;
    }
    return (
        out
            .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, "<strong><em>$1</em></strong>")
            .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
            // A lone `*` between letters or digits (2*3*4) is maths, not italics.
            .replace(/(?<![*\w])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![*\w])/g, "<em>$1</em>")
            .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<s>$1</s>")
    );
};

/** One run of text — a paragraph, a heading, a list item or a table cell. */
const renderInline = (source: string): string => {
    const slots: string[] = [];
    const keep = (html: string) => `${SLOT_OPEN}${slots.push(html) - 1}${SLOT_CLOSE}`;

    let html = escapeHtml(source);
    // Code first: what's inside it is shown exactly as typed, backslashes and all.
    html = html.replace(/`([^`\n]+)`/g, (_match, code: string) =>
        keep(`<code class="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em]">${code}</code>`),
    );
    // `\*` and friends: the character itself, never a mark.
    html = html.replace(/\\([\\*_{}[\]()#+\-.!|~=>^:])/g, (_match, char: string) => keep(char));
    html = html.replace(/!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g, (_match, alt: string, src: string) =>
        keep(
            `<a href="${src}" target="_blank" rel="noopener noreferrer" class="inline-block max-w-full align-middle"><img src="${src}" alt="${alt}" loading="lazy" class="my-1 inline-block h-auto max-w-full rounded-lg border border-border" /></a>`,
        ),
    );
    html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, text: string, href: string) => keep(anchor(href, formatMarks(text))));
    html = html.replace(BARE_URL, (match) => {
        // A full stop or bracket after it is the sentence's, not the link's.
        const url = match.replace(/[.,;:!?)\]]+$/, "");
        return keep(anchor(url, url)) + match.slice(url.length);
    });
    html = formatMarks(html);

    // Slots can hold slots (a code span inside a link's text) — undo them all.
    const slot = new RegExp(`${SLOT_OPEN}(\\d+)${SLOT_CLOSE}`, "g");
    for (let round = 0; round < 4 && html.includes(SLOT_OPEN); round++) {
        html = html.replace(slot, (_match, index: string) => slots[Number(index)] ?? "");
    }
    return html;
};

/** Lines of text kept as lines; leading spaces become an indent (two to a step). */
const renderLines = (lines: string[]) =>
    renderInline(
        lines
            .map((line) => {
                const indent = line.match(/^[ \t]*/)?.[0].replace(/\t/g, "    ").length ?? 0;
                return " ".repeat(Math.floor(indent / 2)) + line.trimStart();
            })
            .join("\n"),
    ).replace(/\n/g, "<br/>");

const HEADING: Record<number, string> = {
    1: `<h2 class="mb-2 mt-6 text-xl font-bold leading-snug first:mt-0">`,
    2: `<h3 class="mb-1.5 mt-5 text-lg font-semibold leading-snug first:mt-0">`,
    3: `<h4 class="mb-1 mt-4 font-semibold first:mt-0">`,
};
const HEADING_CLOSE: Record<number, string> = { 1: "</h2>", 2: "</h3>", 3: "</h4>" };

const FENCE = /^\s*```\s*([\w+#.-]*)\s*$/;
const FENCE_END = /^\s*```\s*$/;
const ALIGN_OPEN = /^\s*:::\s*(left|center|right|justify)\s*$/;
const ALIGN_CLOSE = /^\s*:::\s*$/;
const HEADING_LINE = /^(#{1,3})\s+(.+)$/;
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s*>/;
const LIST_ITEM = /^([ \t]*)([-*]|\d{1,9}[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/;

const startsBlock = (line: string, next: string | undefined) =>
    FENCE.test(line) ||
    ALIGN_OPEN.test(line) ||
    HEADING_LINE.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    (TABLE_ROW.test(line) && next !== undefined && TABLE_RULE.test(next));

const cellsOf = (line: string) => {
    let row = line.trim();
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
    return row.split(/(?<!\\)\|/).map((cell) => cell.trim());
};

const renderTable = (header: string, rule: string, rows: string[]) => {
    const aligns = cellsOf(rule).map((cell) => (cell.startsWith(":") && cell.endsWith(":") ? "text-center" : cell.endsWith(":") ? "text-right" : "text-left"));
    const head = cellsOf(header);
    const columns = Math.max(head.length, aligns.length);
    const cell = (tag: "th" | "td", text: string | undefined, column: number) =>
        `<${tag} class="border border-border px-3 py-2 align-top ${aligns[column] ?? "text-left"}${tag === "th" ? " bg-secondary/60 font-semibold" : ""}">${renderInline(text ?? "")}</${tag}>`;
    const row = (cells: string[], tag: "th" | "td") => `<tr>${Array.from({ length: columns }, (_, column) => cell(tag, cells[column], column)).join("")}</tr>`;
    return (
        `<div class="my-3 max-w-full overflow-x-auto"><table class="w-full border-collapse text-[0.95em]">` +
        `<thead>${row(head, "th")}</thead>` +
        `<tbody>${rows.map((line) => row(cellsOf(line), "td")).join("")}</tbody></table></div>`
    );
};

interface ListItem {
    indent: number;
    ordered: boolean;
    number: number;
    /** null: not a checklist item; otherwise whether it's ticked. */
    checked: boolean | null;
    lines: string[];
    children: ListItem[];
}

const widthOf = (whitespace: string) => whitespace.replace(/\t/g, "    ").length;

/** Consecutive list lines into a tree — deeper-indented items belong to the one above. */
const listTree = (lines: string[]) => {
    const roots: ListItem[] = [];
    const stack: ListItem[] = [];
    for (const line of lines) {
        const match = line.match(LIST_ITEM);
        if (!match) {
            // A continuation line: more text for the item above.
            stack[stack.length - 1]?.lines.push(line.trim());
            continue;
        }
        const [, whitespace, marker, tick, text] = match;
        const item: ListItem = {
            indent: widthOf(whitespace),
            ordered: /\d/.test(marker),
            number: Number.parseInt(marker, 10) || 1,
            checked: tick === undefined ? null : tick.toLowerCase() === "x",
            lines: [text],
            children: [],
        };
        while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) stack.pop();
        (stack.length > 0 ? stack[stack.length - 1].children : roots).push(item);
        stack.push(item);
    }
    return roots;
};

const CHECKBOX = {
    on: `<span aria-hidden="true" class="mr-2 inline-grid size-4 shrink-0 translate-y-[0.15em] place-items-center rounded border border-primary bg-primary text-[0.7em] font-bold leading-none text-primary-foreground">✓</span>`,
    off: `<span aria-hidden="true" class="mr-2 inline-block size-4 shrink-0 translate-y-[0.15em] rounded border border-muted-foreground/60"></span>`,
};

const renderList = (items: ListItem[]): string => {
    let html = "";
    // Bullets and numbers side by side are two lists, one after the other.
    for (let start = 0; start < items.length;) {
        let end = start;
        while (end < items.length && items[end].ordered === items[start].ordered) end++;
        const group = items.slice(start, end);
        const ordered = group[0].ordered;
        const allChecks = group.every((item) => item.checked !== null);
        const open = ordered
            ? `<ol class="my-2 list-decimal space-y-1 pl-6"${group[0].number !== 1 ? ` start="${group[0].number}"` : ""}>`
            : `<ul class="my-2 space-y-1 ${allChecks ? "list-none pl-1" : "list-disc pl-6"}">`;
        html += open;
        for (const item of group) {
            const box =
                item.checked === null ? "" : `<span class="sr-only">${item.checked ? "Done: " : "To do: "}</span>${item.checked ? CHECKBOX.on : CHECKBOX.off}`;
            const text = renderLines(item.lines);
            const done = item.checked ? ` class="text-muted-foreground line-through decoration-muted-foreground/60"` : "";
            const children = item.children.length > 0 ? renderList(item.children) : "";
            html += `<li${item.checked !== null && !allChecks ? ` class="list-none -ml-5"` : ""}>${box}<span${done}>${text}</span>${children}</li>`;
        }
        html += ordered ? "</ol>" : "</ul>";
        start = end;
    }
    return html;
};

const renderBlocks = (lines: string[]): string => {
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
            i++;
            continue;
        }

        const fence = line.match(FENCE);
        if (fence) {
            const body: string[] = [];
            i++;
            while (i < lines.length && !FENCE_END.test(lines[i])) body.push(lines[i++]);
            i++;
            out.push(
                `<pre class="my-3 max-w-full overflow-x-auto rounded-lg border border-border bg-secondary/60 p-3 font-mono text-[0.85em] leading-relaxed"><code>${escapeHtml(body.join("\n"))}</code></pre>`,
            );
            continue;
        }

        const align = line.match(ALIGN_OPEN);
        if (align) {
            const body: string[] = [];
            let depth = 0;
            i++;
            while (i < lines.length) {
                if (ALIGN_OPEN.test(lines[i])) depth++;
                else if (ALIGN_CLOSE.test(lines[i])) {
                    if (depth === 0) break;
                    depth--;
                }
                body.push(lines[i++]);
            }
            i++;
            out.push(`<div class="${ALIGN[align[1] as keyof typeof ALIGN]}">${renderBlocks(body)}</div>`);
            continue;
        }

        const heading = line.match(HEADING_LINE);
        if (heading) {
            const level = heading[1].length;
            out.push(`${HEADING[level]}${renderInline(heading[2].trim())}${HEADING_CLOSE[level]}`);
            i++;
            continue;
        }

        if (RULE.test(line)) {
            out.push(`<hr class="my-5 border-t border-border" />`);
            i++;
            continue;
        }

        if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
            const header = line;
            const rule = lines[i + 1];
            const rows: string[] = [];
            i += 2;
            while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(lines[i++]);
            out.push(renderTable(header, rule, rows));
            continue;
        }

        if (QUOTE.test(line)) {
            const body: string[] = [];
            while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
            out.push(
                `<blockquote class="my-3 rounded-r-lg border-l-4 border-primary/50 bg-secondary/40 py-1.5 pl-4 pr-3 text-muted-foreground">${renderBlocks(body)}</blockquote>`,
            );
            continue;
        }

        if (LIST_ITEM.test(line)) {
            const body: string[] = [];
            // Items, and indented lines that carry an item on.
            while (i < lines.length && lines[i].trim() && (LIST_ITEM.test(lines[i]) || /^[ \t]+\S/.test(lines[i]))) body.push(lines[i++]);
            out.push(renderList(listTree(body)));
            continue;
        }

        const paragraph: string[] = [];
        while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !startsBlock(lines[i], lines[i + 1]))) paragraph.push(lines[i++]);
        out.push(`<p class="my-3 first:mt-0 last:mb-0">${renderLines(paragraph)}</p>`);
    }
    return out.join("");
};

/**
 * The whole text, as HTML — `emptyHtml` when there's nothing but whitespace.
 * See the top of this file for what it understands and why it's safe.
 */
export const renderLightMarkdown = (markdown: string, emptyHtml = ""): string => {
    if (!markdown.trim()) return emptyHtml;
    // Placeholder characters can't come from the text itself.
    const source = markdown.replace(/\r\n?/g, "\n").replace(/[\u0000\u0001]/g, "");
    return renderBlocks(source.split("\n"));
};

/** The words alone, without marks — for word counts and reading times. */
export const lightMarkdownToText = (markdown: string): string =>
    markdown
        .replace(/\{\/?(?:color|highlight|font|size|u|sup|sub)(?:=[a-z]+)?\}/g, "")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/^\s*(?:#{1,3}\s|>\s?|:::\s*\w*|```.*|\|?\s*:?-{3,}.*)/gm, "")
        .replace(/[*~`|]/g, " ");
