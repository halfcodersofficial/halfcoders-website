const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A minimal, self-contained markdown-to-HTML pass — headings, bold, inline
 * code, links and bullet lists. Used for lesson notes and text lessons, both
 * written by people who aren't writing HTML.
 *
 * HTML-escaped first, so the source can never inject markup, and links are
 * limited to http(s) so a `javascript:` URL can't ride in on one. A full
 * markdown library would be more dependency than either feature needs.
 */
export const renderLightMarkdown = (markdown: string, emptyHtml = ""): string => {
    if (!markdown.trim()) return emptyHtml;

    let html = escapeHtml(markdown);
    html = html.replace(/^### (.+)$/gm, "<h4 class=\"mt-4 mb-1 font-semibold\">$1</h4>");
    html = html.replace(/^## (.+)$/gm, "<h3 class=\"mt-5 mb-1 text-lg font-semibold\">$1</h3>");
    html = html.replace(/^# (.+)$/gm, "<h2 class=\"mt-6 mb-2 text-xl font-bold\">$1</h2>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/`([^`]+)`/g, "<code class=\"rounded bg-secondary px-1 py-0.5 text-[0.85em]\">$1</code>");
    html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        "<a href=\"$2\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-primary underline\">$1</a>",
    );
    html = html.replace(/(?:^|\n)((?:- .+(?:\n|$))+)/g, (block) => {
        const items = block
            .trim()
            .split("\n")
            .map((line) => `<li>${line.replace(/^- /, "")}</li>`)
            .join("");
        return `\n<ul class="list-disc pl-5">${items}</ul>`;
    });

    // Block elements carry their own spacing; a <br/> after one would double it.
    html = html.replace(/(<\/(?:h[234]|ul)>)\n/g, "$1");
    return html.replace(/\n/g, "<br/>");
};
