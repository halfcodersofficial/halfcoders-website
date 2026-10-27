import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Long-form reading — the terms, the privacy and refund policies. Styles the
 * plain elements inside it (`.prose-site` in globals.css) at a comfortable
 * measure. Pass `lang="bn"` for Bangla copy: it gets the taller line.
 */
export default function Prose({ lang, className, children }: { lang?: string; className?: string; children: ReactNode }) {
    return (
        <div lang={lang} className={cn("prose-site max-w-[70ch]", className)}>
            {children}
        </div>
    );
}
