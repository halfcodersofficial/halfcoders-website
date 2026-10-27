"use client";

import { ChevronDown } from "lucide-react";
import type {
    Ref,
    ChangeEvent,
    InputHTMLAttributes,
    ReactNode,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from "react";
import { useField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/**
 * Form controls.
 *
 * Three things are true of all of them:
 *
 * 1. They are 44px tall on touch screens and 40px from `sm` up — below 44px a
 *    thumb misses, above it a desktop form looks bloated.
 * 2. Their text is 16px on mobile. Anything smaller and iOS Safari zooms the
 *    page on focus, which leaves the student looking at a magnified fragment of
 *    a form they then have to pinch back out of.
 * 3. Native constraint attributes (`required`, `pattern`, `minLength`) are
 *    deliberately *not* set. The browser's own validation bubble would fire on
 *    submit and compete with the message we render under the field — one of
 *    them would be in English regardless of locale, neither would explain the
 *    actual rule, and only one can win. Validation is the schema's job.
 */

export const controlBase = cn(
    "flex w-full rounded-lg border border-input bg-background px-3 text-base transition-colors sm:text-sm",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
    "aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/25",
    "aria-invalid:focus-visible:ring-2 aria-invalid:focus-visible:ring-destructive",
);

const controlHeight = "h-11 sm:h-10";

/**
 * Wiring handed down by `FormField`. Returns nothing outside one, so the same
 * components still work as plain controlled inputs — the search boxes and
 * filter selects use them that way.
 */
const useControlProps = () => {
    const field = useField();
    if (!field) return {};

    return {
        id: field.id,
        name: field.name,
        value: (field.value ?? "") as string,
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
            field.setValue(event.target.value),
        onBlur: field.onBlur,
        "aria-invalid": field.error ? true : undefined,
        "aria-describedby": field.describedBy,
        "aria-required": field.required || undefined,
    };
};

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    /** The field itself (a plain prop since React 19), for code that focuses it. */
    ref?: Ref<HTMLInputElement>;
    /**
     * A fixed fragment of the value shown inside the field, before the box —
     * a dialling code, a currency, a URL scheme. It is chrome, not content: it
     * is never submitted, so the schema still sees exactly what was typed.
     */
    addonStart?: ReactNode;
    /** The same after the box — a unit, like "%". */
    addonEnd?: ReactNode;
}

export const Input = ({ className, addonStart, addonEnd, ...props }: InputProps) => {
    const wiring = useControlProps();
    const field = useField();

    if (addonStart === undefined && addonEnd === undefined) {
        return (
            <input {...wiring} {...props} className={cn(controlBase, controlHeight, "py-2", className)} />
        );
    }

    // With an addon the border and focus ring move to the wrapper, so the two
    // halves light up as one control — an addon sitting outside the ring reads
    // as a label that happens to be touching the box.
    return (
        <div
            className={cn(
                controlBase,
                controlHeight,
                "items-center gap-2 py-0 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring",
                field?.error && "border-destructive focus-within:ring-destructive",
                className,
            )}
        >
            {addonStart !== undefined && (
                <span className="flex shrink-0 items-center gap-1.5 border-r border-border pr-2 text-sm text-muted-foreground">
                    {addonStart}
                </span>
            )}
            <input
                {...wiring}
                {...props}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
            {addonEnd !== undefined && (
                <span className="flex shrink-0 items-center gap-1.5 border-l border-border pl-2 text-sm text-muted-foreground">
                    {addonEnd}
                </span>
            )}
        </div>
    );
};

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => {
    const wiring = useControlProps();
    return (
        <textarea
            {...wiring}
            {...props}
            className={cn(controlBase, "min-h-24 py-2.5 leading-relaxed", className)}
        />
    );
};

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    /** Shown as a disabled first option, so "nothing chosen" is a visible state. */
    placeholder?: string;
}

/**
 * A native `<select>`, restyled. Native is the right call here rather than a
 * listbox built out of divs: it gets the platform's own picker on Android and
 * iOS, type-ahead and arrow keys for free on desktop, and it is announced
 * correctly by every screen reader without a line of ARIA.
 */
export const Select = ({ className, children, placeholder, ...props }: SelectProps) => {
    const wiring = useControlProps();

    return (
        <div className="relative">
            <select
                {...wiring}
                {...props}
                className={cn(
                    controlBase,
                    controlHeight,
                    "cursor-pointer appearance-none py-2 pr-9",
                    className,
                )}
            >
                {placeholder !== undefined && <option value="">{placeholder}</option>}
                {children}
            </select>
            <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
            />
        </div>
    );
};

interface RadioGroupProps {
    options: { value: string; label: string; description?: ReactNode }[];
    /** Lay the options out in a row from `sm` up. */
    inline?: boolean;
    className?: string;
}

/**
 * A set of native radios. Native again, and for the same reason as `Select`:
 * arrow-key navigation within the group, correct "2 of 3" announcements, and
 * the platform's own focus ring all come for free.
 */
export const RadioGroup = ({ options, inline = false, className }: RadioGroupProps) => {
    const field = useField();

    return (
        <div
            role="radiogroup"
            aria-describedby={field?.describedBy}
            aria-invalid={field?.error ? true : undefined}
            className={cn("grid gap-2", inline && "sm:grid-flow-col sm:auto-cols-fr", className)}
        >
            {options.map((option, index) => {
                const checked = field?.value === option.value;

                return (
                    <label
                        key={option.value}
                        className={cn(
                            "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                            checked
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40 hover:bg-secondary/50",
                        )}
                    >
                        <input
                            type="radio"
                            // The field's label points at the first option, so
                            // clicking it moves focus into the group.
                            id={index === 0 ? field?.id : undefined}
                            name={field?.id}
                            value={option.value}
                            checked={checked}
                            onChange={() => field?.setValue(option.value)}
                            onBlur={field?.onBlur}
                            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        />
                        <span className="min-w-0">
                            <span className="font-medium leading-snug">{option.label}</span>
                            {option.description && (
                                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                    {option.description}
                                </span>
                            )}
                        </span>
                    </label>
                );
            })}
        </div>
    );
};

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
    /** The clickable label. The whole row is the hit target, not just the box. */
    children: ReactNode;
    /** Secondary line under the label, for the consequence of ticking it. */
    description?: ReactNode;
}

export const Checkbox = ({ className, children, description, ...props }: CheckboxProps) => {
    const field = useField();

    const wiring = field
        ? {
            id: field.id,
            name: field.name,
            checked: Boolean(field.value),
            onChange: (event: ChangeEvent<HTMLInputElement>) => field.setValue(event.target.checked),
            onBlur: field.onBlur,
            "aria-describedby": field.describedBy,
        }
        : {};

    return (
        <label
            className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg py-1.5 text-sm",
                "has-disabled:cursor-not-allowed has-disabled:opacity-50",
                className,
            )}
        >
            <input
                type="checkbox"
                {...wiring}
                {...props}
                className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <span className="min-w-0">
                <span className="font-medium leading-snug">{children}</span>
                {description && (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
};
