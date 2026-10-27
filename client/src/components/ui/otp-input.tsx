"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { useField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/**
 * Six-box entry for the emailed verification code.
 *
 * One wide text box works, but it gives no sense of how many digits are left
 * and turns a mistyped character into a hunt with the caret. Separate boxes
 * make the length obvious and the correction one keystroke — provided the
 * fiddly parts are handled, which is most of what is below: pasting the whole
 * code into any box, backspace stepping back through empty boxes, and arrow
 * keys moving without wiping a digit.
 *
 * `autoComplete="one-time-code"` stays on every box so iOS still offers the
 * code from the Messages app.
 */

export const OtpInput = ({ length = 6 }: { length?: number }) => {
    const field = useField();
    const boxes = useRef<(HTMLInputElement | null)[]>([]);

    const value = String((field?.value ?? "") as string);
    const digits = Array.from({ length }, (_, index) => value[index] ?? "");

    const commit = (next: string) => field?.setValue(next.slice(0, length));

    const focusBox = (index: number) => {
        const target = boxes.current[Math.max(0, Math.min(length - 1, index))];
        target?.focus();
        target?.select();
    };

    const setDigit = (index: number, digit: string) => {
        const chars = value.padEnd(length, " ").split("");
        chars[index] = digit || " ";
        commit(chars.join("").replace(/ /g, "").slice(0, length));
    };

    const handleChange = (index: number, raw: string) => {
        const typed = raw.replace(/\D/g, "");
        if (typed === "") {
            setDigit(index, "");
            return;
        }

        // Typing over a filled box replaces it; a burst of digits (an autofilled
        // code, say) fills forward from here.
        const chars = value.split("");
        typed.split("").forEach((digit, offset) => {
            if (index + offset < length) chars[index + offset] = digit;
        });

        commit(chars.join(""));
        focusBox(index + typed.length);
    };

    const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Backspace") {
            event.preventDefault();
            if (digits[index]) {
                commit(value.slice(0, index) + value.slice(index + 1));
            } else if (index > 0) {
                commit(value.slice(0, index - 1) + value.slice(index));
                focusBox(index - 1);
            }
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            focusBox(index - 1);
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            focusBox(index + 1);
        }
    };

    const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pasted) return;
        commit(pasted);
        focusBox(pasted.length);
    };

    return (
        <div
            role="group"
            aria-describedby={field?.describedBy}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        >
            {digits.map((digit, index) => (
                <input
                    key={index}
                    // The label points at the first box, so clicking it lands here.
                    id={index === 0 ? field?.id : undefined}
                    ref={(element) => {
                        boxes.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={length}
                    value={digit}
                    aria-label={`Digit ${index + 1} of ${length}`}
                    aria-invalid={field?.error ? true : undefined}
                    onChange={(event) => handleChange(index, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    onPaste={handlePaste}
                    onFocus={(event) => event.target.select()}
                    onBlur={field?.onBlur}
                    className={cn(
                        "h-13 w-full rounded-lg border border-input bg-background text-center text-xl font-semibold tabular-nums transition-colors sm:h-12",
                        "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring",
                        "aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/25",
                    )}
                />
            ))}
        </div>
    );
};
