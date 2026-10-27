"use client";

import { Send } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HOLD_MS = 1100;

interface HoldToSendProps {
    children: ReactNode;
    /** The form is valid and there's someone to send to. */
    ready: boolean;
    disabled?: boolean;
    isLoading?: boolean;
    /** Pressed while not ready — show the form's errors instead of starting a hold. */
    onBlocked: () => void;
    /** Held all the way. */
    onSend: () => void;
    /**
     * A click with no press before it — a screen reader activating the button
     * can't hold it, so it gets an explicit confirmation instead.
     */
    onConfirm: () => void;
}

/**
 * The broadcast's send button: press and hold until the bar fills. A send
 * writes one row per recipient and can't be recalled, so it asks for a
 * deliberate second of intent rather than a click — and, unlike a "Are you
 * sure?" dialog, that intent can't become a reflex. Space or Enter held down
 * works the same as a pointer; letting go early cancels.
 */
export default function HoldToSend({
    children,
    ready,
    disabled = false,
    isLoading = false,
    onBlocked,
    onSend,
    onConfirm,
}: HoldToSendProps) {
    const hintId = useId();
    const [holding, setHolding] = useState(false);
    const [releasedEarly, setReleasedEarly] = useState(false);
    const timer = useRef<number | undefined>(undefined);
    // When the last real press (pointer or key) was let go. The click a press
    // produces follows its release within milliseconds, so a click with no
    // release just before it came from assistive tech.
    const releasedAt = useRef(-Infinity);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    /** Returns false when the press was turned into "show me what's missing". */
    const start = () => {
        if (disabled || isLoading) return true;
        if (!ready) {
            onBlocked();
            return false;
        }
        setReleasedEarly(false);
        setHolding(true);
        // Never two holds at once — a second finger mustn't queue a second send.
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            setHolding(false);
            onSend();
        }, HOLD_MS);
        return true;
    };

    const release = () => {
        if (!holding) return;
        window.clearTimeout(timer.current);
        setHolding(false);
        setReleasedEarly(true);
    };

    const letGo = () => {
        releasedAt.current = performance.now();
        release();
    };

    const isHoldKey = (key: string) => key === " " || key === "Enter";

    return (
        <div className="space-y-2">
            <Button
                type="button"
                size="lg"
                isLoading={isLoading}
                disabled={disabled}
                aria-describedby={hintId}
                className="w-full select-none [-webkit-touch-callout:none] sm:w-auto sm:min-w-72"
                onPointerDown={(event) => {
                    // A blocked press has just moved focus to the first problem;
                    // the mousedown that follows would pull it back to the button.
                    if (event.button === 0 && !start()) event.preventDefault();
                }}
                onPointerUp={letGo}
                onPointerLeave={release}
                // A scroll that starts on the button cancels the pointer — and the hold.
                onPointerCancel={release}
                onKeyDown={(event) => {
                    if (!isHoldKey(event.key)) return;
                    event.preventDefault();
                    if (!event.repeat) start();
                }}
                onKeyUp={(event) => {
                    if (isHoldKey(event.key)) letGo();
                }}
                onBlur={release}
                onContextMenu={(event) => event.preventDefault()}
                onClick={() => {
                    const fromPress = performance.now() - releasedAt.current < 500;
                    releasedAt.current = -Infinity;
                    if (fromPress || disabled || isLoading) return;
                    if (ready) onConfirm();
                    else onBlocked();
                }}
            >
                {/* The fill: linear while held so it reads as a timer, quick on the way back. */}
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 origin-left bg-white/25"
                    style={{
                        transform: `scaleX(${holding ? 1 : 0})`,
                        transition: holding ? `transform ${HOLD_MS}ms linear` : "transform 220ms ease-out",
                    }}
                />
                {!isLoading && <Send className="relative" aria-hidden />}
                <span className="relative">{children}</span>
            </Button>

            <p
                id={hintId}
                className={cn(
                    "text-xs transition-colors",
                    releasedEarly && !holding ? "font-medium text-primary" : "text-muted-foreground",
                )}
                aria-live="polite"
            >
                {releasedEarly && !holding
                    ? "Keep holding until the bar fills — letting go cancels."
                    : "Press and hold to send. Letting go early cancels."}
            </p>
        </div>
    );
}
