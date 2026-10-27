"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** "Copy link" for the page it's on — the verification page's address, to send to an employer — saying so for a moment once done. */
export default function CopyLinkButton() {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1800);
        return () => window.clearTimeout(timer);
    }, [copied]);

    return (
        <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => void navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true))}
        >
            {copied ? <Check className="text-success" /> : <Link2 />}
            {copied ? "Link copied" : "Copy link"}
        </Button>
    );
}
