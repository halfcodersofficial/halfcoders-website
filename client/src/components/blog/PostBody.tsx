import { Lightbulb } from "lucide-react";
import { Fragment } from "react";
import type { PostBlock, PostSection } from "@/content/blog/types";
import RichText from "./RichText";

/** One block of a section, in the long-form reading styles (`.prose-site`). */
function Block({ block }: { block: PostBlock }) {
    switch (block.type) {
        case "p":
            return (
                <p>
                    <RichText text={block.text} />
                </p>
            );

        case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
                <List>
                    {block.items.map((item) => (
                        <li key={item}>
                            <RichText text={item} />
                        </li>
                    ))}
                </List>
            );
        }

        case "code":
            // A file open in the editor: its language as the tab, the code as it is.
            return (
                <figure className="overflow-hidden rounded-panel border border-editor-line bg-editor text-editor-fg">
                    <div className="flex items-center justify-between border-b border-editor-line bg-editor-panel px-4 py-2 font-mono text-xs text-editor-muted">
                        <span lang="en">{block.lang}</span>
                    </div>
                    <pre lang="en" className="overflow-x-auto p-4 font-mono text-[0.85rem] leading-relaxed">
                        <code>{block.code}</code>
                    </pre>
                    {block.caption && (
                        <figcaption className="border-t border-editor-line px-4 py-2.5 text-sm text-editor-muted">
                            <RichText text={block.caption} />
                        </figcaption>
                    )}
                </figure>
            );

        case "note":
            return (
                <aside className="flex gap-3 border-l-2 border-primary bg-surface px-5 py-4">
                    <Lightbulb className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0">
                        {block.title && <p className="font-semibold text-foreground">{block.title}</p>}
                        <p className={block.title ? "mt-1" : undefined}>
                            <RichText text={block.text} />
                        </p>
                    </div>
                </aside>
            );

        case "table":
            return (
                <figure className="overflow-x-auto rounded-card border border-border">
                    <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                        <thead className="bg-surface">
                            <tr>
                                {block.head.map((cell) => (
                                    <th key={cell} scope="col" className="border-b border-border px-4 py-2.5 font-semibold">
                                        <RichText text={cell} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row) => (
                                <tr key={row.join("|")} className="border-b border-border last:border-b-0">
                                    {row.map((cell, index) =>
                                        index === 0 ? (
                                            <th key={index} scope="row" className="px-4 py-2.5 align-top font-semibold">
                                                <RichText text={cell} />
                                            </th>
                                        ) : (
                                            <td key={index} className="px-4 py-2.5 align-top text-foreground/85">
                                                <RichText text={cell} />
                                            </td>
                                        ),
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {block.caption && (
                        <figcaption className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground">
                            <RichText text={block.caption} />
                        </figcaption>
                    )}
                </figure>
            );
    }
}

/**
 * A post's sections, each an h2 (its id the contents list's anchor) and then
 * its blocks — all straight inside the reading column, so `.prose-site`
 * spaces them as it does every long page.
 */
export default function PostBody({ sections }: { sections: PostSection[] }) {
    return sections.map((section) => (
        <Fragment key={section.id}>
            <h2 id={section.id}>{section.heading}</h2>
            {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
            ))}
        </Fragment>
    ));
}
