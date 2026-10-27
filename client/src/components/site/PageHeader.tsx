import type { ReactNode } from "react";
import { Eyebrow } from "@/components/site/code";
import { langOf } from "@/lib/lang";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
    title: ReactNode;
    /** Set as a code comment above the title: `// eyebrow`. */
    eyebrow?: ReactNode;
    description?: ReactNode;
    /** `<Breadcrumbs>`, above the title. */
    breadcrumbs?: ReactNode;
    /** Buttons under the description. */
    actions?: ReactNode;
    /** Beside the title on large screens (a key figure, a small visual); under it on phones. */
    aside?: ReactNode;
    /** Below everything — a search field, a row of filters. */
    children?: ReactNode;
    className?: string;
}

const textLang = (node: ReactNode) => (typeof node === "string" ? langOf(node) : undefined);

/**
 * The top of an inner page: the dark editor surface on graph paper, one h1, what the page is for and what you can do
 * here. The page's own content starts on the light ground below it.
 */
export default function PageHeader({
    title,
    eyebrow,
    description,
    breadcrumbs,
    actions,
    aside,
    children,
    className,
}: PageHeaderProps) {
    return (
        <header data-nav-tone="dark" className={cn("editor relative overflow-hidden border-b border-editor-line", className)}>
            <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />


            <div className="container-page relative py-10 sm:py-14">
                {breadcrumbs && <div className="mb-6">{breadcrumbs}</div>}

                <div className={cn("grid gap-8", aside && "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end")}>
                    <div className="max-w-3xl">
                        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
                        <h1 lang={textLang(title)} className="text-h1 text-balance">
                            {title}
                        </h1>
                        {description && (
                            <p lang={textLang(description)} className="mt-4 max-w-2xl text-lead text-editor-muted">
                                {description}
                            </p>
                        )}
                        {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
                    </div>
                    {aside}
                </div>

                {children && <div className="mt-8">{children}</div>}
            </div>
        </header>
    );
}
