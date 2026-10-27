"use client";

import { AlertCircle } from "lucide-react";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { FormValues, ZodFormApi } from "@/hooks/useZodForm";
import { Label } from "@/components/ui/label";
import { bnMessage, useDigits, useUiLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Field chrome: label, required marker, hint, character counter and the error
 * message that sits *directly under the input it belongs to*.
 *
 * `FormField` hands the control everything it needs — id, value, change and
 * blur handlers, `aria-invalid`, `aria-describedby` — through context, so a
 * field reads as one line of intent:
 *
 *     <FormField form={form} name="email" label="Email" required>
 *         <Input type="email" autoComplete="email" placeholder="you@example.com" />
 *     </FormField>
 *
 * Any prop passed explicitly to the control still wins over the wiring, which
 * is how the handful of fields that need custom behaviour (masking a code,
 * upper-casing a prefix) opt out without leaving the pattern.
 */

interface FieldContextValue {
    id: string;
    name: string;
    /** The field's label — a control that opens a popup titles it with this. */
    label: ReactNode;
    value: unknown;
    error?: string;
    describedBy?: string;
    required: boolean;
    setValue: (next: unknown) => void;
    onBlur: () => void;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Read by `Input`, `Textarea`, `Select`, `Checkbox` and the date controls. */
export const useField = () => useContext(FieldContext);

interface FormFieldProps<TValues extends FormValues> {
    form: ZodFormApi<TValues>;
    name: keyof TValues & string;
    label: ReactNode;
    /** Adds the required marker and `aria-required`. */
    required?: boolean;
    /** Adds a quiet "(optional)" after the label. */
    optional?: boolean;
    /** Guidance shown under the control — format, consequence, where it appears. */
    hint?: ReactNode;
    /** Turns on a live "123 / 2000" counter. Should match the schema's ceiling. */
    counterMax?: number;
    /** Rendered at the right of the label row — a "Forgot password?" link, say. */
    labelAction?: ReactNode;
    className?: string;
    children: ReactNode;
}

export function FormField<TValues extends FormValues>({
    form,
    name,
    label,
    required = false,
    optional = false,
    hint,
    counterMax,
    labelAction,
    className,
    children,
}: FormFieldProps<TValues>) {
    const lang = useUiLanguage();
    const digits = useDigits();
    const id = form.idFor(name);
    // Rules are written once, in English; a Bangla screen reads them translated.
    const rawError = form.errorFor(name);
    const error = rawError && lang === "bn" ? bnMessage(rawError) : rawError;
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;

    const context = useMemo<FieldContextValue>(
        () => ({
            id,
            name,
            label,
            value: form.values[name],
            error,
            describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined,
            required,
            setValue: (next) => form.setValue(name, next as TValues[typeof name]),
            onBlur: () => form.touch(name),
        }),
        // `form.values[name]` is the only part that changes per keystroke; the
        // rest of the api is stable.
        [id, name, label, error, hintId, errorId, required, form],
    );

    const length = typeof form.values[name] === "string" ? (form.values[name] as string).length : 0;

    return (
        <div className={cn("space-y-1.5", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor={id}>
                    {label}
                    {required && (
                        <span className="ml-0.5 text-destructive" aria-hidden>
                            *
                        </span>
                    )}
                    {optional && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                            {lang === "bn" ? "(ঐচ্ছিক)" : "(optional)"}
                        </span>
                    )}
                </Label>
                {labelAction}
            </div>

            <FieldContext.Provider value={context}>{children}</FieldContext.Provider>

            {(hint || counterMax !== undefined) && (
                <div className="flex items-start justify-between gap-3">
                    {hint ? (
                        <p id={hintId} className="text-xs text-muted-foreground">
                            {hint}
                        </p>
                    ) : (
                        <span />
                    )}

                    {counterMax !== undefined && (
                        <span
                            className={cn(
                                "shrink-0 text-xs tabular-nums",
                                length > counterMax ? "font-medium text-destructive" : "text-muted-foreground",
                            )}
                        >
                            {digits(length.toLocaleString())} / {digits(counterMax.toLocaleString())}
                        </span>
                    )}
                </div>
            )}

            {error && <FieldError id={errorId}>{error}</FieldError>}
        </div>
    );
}

/**
 * `role="alert"` rather than a live region: the message replaces itself as the
 * value changes, and a polite live region would queue every intermediate state
 * of a half-typed email.
 */
export const FieldError = ({ id, children }: { id?: string; children: ReactNode }) => (
    <p
        id={id}
        role="alert"
        className="flex items-start gap-1.5 text-xs font-medium text-destructive"
    >
        <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>{children}</span>
    </p>
);

/** A cross-field problem — no single input to sit under, so it goes above the actions. */
export const FormError = ({ children }: { children: ReactNode }) =>
    children ? (
        <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{children}</span>
        </p>
    ) : null;

/** The legend every form with a required field needs, once, at the top. */
export function RequiredLegend({ className }: { className?: string }) {
    const lang = useUiLanguage();
    return (
        <p className={cn("text-xs text-muted-foreground", className)}>
            {lang === "bn" ? (
                <>
                    <span className="text-destructive">*</span> চিহ্নিত ঘরগুলো পূরণ করা আবশ্যক।
                </>
            ) : (
                <>
                    Fields marked <span className="text-destructive">*</span> are required.
                </>
            )}
        </p>
    );
}
