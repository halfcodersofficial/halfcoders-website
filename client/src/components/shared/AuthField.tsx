"use client";

import { AlertCircle, CheckCircle2, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FieldError } from "@/components/ui/form";
import { PasswordStrengthMeter } from "@/components/ui/password-input";
import type { FormValues, ZodFormApi } from "@/hooks/useZodForm";
import { cn } from "@/lib/utils";

interface AuthFieldProps<TValues extends FormValues> {
    form: ZodFormApi<TValues>;
    name: keyof TValues & string;
    label: string;
    icon: LucideIcon;
    type?: "text" | "email" | "tel" | "password";
    autoComplete?: string;
    placeholder?: string;
    inputMode?: "text" | "email" | "tel" | "numeric";
    /** Fixed text inside the box before the value — a dialling code. Chrome, never submitted. */
    prefix?: ReactNode;
    /** Rendered at the right of the label — "Forgot password?". */
    labelAction?: ReactNode;
    hint?: ReactNode;
    /** For a password being *chosen*: the live meter and rule checklist. */
    showStrength?: boolean;
    autoFocus?: boolean;
}

/**
 * The boxed field on the credential screens: an icon tile, a small label
 * sitting over the value, and a status mark at the right — a green tick once
 * the value passes its rule, a red mark once it has failed one.
 *
 * It bypasses `FormField` because the label lives *inside* the box, but it
 * keeps every contract the rest of the form stack relies on: the input carries
 * `form.idFor(name)` so a failed submit still focuses the first problem, the
 * error is announced under the box, and the value validates from first contact
 * exactly as elsewhere.
 */
export function AuthField<TValues extends FormValues>({
    form,
    name,
    label,
    icon: Icon,
    type = "text",
    autoComplete,
    placeholder,
    inputMode,
    prefix,
    labelAction,
    hint,
    showStrength = false,
    autoFocus,
}: AuthFieldProps<TValues>) {
    const [visible, setVisible] = useState(false);

    const id = form.idFor(name);
    const value = String((form.values[name] ?? "") as string);
    const error = form.errorFor(name);
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;

    // Valid means "passes its rule right now", whether or not the field has
    // been touched — a tick on a pristine field is impossible anyway, since a
    // required field is empty.
    const isValid = value.trim() !== "" && !(name in form.errors);
    const isPassword = type === "password";
    const masked = isPassword && !visible;

    return (
        <div className="space-y-1.5">
            <div
                className={cn(
                    "group flex h-16 items-center gap-3 rounded-md border border-border-strong bg-card px-3 transition-[border-color,box-shadow]",
                    "focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--violet-500)_20%,transparent)]",
                    error &&
                        "border-destructive focus-within:border-destructive focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_15%,transparent)]",
                )}
            >
                {/* The icon tile, like the coloured glyph beside a file in an
                    editor: violet while you type, green once the value passes,
                    red once it has failed. */}
                <span
                    className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-sm border border-border bg-surface text-muted-foreground transition-colors",
                        !isValid && !error && "group-focus-within:border-primary/30 group-focus-within:bg-primary/5 group-focus-within:text-primary",
                        isValid && "border-success/30 bg-success/5 text-success",
                        error && "border-destructive/30 bg-destructive/5 text-destructive",
                    )}
                    aria-hidden
                >
                    <Icon className="size-4.5" />
                </span>

                <div className="min-w-0 flex-1">
                    {/* The label inside the box, set like a key — `Email address:` — over the value. */}
                    <div className="flex items-center justify-between gap-2">
                        <label htmlFor={id} className="block font-mono text-[11px] leading-tight text-muted-foreground">
                            <span className={cn(isValid && "text-success-ink", error && "text-destructive-ink")}>{label}</span>
                            <span aria-hidden className="text-border-strong">:</span>
                        </label>
                        {labelAction}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {prefix && <span className="shrink-0 font-mono text-sm text-muted-foreground">{prefix}</span>}
                        <div className="relative min-w-0 flex-1">
                            <input
                                id={id}
                                name={name}
                                type={isPassword ? (visible ? "text" : "password") : type}
                                value={value}
                                autoComplete={autoComplete}
                                placeholder={placeholder}
                                inputMode={inputMode}
                                autoFocus={autoFocus}
                                spellCheck={false}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
                                onChange={(event) =>
                                    form.setValue(name, event.target.value as TValues[typeof name])
                                }
                                onBlur={() => form.touch(name)}
                                className={cn(
                                    "h-6 w-full bg-transparent text-[15px] font-medium leading-6 text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60",
                                    masked && value !== "" && "password-masked",
                                )}
                            />
                            {/* Stars instead of the browser's bullets — see
                                `.password-masked` in globals.css. */}
                            {masked && value !== "" && (
                                <span
                                    aria-hidden
                                    className="password-mask-overlay absolute inset-0 flex items-center text-[15px] font-medium leading-6 text-foreground"
                                >
                                    {"*".repeat(value.length)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {isPassword ? (
                    <button
                        type="button"
                        // Out of the tab order: after the password, the next
                        // stop should be the submit button, not a display toggle.
                        tabIndex={-1}
                        onClick={() => setVisible((current) => !current)}
                        aria-label={visible ? "Hide password" : "Show password"}
                        aria-pressed={visible}
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                    </button>
                ) : isValid ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
                ) : error ? (
                    <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
                ) : null}
            </div>

            {hint && !error && (
                <p id={hintId} className="px-1 text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
            {error && (
                <div className="px-1">
                    <FieldError id={errorId}>{error}</FieldError>
                </div>
            )}
            {showStrength && (
                <div className="px-1 pt-1">
                    <PasswordStrengthMeter value={value} />
                </div>
            )}
        </div>
    );
}
