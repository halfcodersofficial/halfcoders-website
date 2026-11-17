import Link from "next/link";
import { Fragment } from "react";
import JsonLd from "@/components/shared/JsonLd";
import { FileIcon } from "@/components/site/EditorWindow";
import envConfig from "@/lib/envConfig";

export interface PathStep {
    label: string;
    /** Left out on the last step: the page you're on. */
    href?: string;
}

/**
 * Where the page sits, as the path bar along the top of a dark editor header
 * ("Home / Blog / this-post.md") — the same bar the course pages carry — and
 * the matching `BreadcrumbList` for search results, which show the trail in
 * place of a bare address. Goes first inside the header, above its content.
 */
export default function PathBar({
    steps,
    file,
}: {
    steps: PathStep[];
    /** The last step's file icon, by its extension ("post.md"). */
    file?: string;
}) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: steps.map((step, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: step.label,
            ...(step.href && { item: `${envConfig.siteUrl}${step.href}` }),
        })),
    };

    return (
        <div className="relative border-b border-editor-line bg-editor-panel">
            <nav aria-label="Breadcrumb" className="container-page flex items-center gap-1.5 overflow-hidden py-2 text-xs text-editor-muted">
                {steps.map((step, index) => (
                    <Fragment key={step.label}>
                        {index > 0 && <span aria-hidden>/</span>}
                        {step.href ? (
                            <Link href={step.href} className="shrink-0 hover:text-editor-fg">
                                {step.label}
                            </Link>
                        ) : (
                            <span aria-current="page" className="flex min-w-0 items-center gap-1.5 text-editor-fg">
                                {file && <FileIcon name={file} />}
                                <span className="truncate">{step.label}</span>
                            </span>
                        )}
                    </Fragment>
                ))}
            </nav>
            <JsonLd data={jsonLd} />
        </div>
    );
}
