"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { useField } from "@/components/ui/form";
import { controlBase } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { passwordStrength, type PasswordStrengthLevel } from "@/lib/validation";

/**
 * Password field with a reveal toggle and, where a password is being *chosen*,
 * a live strength meter and requirement checklist.
 *
 * The checklist is the part that matters: a strength bar on its own tells
 * someone their password is Weak without telling them why, so they add another
 * character and try again. Listing the four rules the API actually enforces,
 * ticking them off as they are met, turns a guessing game into a form.
 */

const METER: Record<PasswordStrengthLevel, { bar: string; text: string }> = {
    Weak: { bar: "bg-destructive", text: "text-destructive" },
    Medium: { bar: "bg-accent", text: "text-accent-foreground" },
    Strong: { bar: "bg-success", text: "text-success" },
};

/**
 * The meter and checklist on their own, so a field styled differently from
 * `PasswordInput` (the credential screens' boxed fields) can show the same
 * feedback without re-implementing the rules.
 */
export const PasswordStrengthMeter = ({ value }: { value: string }) => {
    if (value.length === 0) return null;

    const strength = passwordStrength(value);
    const meter = METER[strength.level];

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1" aria-hidden>
                    {[0, 1, 2, 3].map((index) => (
                        <span
                            key={index}
                            className={cn(
                                "h-1.5 flex-1 rounded-full transition-colors",
                                index < strength.score ? meter.bar : "bg-border",
                            )}
                        />
                    ))}
                </div>
                <span aria-live="polite" className={cn("shrink-0 text-xs font-semibold", meter.text)}>
                    {strength.level}
                </span>
            </div>

            <ul className="grid gap-1 sm:grid-cols-2">
                {strength.rules.map((rule) => (
                    <li
                        key={rule.id}
                        className={cn(
                            "flex items-center gap-1.5 text-xs",
                            rule.passed ? "text-success" : "text-muted-foreground",
                        )}
                    >
                        {rule.passed ? (
                            <Check className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                            <X className="size-3.5 shrink-0" aria-hidden />
                        )}
                        <span>{rule.label}</span>
                        <span className="sr-only">{rule.passed ? " — met" : " — not met yet"}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
    /** Turn on for a *new* password. Off for sign-in, where the rules are moot. */
    showStrength?: boolean;
}

export const PasswordInput = ({
    className,
    showStrength = false,
    ...props
}: PasswordInputProps) => {
    const field = useField();
    const [visible, setVisible] = useState(false);

    const wiring = field
        ? {
            id: field.id,
            name: field.name,
            value: (field.value ?? "") as string,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => field.setValue(event.target.value),
            onBlur: field.onBlur,
            "aria-invalid": field.error ? true : undefined,
            "aria-describedby": field.describedBy,
            "aria-required": field.required || undefined,
        }
        : {};

    const value = String((props.value ?? field?.value ?? "") as string);
    const masked = !visible && value !== "";

    return (
        <div className="space-y-2">
            <div className="relative">
                <input
                    {...wiring}
                    {...props}
                    type={visible ? "text" : "password"}
                    className={cn(
                        controlBase,
                        "h-11 py-2 pr-11 sm:h-10",
                        masked && "password-masked",
                        className,
                    )}
                />
                {/* Stars instead of the browser's bullets — see
                    `.password-masked` in globals.css. */}
                {masked && (
                    <span
                        aria-hidden
                        className="password-mask-overlay absolute inset-y-0 left-0 right-11 flex items-center px-3 text-base text-foreground sm:text-sm"
                    >
                        {"*".repeat(value.length)}
                    </span>
                )}
                <button
                    type="button"
                    // Not in the tab order: someone tabbing through a sign-in
                    // form wants the submit button next, not a display toggle.
                    // It stays reachable by pointer, and by shift-tab.
                    tabIndex={-1}
                    onClick={() => setVisible((current) => !current)}
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
            </div>

            {showStrength && <PasswordStrengthMeter value={value} />}
        </div>
    );
};
