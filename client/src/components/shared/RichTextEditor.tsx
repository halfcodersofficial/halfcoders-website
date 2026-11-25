"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
    ALargeSmall,
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Baseline,
    Bold,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    Code,
    Columns2,
    Eye,
    Highlighter,
    Image as ImageIcon,
    IndentDecrease,
    IndentIncrease,
    Italic,
    Link as LinkIcon,
    List,
    ListChecks,
    ListOrdered,
    type LucideIcon,
    Minus,
    Omega,
    PenLine,
    Plus,
    RemoveFormatting,
    SquareCode,
    Strikethrough,
    Subscript,
    Superscript,
    Table,
    TextQuote,
    Type,
    Underline,
    Upload,
} from "lucide-react";
import {
    type ChangeEvent,
    type ClipboardEvent,
    type DragEvent,
    type KeyboardEvent,
    type ReactNode,
    type RefObject,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { menuItemClass } from "@/components/ui/menu";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { getApiErrorMessage } from "@/lib/httpClient";
import { HIGHLIGHT_COLORS, renderLightMarkdown, TEXT_COLORS, TEXT_FONTS, TEXT_SIZES } from "@/lib/lightMarkdown";
import { cn } from "@/lib/utils";

/**
 * The one text editor for anything written to be read as a page — a text
 * lesson, a student's notes. A word-processor toolbar (styles, fonts, sizes,
 * bold to subscript, colours, links, pictures, alignment, lists, indents,
 * quotes, code, tables, symbols) over a plain text box, with the page as
 * students will see it beside it, live.
 *
 * What's saved is the lesson text `lib/lightMarkdown.ts` describes: nobody has
 * to learn it — every button writes it — and it can never carry markup of its
 * own. Inside a `FormField` it wires itself up like `Textarea`; outside one,
 * pass `value` and `onChange`.
 */

type View = "write" | "split" | "preview";
type ListKind = "bullet" | "number" | "check";
type Align = "left" | "center" | "right" | "justify";

interface RichTextEditorProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    maxLength?: number;
    /** How tall the writing area starts; it can be dragged taller. Default 26rem. */
    height?: string;
    /** Where it opens — beside the preview, by default, on a wide screen. */
    defaultView?: View;
    /** Over the preview: what it shows. */
    previewLabel?: string;
    /**
     * Stores a picture and answers with its link. Turns on uploading in the
     * picture popup, and pasting or dropping a picture into the text.
     */
    onUploadImage?: (file: File) => Promise<string>;
    autoFocus?: boolean;
    className?: string;
}

const VIEW_KEY = "hc-editor-view";

// Arrows, maths, Greek, marks and a few emoji — space-separated, one each.
const SYMBOLS = (
    "→ ← ↑ ↓ ↔ ⇒ ⇐ ⇔ × ÷ ± ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∆ ∂ π θ α β γ λ μ σ Ω ° " + "² ³ ½ ¼ ¾ % ‰ • … — – © ® ™ ✓ ✗ ★ ☆ ⚠️ ✅ ❌ 💡 📌 🔥 👉 🎯 📝 🚀 ⭐ ❓"
).split(" ");

const TABLE_MAX = { rows: 8, columns: 8 };

const LIST_LINE = /^([ \t]*)([-*]|\d{1,9}[.)])\s+(\[[ xX]\]\s+)?/;
const HEADING_PREFIX = /^#{1,3}\s+/;
const ALIGN_OPEN = /^\s*:::\s*(left|center|right|justify)\s*$/;
const ALIGN_CLOSE = /^\s*:::\s*$/;
const VALUED = (kind: string) => ({
    open: new RegExp(`\\{${kind}=[a-z]+\\}$`),
    openAtStart: new RegExp(`^\\{${kind}=[a-z]+\\}`),
    any: new RegExp(`\\{\\/?${kind}(?:=[a-z]+)?\\}`, "g"),
});

const readView = (fallback: View): View => {
    try {
        const saved = window.localStorage.getItem(VIEW_KEY);
        return saved === "write" || saved === "split" || saved === "preview" ? saved : fallback;
    } catch {
        return fallback;
    }
};

export default function RichTextEditor({
    value: valueProp,
    onChange,
    placeholder = "Start writing…",
    maxLength,
    height = "26rem",
    defaultView = "split",
    previewLabel = "Preview — as students see it",
    onUploadImage,
    autoFocus,
    className,
}: RichTextEditorProps) {
    const field = useField();
    const value = valueProp ?? (field?.value as string | undefined) ?? "";
    const setValue = (next: string) => (onChange ? onChange(next) : field?.setValue(next));

    const textRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [view, setViewState] = useState<View>(defaultView);
    const [lineStyle, setLineStyle] = useState(0);
    const [mod, setMod] = useState("Ctrl+");
    const [linkOpen, setLinkOpen] = useState(false);
    const [imageOpen, setImageOpen] = useState(false);

    // The last view picked, on this device — read after mount, so the server
    // and the first render agree.
    useEffect(() => {
        setViewState(readView(defaultView));
        if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod("⌘");
    }, [defaultView]);

    const setView = (next: View) => {
        setViewState(next);
        try {
            window.localStorage.setItem(VIEW_KEY, next);
        } catch {
            // Private window — it just isn't remembered.
        }
        if (next !== "preview") requestAnimationFrame(() => textRef.current?.focus());
    };

    const html = useMemo(
        () => renderLightMarkdown(value, `<p class="text-muted-foreground">Nothing to preview yet — what you write shows up here.</p>`),
        [value],
    );

    // ---- Editing — every change goes through the browser's own typing, so
    // Ctrl+Z still undoes a toolbar change like any other.

    const replace = (start: number, end: number, text: string, selectFrom?: number, selectTo?: number) => {
        const el = textRef.current;
        if (!el) return;
        const from = selectFrom ?? start + text.length;
        const to = selectTo ?? from;
        const before = el.value;
        el.focus();
        el.setSelectionRange(start, end);
        let typed = false;
        try {
            typed = document.execCommand("insertText", false, text);
        } catch {
            typed = false;
        }
        // Not typed (an old browser), or typed only in part: set it outright,
        // from the text as it was.
        if (!typed || el.value !== before.slice(0, start) + text + before.slice(end)) {
            setValue(before.slice(0, start) + text + before.slice(end));
            requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(from, to);
            });
            return;
        }
        el.setSelectionRange(from, to);
    };

    const selection = () => {
        const el = textRef.current!;
        let start = el.selectionStart;
        let end = el.selectionEnd;
        // A double-click takes the space after a word too; a mark around it wouldn't take.
        while (end > start && /\s/.test(el.value[end - 1])) end--;
        while (start < end && /\s/.test(el.value[start])) start++;
        return { start, end, text: el.value, selected: el.value.slice(start, end) };
    };

    /** Bold, italic and the like: wraps the selection — or unwraps it, if it already is. */
    const toggleWrap = (open: string, close: string, placeholderText: string) => {
        const { start, end, text, selected } = selection();
        const outerOpen = text.slice(start - open.length, start) === open;
        const outerClose = text.slice(end, end + close.length) === close;
        // A single `*` beside `**` is half of a bold, not an italic.
        const italicInsideBold =
            open === "*" && (text[start - open.length - 1] === "*" || text[end + close.length] === "*") && text.slice(start - 3, start) !== "***";
        if (outerOpen && outerClose && !italicInsideBold) {
            replace(start - open.length, end + close.length, selected, start - open.length, end - open.length);
            return;
        }
        if (selected.length >= open.length + close.length && selected.startsWith(open) && selected.endsWith(close)) {
            const inner = selected.slice(open.length, selected.length - close.length);
            replace(start, end, inner, start, start + inner.length);
            return;
        }
        const inner = selected || placeholderText;
        replace(start, end, open + inner + close, start + open.length, start + open.length + inner.length);
    };

    /** Colour, highlight, font, size: sets the selection's — or takes it off, with `null`. */
    const setMark = (kind: "color" | "highlight" | "font" | "size", choice: string | null, placeholderText: string) => {
        let { start, end, selected } = selection();
        const { text } = selection();
        const pattern = VALUED(kind);
        const close = `{/${kind}}`;
        // Nothing selected, but the caret is in a marked stretch: that stretch is what changes.
        if (start === end) {
            for (const match of text.matchAll(new RegExp(`\\{${kind}=[a-z]+\\}[\\s\\S]*?\\{\\/${kind}\\}`, "g"))) {
                if (start >= match.index && start <= match.index + match[0].length) {
                    start = match.index + match[0].indexOf("}") + 1;
                    end = match.index + match[0].length - close.length;
                    selected = text.slice(start, end);
                    break;
                }
            }
        }
        const open = choice ? `{${kind}=${choice}}` : "";
        const before = text.slice(0, start).match(pattern.open);
        if (before && text.slice(end, end + close.length) === close) {
            const from = start - before[0].length;
            const next = choice ? open + selected + close : selected;
            replace(from, end + close.length, next, from + open.length, from + open.length + selected.length);
            return;
        }
        const own = selected.match(pattern.openAtStart);
        if (own && selected.endsWith(close)) {
            const inner = selected.slice(own[0].length, selected.length - close.length);
            const next = choice ? open + inner + close : inner;
            replace(start, end, next, start + open.length, start + open.length + inner.length);
            return;
        }
        if (!choice) {
            if (selected) replace(start, end, selected.replace(pattern.any, ""), start);
            return;
        }
        const inner = (selected || placeholderText).replace(pattern.any, "");
        replace(start, end, open + inner + close, start + open.length, start + open.length + inner.length);
    };

    /** The whole lines the selection touches, rewritten by `rewrite`. */
    const editLines = (rewrite: (lines: string[]) => string[]) => {
        const el = textRef.current!;
        const text = el.value;
        const collapsed = el.selectionStart === el.selectionEnd;
        let end = el.selectionEnd;
        if (!collapsed && text[end - 1] === "\n") end--;
        const lineStart = text.lastIndexOf("\n", el.selectionStart - 1) + 1;
        const nextBreak = text.indexOf("\n", end);
        const lineEnd = nextBreak === -1 ? text.length : nextBreak;
        const next = rewrite(text.slice(lineStart, lineEnd).split("\n")).join("\n");
        if (collapsed) replace(lineStart, lineEnd, next, lineStart + next.length);
        else replace(lineStart, lineEnd, next, lineStart, lineStart + next.length);
    };

    const setHeading = (level: number) =>
        editLines((lines) => lines.map((line) => (line.trim() ? (level ? `${"#".repeat(level)} ` : "") + line.replace(HEADING_PREFIX, "") : line)));

    const markerFor = (kind: ListKind, index: number) => (kind === "bullet" ? "- " : kind === "check" ? "- [ ] " : `${index + 1}. `);
    const isKind = (line: string, kind: ListKind) => {
        const match = line.match(LIST_LINE);
        if (!match) return false;
        if (kind === "check") return Boolean(match[3]);
        if (match[3]) return false;
        return kind === "number" ? /\d/.test(match[2]) : !/\d/.test(match[2]);
    };

    const toggleList = (kind: ListKind) =>
        editLines((lines) => {
            const filled = lines.filter((line) => line.trim());
            const allAlready = filled.length > 0 && filled.every((line) => isKind(line, kind));
            let index = 0;
            return lines.map((line) => {
                if (!line.trim() && lines.length > 1) return line;
                const indent = line.match(/^[ \t]*/)?.[0] ?? "";
                const body = line.replace(LIST_LINE, "").trimStart().replace(HEADING_PREFIX, "");
                return allAlready ? indent + body : indent + markerFor(kind, index++) + body;
            });
        });

    const toggleQuote = () =>
        editLines((lines) => {
            const all = lines.filter((line) => line.trim()).every((line) => /^\s*>/.test(line));
            return lines.map((line) => (all ? line.replace(/^\s*>\s?/, "") : `> ${line}`));
        });

    const indent = (deeper: boolean) => editLines((lines) => lines.map((line) => (deeper ? `  ${line}` : line.replace(/^(?: {1,2}|\t)/, ""))));

    const align = (to: Align) => {
        const el = textRef.current!;
        const text = el.value;
        const lineStart = text.lastIndexOf("\n", el.selectionStart - 1) + 1;
        let end = el.selectionEnd;
        if (end > el.selectionStart && text[end - 1] === "\n") end--;
        const nextBreak = text.indexOf("\n", end);
        const lineEnd = nextBreak === -1 ? text.length : nextBreak;
        // Already in an alignment block? Change it, or take it away for "left".
        const prevStart = text.lastIndexOf("\n", lineStart - 2) + 1;
        const prevLine = lineStart > 0 ? text.slice(prevStart, lineStart - 1) : "";
        const afterEnd = text.indexOf("\n", lineEnd + 1);
        const nextLine = lineEnd < text.length ? text.slice(lineEnd + 1, afterEnd === -1 ? text.length : afterEnd) : "";
        const body = text.slice(lineStart, lineEnd);
        if (ALIGN_OPEN.test(prevLine) && ALIGN_CLOSE.test(nextLine)) {
            const blockEnd = afterEnd === -1 ? text.length : afterEnd;
            const next = to === "left" ? body : `:::${to}\n${body}\n:::`;
            const bodyAt = prevStart + (to === "left" ? 0 : `:::${to}\n`.length);
            replace(prevStart, blockEnd, next, bodyAt, bodyAt + body.length);
            return;
        }
        if (to === "left") return;
        const open = `:::${to}\n`;
        replace(lineStart, lineEnd, `${open}${body}\n:::`, lineStart + open.length, lineStart + open.length + body.length);
    };

    /**
     * Something that stands on its own lines — a table, a line, a picture, a
     * code block — in place of `start`…`end` (the caret, by default), with
     * blank lines around it as needed. `selectFrom`/`selectTo` are inside `block`.
     */
    const insertBlock = (block: string, selectFrom?: number, selectTo?: number, range?: { start: number; end: number }) => {
        const el = textRef.current!;
        const text = el.value;
        const start = range?.start ?? el.selectionEnd;
        const end = range?.end ?? el.selectionEnd;
        const before = text.slice(0, start);
        const lead = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
        const after = text.slice(end);
        const trail = after.startsWith("\n") ? "\n" : after.length ? "\n\n" : "\n";
        const insert = lead + block + trail;
        const base = start + lead.length;
        replace(start, end, insert, selectFrom === undefined ? start + insert.length : base + selectFrom, selectTo === undefined ? undefined : base + selectTo);
    };

    const insertText = (snippet: string) => {
        const el = textRef.current!;
        replace(el.selectionStart, el.selectionEnd, snippet);
    };

    const codeBlock = () => {
        const { start, end, selected } = selection();
        if (selected) {
            insertBlock(`\`\`\`\n${selected}\n\`\`\``, 4, 4 + selected.length, { start, end });
            return;
        }
        insertBlock("```\ncode here\n```", 4, 13);
    };

    const insertTable = (rows: number, columns: number) => {
        const header = `| ${Array.from({ length: columns }, (_, index) => `Column ${index + 1}`).join(" | ")} |`;
        const rule = `| ${Array.from({ length: columns }, () => "---").join(" | ")} |`;
        const body = Array.from({ length: Math.max(0, rows - 1) }, () => `| ${Array.from({ length: columns }, () => " ").join(" | ")} |`);
        insertBlock([header, rule, ...body].join("\n"), 2, 2 + "Column 1".length);
    };

    const clearFormatting = () => {
        const el = textRef.current!;
        if (el.selectionStart === el.selectionEnd) {
            editLines((lines) => lines.map(stripMarks));
            return;
        }
        const { start, end, selected } = selection();
        const cleaned = stripMarks(selected);
        replace(start, end, cleaned, start, start + cleaned.length);
    };

    // ---- Pictures: pasted or dropped straight in, when they can be uploaded.

    const uploadAndInsert = async (file: File) => {
        if (!onUploadImage) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Only pictures can go in the text — JPEG, PNG or WebP.");
            return;
        }
        const waiting = toast.loading("Uploading the picture…");
        try {
            const url = await onUploadImage(file);
            toast.success("Picture added.", { id: waiting });
            insertBlock(`![${altFrom(file.name)}](${url})`);
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Couldn't upload the picture."), { id: waiting });
        }
    };

    const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
        const file = Array.from(event.clipboardData.files).find((candidate) => candidate.type.startsWith("image/"));
        if (!file || !onUploadImage) return;
        event.preventDefault();
        void uploadAndInsert(file);
    };

    const onDrop = (event: DragEvent<HTMLTextAreaElement>) => {
        const file = Array.from(event.dataTransfer.files).find((candidate) => candidate.type.startsWith("image/"));
        if (!file || !onUploadImage) return;
        event.preventDefault();
        void uploadAndInsert(file);
    };

    // ---- Keys: the word-processor shortcuts, and lists that carry on by themselves.

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        const el = event.currentTarget;
        const primary = event.ctrlKey || event.metaKey;
        if (primary && !event.altKey) {
            const shortcut: Record<string, () => void> = event.shiftKey
                ? {
                      Digit7: () => toggleList("number"),
                      Digit8: () => toggleList("bullet"),
                      Digit9: () => toggleList("check"),
                      KeyX: () => toggleWrap("~~", "~~", "struck text"),
                      KeyE: () => align("center"),
                  }
                : {
                      KeyB: () => toggleWrap("**", "**", "bold text"),
                      KeyI: () => toggleWrap("*", "*", "italic text"),
                      KeyU: () => toggleWrap("{u}", "{/u}", "underlined text"),
                      KeyK: () => setLinkOpen(true),
                      Period: () => toggleWrap("{sup}", "{/sup}", "2"),
                      Comma: () => toggleWrap("{sub}", "{/sub}", "2"),
                      Backslash: () => clearFormatting(),
                  };
            const run = shortcut[event.code];
            if (run) {
                event.preventDefault();
                run();
                return;
            }
        }
        if (primary && event.altKey && /^Digit[0-3]$/.test(event.code)) {
            event.preventDefault();
            setHeading(Number(event.code.slice(-1)));
            return;
        }

        if (el.selectionStart !== el.selectionEnd) {
            if (event.key === "Tab" && isListLine(el.value, el.selectionStart)) {
                event.preventDefault();
                indent(!event.shiftKey);
            }
            return;
        }

        const caret = el.selectionStart;
        const lineStart = el.value.lastIndexOf("\n", caret - 1) + 1;
        const line = el.value.slice(lineStart, caret);
        const list = line.match(LIST_LINE);

        if (event.key === "Tab" && list) {
            event.preventDefault();
            indent(!event.shiftKey);
            return;
        }

        if (event.key === "Enter" && !event.shiftKey && !primary && list) {
            event.preventDefault();
            const lineEndAt = el.value.indexOf("\n", caret);
            const rest = el.value.slice(caret, lineEndAt === -1 ? el.value.length : lineEndAt);
            // Enter on an empty item ends the list.
            if (!line.slice(list[0].length).trim() && !rest.trim()) {
                replace(lineStart, caret, "");
                return;
            }
            const [, whitespace, marker, tick] = list;
            const nextMarker = /\d/.test(marker) ? `${Number.parseInt(marker, 10) + 1}${marker.slice(-1)}` : marker;
            replace(caret, caret, `\n${whitespace}${nextMarker} ${tick ? "[ ] " : ""}`);
        }
    };

    // Which style the caret's line has — for the "Normal text" picker.
    const trackLine = () => {
        const el = textRef.current;
        if (!el) return;
        const lineStart = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
        const heading = el.value.slice(lineStart, lineStart + 4).match(/^(#{1,3})\s/);
        setLineStyle(heading ? heading[1].length : 0);
    };

    // Side by side, the preview follows the writing as it scrolls.
    const syncScroll = () => {
        const text = textRef.current;
        const preview = previewRef.current;
        if (!text || !preview || view !== "split") return;
        const ratio = text.scrollTop / Math.max(1, text.scrollHeight - text.clientHeight);
        preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
    };

    const k = (key: string) => `${mod}${key}`;
    const STYLE_LABELS = ["Normal text", "Heading 1", "Heading 2", "Heading 3"];

    return (
        <div
            className={cn(
                "overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring",
                field?.error && "border-destructive ring-1 ring-destructive/25",
                className,
            )}
        >
            {/* The toolbar — a word processor's, in the same order. */}
            <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/50 px-1.5 py-1">
                <ToolMenu label="Text style" trigger={<span className="w-24 truncate text-left text-sm">{STYLE_LABELS[lineStyle]}</span>} focus={textRef}>
                    {STYLE_LABELS.map((label, level) => (
                        <MenuRow key={label} onSelect={() => setHeading(level)} hint={k(`Alt+${level}`)}>
                            <span className={cn(level === 1 && "text-lg font-bold", level === 2 && "text-base font-semibold", level === 3 && "font-semibold")}>
                                {label}
                            </span>
                        </MenuRow>
                    ))}
                </ToolMenu>
                <Divider />
                <ToolMenu label="Font" trigger={<Type className="size-4" />} focus={textRef}>
                    <MenuRow onSelect={() => setMark("font", null, "")}>Default</MenuRow>
                    {Object.entries(TEXT_FONTS).map(([key, font]) => (
                        <MenuRow key={key} onSelect={() => setMark("font", key, "text")}>
                            <span className={font.className}>{font.label}</span>
                        </MenuRow>
                    ))}
                </ToolMenu>
                <ToolMenu label="Text size" trigger={<ALargeSmall className="size-4" />} focus={textRef}>
                    <MenuRow onSelect={() => setMark("size", "small", "text")}>
                        <span className="text-xs">{TEXT_SIZES.small.label}</span>
                    </MenuRow>
                    <MenuRow onSelect={() => setMark("size", null, "")}>Normal</MenuRow>
                    <MenuRow onSelect={() => setMark("size", "large", "text")}>
                        <span className="text-base">{TEXT_SIZES.large.label}</span>
                    </MenuRow>
                    <MenuRow onSelect={() => setMark("size", "huge", "text")}>
                        <span className="text-lg">{TEXT_SIZES.huge.label}</span>
                    </MenuRow>
                </ToolMenu>
                <Divider />
                <ToolButton label="Bold" shortcut={k("B")} icon={Bold} onClick={() => toggleWrap("**", "**", "bold text")} />
                <ToolButton label="Italic" shortcut={k("I")} icon={Italic} onClick={() => toggleWrap("*", "*", "italic text")} />
                <ToolButton label="Underline" shortcut={k("U")} icon={Underline} onClick={() => toggleWrap("{u}", "{/u}", "underlined text")} />
                <ToolButton label="Strikethrough" shortcut={k("Shift+X")} icon={Strikethrough} onClick={() => toggleWrap("~~", "~~", "struck text")} />
                <ColorMenu
                    label="Text colour"
                    icon={Baseline}
                    focus={textRef}
                    colors={Object.entries(TEXT_COLORS).map(([key, color]) => ({ key, label: color.label, swatch: color.swatch }))}
                    noneLabel="Default colour"
                    onPick={(color) => setMark("color", color, "coloured text")}
                />
                <ColorMenu
                    label="Highlight"
                    icon={Highlighter}
                    focus={textRef}
                    colors={Object.entries(HIGHLIGHT_COLORS).map(([key, color]) => ({ key, label: color.label, swatch: color.swatch }))}
                    noneLabel="No highlight"
                    onPick={(color) => setMark("highlight", color, "highlighted text")}
                />
                <Divider />
                <ToolButton label="Link" shortcut={k("K")} icon={LinkIcon} onClick={() => setLinkOpen(true)} />
                <ToolButton label="Picture" icon={ImageIcon} onClick={() => setImageOpen(true)} />
                <Divider />
                <ToolMenu label="Align" trigger={<AlignLeft className="size-4" />} focus={textRef}>
                    <MenuRow onSelect={() => align("left")} icon={AlignLeft}>
                        Left
                    </MenuRow>
                    <MenuRow onSelect={() => align("center")} icon={AlignCenter} hint={k("Shift+E")}>
                        Centre
                    </MenuRow>
                    <MenuRow onSelect={() => align("right")} icon={AlignRight}>
                        Right
                    </MenuRow>
                    <MenuRow onSelect={() => align("justify")} icon={AlignJustify}>
                        Justified
                    </MenuRow>
                </ToolMenu>
                <ToolButton label="Checklist" shortcut={k("Shift+9")} icon={ListChecks} onClick={() => toggleList("check")} />
                <ToolButton label="Bulleted list" shortcut={k("Shift+8")} icon={List} onClick={() => toggleList("bullet")} />
                <ToolButton label="Numbered list" shortcut={k("Shift+7")} icon={ListOrdered} onClick={() => toggleList("number")} />
                <ToolButton label="Decrease indent" shortcut="Shift+Tab" icon={IndentDecrease} onClick={() => indent(false)} />
                <ToolButton label="Increase indent" shortcut="Tab" icon={IndentIncrease} onClick={() => indent(true)} />
                <Divider />
                <ToolButton label="Quote" icon={TextQuote} onClick={toggleQuote} />
                <ToolButton label="Code" icon={Code} onClick={() => toggleWrap("`", "`", "code")} />
                <ToolButton label="Code block" icon={SquareCode} onClick={codeBlock} />
                <ToolButton label="Superscript" shortcut={k(".")} icon={Superscript} onClick={() => toggleWrap("{sup}", "{/sup}", "2")} />
                <ToolButton label="Subscript" shortcut={k(",")} icon={Subscript} onClick={() => toggleWrap("{sub}", "{/sub}", "2")} />
                <ToolButton label="Clear formatting" shortcut={k("\\")} icon={RemoveFormatting} onClick={clearFormatting} />
                <Divider />
                <InsertMenu
                    focus={textRef}
                    onImage={() => setImageOpen(true)}
                    onLink={() => setLinkOpen(true)}
                    onTable={insertTable}
                    onLine={() => insertBlock("---")}
                    onCodeBlock={codeBlock}
                    onChecklist={() => toggleList("check")}
                    onQuote={toggleQuote}
                    onSymbol={insertText}
                    onDate={() => insertText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }))}
                />

                {/* How it's shown — writing, the page, or both side by side. */}
                <div role="radiogroup" aria-label="View" className="ml-auto flex gap-0.5 rounded-md bg-background/70 p-0.5">
                    {(
                        [
                            { id: "write", label: "Write", icon: PenLine },
                            { id: "split", label: "Side by side", icon: Columns2 },
                            { id: "preview", label: "Preview", icon: Eye },
                        ] as const
                    ).map(({ id, label, icon: Icon }) => {
                        const active = view === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setView(id)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                                    // A phone has no room for two panes: there, "Side by side" is "Write".
                                    id === "split" && "hidden lg:inline-flex",
                                    id === "write" && view === "split" && "max-lg:bg-card max-lg:text-foreground max-lg:shadow-sm",
                                )}
                            >
                                <Icon className="size-3.5" aria-hidden />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={cn("grid min-h-40 resize-y overflow-hidden", view === "split" && "lg:grid-cols-2 lg:divide-x lg:divide-border")} style={{ height }}>
                <textarea
                    ref={textRef}
                    id={field?.id}
                    name={field?.name}
                    value={value}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setValue(event.target.value)}
                    onBlur={field?.onBlur}
                    onKeyDown={onKeyDown}
                    onSelect={trackLine}
                    onScroll={syncScroll}
                    onPaste={onPaste}
                    onDrop={onDrop}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    autoFocus={autoFocus}
                    spellCheck
                    aria-invalid={field?.error ? true : undefined}
                    aria-describedby={field?.describedBy}
                    aria-required={field?.required || undefined}
                    className={cn(
                        "block h-full min-h-0 w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed outline-none placeholder:text-muted-foreground sm:text-sm",
                        view === "preview" && "hidden",
                    )}
                />
                <div
                    ref={previewRef}
                    role="region"
                    aria-label={previewLabel}
                    className={cn("min-h-0 overflow-y-auto bg-card/40", view === "write" && "hidden", view === "split" && "hidden lg:block")}
                >
                    <p className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-1.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                        {previewLabel}
                    </p>
                    <div
                        className="px-4 py-3 text-[15px] leading-relaxed wrap-break-word"
                        // Escaped and restricted by renderLightMarkdown — see lib/lightMarkdown.ts.
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                </div>
            </div>

            <LinkDialog
                open={linkOpen}
                onOpenChange={setLinkOpen}
                initialText={() => (textRef.current ? selection().selected : "")}
                onInsert={(text, url) => {
                    const { start, end } = selection();
                    const label = text || url;
                    replace(start, end, `[${label}](${url})`, start + 1, start + 1 + label.length);
                }}
            />
            <ImageDialog open={imageOpen} onOpenChange={setImageOpen} onUploadImage={onUploadImage} onInsert={(url, alt) => insertBlock(`![${alt}](${url})`)} />
        </div>
    );
}

/** Marks and markers off a piece of text — bold, colours, headings, list bullets. */
const stripMarks = (text: string) =>
    text
        .replace(/\{\/?(?:color|highlight|font|size|u|sup|sub)(?:=[a-z]+)?\}/g, "")
        .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "$1")
        .replace(/(?<![*\w])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![*\w])/g, "$1")
        .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "$1")
        .replace(/`([^`\n]+)`/g, "$1")
        .replace(/^#{1,3}\s+/gm, "");

const isListLine = (text: string, at: number) => LIST_LINE.test(text.slice(text.lastIndexOf("\n", at - 1) + 1));

const altFrom = (fileName: string) =>
    fileName
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[[\]()]/g, "")
        .replace(/[-_]+/g, " ")
        .trim()
        .slice(0, 80) || "Picture";

/** A full link from what was typed — "example.com" gets its https://. */
const normaliseUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const url = new URL(withScheme);
        return /^https?:$/.test(url.protocol) && url.hostname.includes(".") ? url.toString() : "";
    } catch {
        return "";
    }
};

// ---- Toolbar pieces ---------------------------------------------------------

const toolClass =
    "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-background data-[state=open]:text-foreground";

function ToolButton({ label, shortcut, icon: Icon, onClick }: { label: string; shortcut?: string; icon: LucideIcon; onClick: () => void }) {
    return (
        <button
            type="button"
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-label={label}
            // Keeps the text's selection where it is.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={toolClass}
        >
            <Icon className="size-4" aria-hidden />
        </button>
    );
}

const Divider = () => <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />;

const menuContentClass =
    "z-[60] min-w-44 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";

/** A dropdown in the toolbar. Hands focus back to the text, not the button, when it closes. */
function ToolMenu({
    label,
    trigger,
    focus,
    children,
    align = "start",
}: {
    label: string;
    trigger: ReactNode;
    focus: RefObject<HTMLTextAreaElement | null>;
    children: ReactNode;
    align?: "start" | "end";
}) {
    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger type="button" title={label} aria-label={label} className={toolClass}>
                {trigger}
                <ChevronDown className="size-3 opacity-70" aria-hidden />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align={align}
                    sideOffset={6}
                    className={menuContentClass}
                    style={{ boxShadow: "var(--shadow-panel)" }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        focus.current?.focus();
                    }}
                >
                    {children}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

function MenuRow({ onSelect, icon: Icon, hint, children }: { onSelect: () => void; icon?: LucideIcon; hint?: string; children: ReactNode }) {
    return (
        <DropdownMenu.Item onSelect={onSelect} className={menuItemClass()}>
            {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
            <span className="flex-1">{children}</span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </DropdownMenu.Item>
    );
}

function ColorMenu({
    label,
    icon: Icon,
    focus,
    colors,
    noneLabel,
    onPick,
}: {
    label: string;
    icon: LucideIcon;
    focus: RefObject<HTMLTextAreaElement | null>;
    colors: { key: string; label: string; swatch: string }[];
    noneLabel: string;
    onPick: (color: string | null) => void;
}) {
    return (
        <ToolMenu label={label} trigger={<Icon className="size-4" />} focus={focus}>
            <p className="px-2 pb-1.5 pt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
            <div className="grid grid-cols-5 gap-1 px-1 pb-1">
                {colors.map((color) => (
                    <DropdownMenu.Item
                        key={color.key}
                        onSelect={() => onPick(color.key)}
                        title={color.label}
                        aria-label={color.label}
                        className="grid size-8 cursor-pointer place-items-center rounded-md outline-none data-highlighted:bg-secondary"
                    >
                        <span className={cn("size-5 rounded-full ring-1 ring-black/10 dark:ring-white/15", color.swatch)} />
                    </DropdownMenu.Item>
                ))}
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <MenuRow onSelect={() => onPick(null)}>{noneLabel}</MenuRow>
        </ToolMenu>
    );
}

function InsertMenu({
    focus,
    onImage,
    onLink,
    onTable,
    onLine,
    onCodeBlock,
    onChecklist,
    onQuote,
    onSymbol,
    onDate,
}: {
    focus: RefObject<HTMLTextAreaElement | null>;
    onImage: () => void;
    onLink: () => void;
    onTable: (rows: number, columns: number) => void;
    onLine: () => void;
    onCodeBlock: () => void;
    onChecklist: () => void;
    onQuote: () => void;
    onSymbol: (symbol: string) => void;
    onDate: () => void;
}) {
    const [hover, setHover] = useState({ rows: 2, columns: 2 });
    const subContent = cn(menuContentClass, "min-w-0");

    return (
        <ToolMenu
            label="Insert"
            trigger={
                <span className="inline-flex items-center gap-1 text-sm font-medium">
                    <Plus className="size-4" aria-hidden /> Insert
                </span>
            }
            focus={focus}
        >
            <MenuRow onSelect={onImage} icon={ImageIcon}>
                Picture
            </MenuRow>
            <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className={menuItemClass()}>
                    <Table className="size-4 text-muted-foreground" aria-hidden />
                    <span className="flex-1">Table</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.SubContent sideOffset={6} className={subContent} style={{ boxShadow: "var(--shadow-panel)" }}>
                        <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">
                            Table · {hover.columns} × {hover.rows}
                        </p>
                        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${TABLE_MAX.columns}, 1.25rem)` }}>
                            {Array.from({ length: TABLE_MAX.rows * TABLE_MAX.columns }, (_, index) => {
                                const rows = Math.floor(index / TABLE_MAX.columns) + 1;
                                const columns = (index % TABLE_MAX.columns) + 1;
                                const lit = rows <= hover.rows && columns <= hover.columns;
                                return (
                                    <DropdownMenu.Item
                                        key={index}
                                        aria-label={`${columns} columns, ${rows} rows`}
                                        onFocus={() => setHover({ rows, columns })}
                                        onPointerEnter={() => setHover({ rows, columns })}
                                        onSelect={() => onTable(rows, columns)}
                                        className={cn(
                                            "size-5 cursor-pointer rounded-[3px] border outline-none",
                                            lit ? "border-primary bg-primary/25" : "border-border bg-background",
                                        )}
                                    />
                                );
                            })}
                        </div>
                    </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
            </DropdownMenu.Sub>
            <MenuRow onSelect={onLink} icon={LinkIcon}>
                Link
            </MenuRow>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <MenuRow onSelect={onLine} icon={Minus}>
                Horizontal line
            </MenuRow>
            <MenuRow onSelect={onCodeBlock} icon={SquareCode}>
                Code block
            </MenuRow>
            <MenuRow onSelect={onChecklist} icon={ListChecks}>
                Checklist
            </MenuRow>
            <MenuRow onSelect={onQuote} icon={TextQuote}>
                Quote
            </MenuRow>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className={menuItemClass()}>
                    <Omega className="size-4 text-muted-foreground" aria-hidden />
                    <span className="flex-1">Symbols &amp; emoji</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.SubContent sideOffset={6} className={subContent} style={{ boxShadow: "var(--shadow-panel)" }}>
                        <div className="grid grid-cols-8 gap-0.5">
                            {SYMBOLS.map((symbol) => (
                                <DropdownMenu.Item
                                    key={symbol}
                                    onSelect={() => onSymbol(symbol)}
                                    aria-label={`Insert ${symbol}`}
                                    className="grid size-8 cursor-pointer place-items-center rounded-md text-base outline-none data-highlighted:bg-secondary"
                                >
                                    {symbol}
                                </DropdownMenu.Item>
                            ))}
                        </div>
                    </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
            </DropdownMenu.Sub>
            <MenuRow onSelect={onDate} icon={CalendarDays}>
                Today&apos;s date
            </MenuRow>
        </ToolMenu>
    );
}

// ---- Popups -------------------------------------------------------------------

function LinkDialog({
    open,
    onOpenChange,
    initialText,
    onInsert,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialText: () => string;
    onInsert: (text: string, url: string) => void;
}) {
    const [text, setText] = useState("");
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        setText(initialText());
        setUrl("");
        setError("");
        // Only as it opens — the selection is read once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = () => {
        const link = normaliseUrl(url);
        if (!link) {
            setError("Enter a full web address, like https://example.com");
            return;
        }
        onOpenChange(false);
        // After the popup lets go of focus, so the text box gets it back.
        requestAnimationFrame(() => onInsert(text.trim().replace(/[[\]]/g, ""), link));
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="sm" title="Add a link" description="It opens in a new tab.">
            <form
                className="flex min-h-0 flex-1 flex-col"
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    submit();
                }}
            >
                <ModalBody className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="rte-link-text">Text to show</Label>
                        <Input id="rte-link-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="The course roadmap" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="rte-link-url">Link</Label>
                        <Input
                            id="rte-link-url"
                            type="url"
                            inputMode="url"
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus
                            value={url}
                            onChange={(event) => {
                                setUrl(event.target.value);
                                setError("");
                            }}
                            placeholder="https://"
                            aria-invalid={error ? true : undefined}
                        />
                        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="submit">
                        <LinkIcon /> Add link
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}

function ImageDialog({
    open,
    onOpenChange,
    onUploadImage,
    onInsert,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploadImage?: (file: File) => Promise<string>;
    onInsert: (url: string, alt: string) => void;
}) {
    const [url, setUrl] = useState("");
    const [alt, setAlt] = useState("");
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setUrl("");
        setAlt("");
        setError("");
        setUploading(false);
    }, [open]);

    const finish = (link: string, description: string) => {
        onOpenChange(false);
        requestAnimationFrame(() => onInsert(link, description.trim().replace(/[[\]]/g, "") || "Picture"));
    };

    const upload = async (file: File | undefined) => {
        if (!file || !onUploadImage) return;
        if (!file.type.startsWith("image/")) {
            setError("Choose a picture — JPEG, PNG or WebP.");
            return;
        }
        setUploading(true);
        setError("");
        try {
            const link = await onUploadImage(file);
            finish(link, alt || altFrom(file.name));
        } catch (uploadError) {
            setError(getApiErrorMessage(uploadError, "Couldn't upload the picture."));
            setUploading(false);
        }
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title="Add a picture"
            description="It shows full width at most, and opens bigger when clicked."
        >
            <form
                className="flex min-h-0 flex-1 flex-col"
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const link = normaliseUrl(url);
                    if (!link) {
                        setError("Enter the picture's full web address, like https://example.com/photo.png");
                        return;
                    }
                    finish(link, alt);
                }}
            >
                <ModalBody className="space-y-4">
                    {onUploadImage && (
                        <>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="sr-only"
                                tabIndex={-1}
                                onChange={(event) => void upload(event.target.files?.[0])}
                            />
                            <Button type="button" variant="outline" className="w-full" isLoading={uploading} onClick={() => fileRef.current?.click()}>
                                {!uploading && <Upload />} {uploading ? "Uploading…" : "Upload from your computer"}
                            </Button>
                            <p className="text-center text-xs text-muted-foreground">You can also paste or drop a picture straight into the text.</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="h-px flex-1 bg-border" /> or use a link <span className="h-px flex-1 bg-border" />
                            </div>
                        </>
                    )}
                    <div className="space-y-1.5">
                        <Label htmlFor="rte-image-url">Picture&apos;s link</Label>
                        <Input
                            id="rte-image-url"
                            type="url"
                            inputMode="url"
                            autoComplete="off"
                            spellCheck={false}
                            value={url}
                            onChange={(event) => {
                                setUrl(event.target.value);
                                setError("");
                            }}
                            placeholder="https://example.com/photo.png"
                            aria-invalid={error ? true : undefined}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="rte-image-alt">
                            What it shows <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input id="rte-image-alt" value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Output of the program" />
                        <p className="text-xs text-muted-foreground">Read out to students who can&apos;t see it.</p>
                    </div>
                    {error && <p className="text-xs font-medium text-destructive">{error}</p>}
                </ModalBody>
                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={uploading}>
                        <ImageIcon /> Add picture
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
