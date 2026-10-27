"use client";

import { RotateCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Reloads the address the visitor came for: the middleware keeps it in the
 * bar while it shows this page, so once Half Coders is back they land on it.
 */
export default function RetryButton() {
    const [checking, setChecking] = useState(false);

    return (
        <Button
            size="lg"
            className="w-full sm:w-auto"
            isLoading={checking}
            onClick={() => {
                setChecking(true);
                window.location.reload();
            }}
        >
            {!checking && <RotateCw aria-hidden />}
            {checking ? "দেখছি…" : "আবার চেষ্টা করুন"}
        </Button>
    );
}
