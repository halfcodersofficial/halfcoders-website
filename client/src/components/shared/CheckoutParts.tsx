import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* The parts a course checkout and a bundle checkout share. */

type StepState = "done" | "current" | "error" | "upcoming";

/**
 * Cart → Payment → Verify → Access as a CI pipeline, so a mid-checkout
 * student can see how far along they are: each stage a mono chip — ✓ done,
 * ● the one running (pulsing), ✗ failed, ○ not yet — joined by a line that's
 * solid behind them. `submitted`: they've sent in their bKash payment, and
 * it's waiting on an admin.
 */
export function CheckoutSteps({ status, submitted = false }: { status: string; submitted?: boolean }) {
    const paid = status === "PAID";
    const open = status === "PENDING";
    const steps: { label: string; state: StepState }[] = [
        { label: "Cart", state: "done" },
        { label: "Payment", state: paid || (open && submitted) ? "done" : open ? "current" : "error" },
        { label: "Verify", state: paid ? "done" : open && submitted ? "current" : "upcoming" },
        { label: "Access", state: paid ? "done" : "upcoming" },
    ];

    return (
        <ol className="flex items-center text-sm" aria-label="Checkout progress">
            {steps.map((step, index) => (
                <li key={step.label} className={cn("flex items-center", index < steps.length - 1 && "flex-1")}>
                    <span
                        className={cn(
                            "inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 sm:px-2.5",
                            step.state === "done" && "border-success/40 bg-success/5 text-success-ink",
                            step.state === "current" && "border-primary bg-primary/5 text-primary",
                            step.state === "error" && "border-destructive/40 bg-destructive/5 text-destructive-ink",
                            step.state === "upcoming" && "border-border text-muted-foreground",
                        )}
                    >
                        {step.state === "done" ? (
                            <Check className="size-3.5" strokeWidth={3} aria-hidden />
                        ) : step.state === "current" ? (
                            <span className="relative flex size-2" aria-hidden>
                                <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
                                <span className="relative size-2 rounded-full bg-current" />
                            </span>
                        ) : (
                            <span aria-hidden>{step.state === "error" ? "✗" : "○"}</span>
                        )}
                        <span className={cn(step.state !== "current" && "hidden sm:inline")}>{step.label}</span>
                        <span className="sr-only"> — {step.state}</span>
                    </span>
                    {index < steps.length - 1 && (
                        <span aria-hidden className={cn("mx-2 h-px flex-1 sm:mx-3", step.state === "done" ? "bg-success/60" : "border-t border-dashed border-border-strong")} />
                    )}
                </li>
            ))}
        </ol>
    );
}

/** The order's state as a mono tag in its header — PAID in green, or why it closed in red. */
export function Stamp({ tone, children }: { tone: "success" | "destructive"; children: ReactNode }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold",
                tone === "success" ? "border-success/40 bg-success/10 text-success-ink" : "border-destructive/40 bg-destructive/10 text-destructive-ink",
            )}
        >
            {children}
        </span>
    );
}
