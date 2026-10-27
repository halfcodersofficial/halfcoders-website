"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useField } from "@/components/ui/form";
import { controlBase } from "@/components/ui/input";
import { bnDigits, type UiLanguage, useUiLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Date and time entry, in a popup.
 *
 * Every date/time field in Half Coders is a button showing the chosen value; it
 * opens a SweetAlert-style dialog — a month calendar, a time field, Set or
 * Cancel — instead of the browser's inline "mm/dd/yyyy" box. The dialog is
 * Radix rather than SweetAlert itself so it can open from inside a modal form:
 * Radix stacks the nested dialog on top, keeps focus in it, and lets Escape
 * close only the popup — none of which SweetAlert can do over another modal.
 *
 * Values keep the formats the native inputs used — "YYYY-MM-DD",
 * "HH:mm", "YYYY-MM-DDTHH:mm", all local wall-clock time — so forms and
 * schemas are unchanged, and the helpers below still convert to and from the
 * ISO instants the API stores.
 */

/** A `Date` as the "YYYY-MM-DDTHH:mm" a date-time value uses. */
export const toLocalDateTimeValue = (date: Date): string => {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

/** A local "YYYY-MM-DDTHH:mm" value back to the ISO instant the API stores. */
export const localDateTimeToISO = (value: string): string => new Date(value).toISOString();

/** "YYYY-MM-DD" — today, by default. */
export const toDateValue = (date: Date = new Date()): string =>
    toLocalDateTimeValue(date).slice(0, 10);

type PickerKind = "date" | "time" | "datetime-local";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "YYYY-MM-DD" as a local date — `new Date("YYYY-MM-DD")` would read it as UTC. */
const parseDateKey = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
};

const addDays = (key: string, days: number) => {
    const date = parseDateKey(key);
    date.setDate(date.getDate() + days);
    return toDateKey(date);
};

/** Same day next/previous month, clamped — 31 Jan + 1 month is 28/29 Feb. */
const addMonths = (key: string, months: number) => {
    const date = parseDateKey(key);
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(date.getDate(), lastDay));
    return toDateKey(target);
};

// On a Bangla screen (see lib/i18n) dates read in Bangla — month names and digits.
const DATE_LOCALE: Record<UiLanguage, string> = { en: "en-GB", bn: "bn-BD" };
const TIME_LOCALE: Record<UiLanguage, string> = { en: "en-US", bn: "bn-BD" };

const formatDay = (key: string, lang: UiLanguage = "en") =>
    parseDateKey(key).toLocaleDateString(DATE_LOCALE[lang], {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

const formatClock = (time: string, lang: UiLanguage = "en") => {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(TIME_LOCALE[lang], {
        hour: "numeric",
        minute: "2-digit",
    });
};

/** How a value reads on the field and in the popup's summary line. */
const formatValue = (value: string, kind: PickerKind, lang: UiLanguage = "en") => {
    if (!value) return "";
    if (kind === "time") return formatClock(value, lang);
    if (kind === "date") return formatDay(value, lang);
    return `${formatDay(value.slice(0, 10), lang)} · ${formatClock(value.slice(11, 16), lang)}`;
};

const PLACEHOLDER: Record<UiLanguage, Record<PickerKind, string>> = {
    en: { date: "Pick a date", time: "Pick a time", "datetime-local": "Pick a date and time" },
    bn: { date: "তারিখ বেছে নিন", time: "সময় বেছে নিন", "datetime-local": "তারিখ ও সময় বেছে নিন" },
};

const WEEKDAYS: Record<UiLanguage, string[]> = {
    en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    bn: ["র", "সো", "ম", "বু", "বৃ", "শু", "শ"],
};

/**
 * A month grid. Arrow keys move a day or a week, Page Up/Down a month,
 * Home/End to the week's ends; Enter or Space picks. Days outside `min`/`max`
 * stay focusable (so keyboard movement never dead-ends) but can't be picked.
 */
function Calendar({
    selected,
    onSelect,
    minDate,
    maxDate,
}: {
    selected: string;
    onSelect: (key: string) => void;
    minDate?: string;
    maxDate?: string;
}) {
    const lang = useUiLanguage();
    const todayKey = toDateKey(new Date());
    const [focused, setFocused] = useState(
        () => selected || (minDate && minDate > todayKey ? minDate : todayKey),
    );
    // Only steal focus after a key press — not when the dialog first opens or
    // the month buttons are clicked.
    const [moveFocus, setMoveFocus] = useState(false);
    const dayRefs = useRef(new Map<string, HTMLButtonElement>());

    useEffect(() => {
        if (moveFocus) dayRefs.current.get(focused)?.focus();
    }, [focused, moveFocus]);

    const focusedDate = parseDateKey(focused);
    const year = focusedDate.getFullYear();
    const month = focusedDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = new Date(year, month, 1).getDay();
    const monthLabel = focusedDate.toLocaleDateString(DATE_LOCALE[lang], { month: "long", year: "numeric" });

    const cells: (string | null)[] = [
        ...Array.from({ length: leadingBlanks }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => toDateKey(new Date(year, month, i + 1))),
    ];
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const isOutOfRange = (key: string) => Boolean((minDate && key < minDate) || (maxDate && key > maxDate));

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
        const dayOfWeek = parseDateKey(key).getDay();
        const moves: Record<string, () => string> = {
            ArrowLeft: () => addDays(key, -1),
            ArrowRight: () => addDays(key, 1),
            ArrowUp: () => addDays(key, -7),
            ArrowDown: () => addDays(key, 7),
            PageUp: () => addMonths(key, -1),
            PageDown: () => addMonths(key, 1),
            Home: () => addDays(key, -dayOfWeek),
            End: () => addDays(key, 6 - dayOfWeek),
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        setFocused(move());
        setMoveFocus(true);
    };

    return (
        <div className="mx-auto w-fit">
            <div className="mb-2 flex items-center justify-between gap-2">
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={lang === "bn" ? "আগের মাস" : "Previous month"}
                    onClick={() => {
                        setFocused(addMonths(focused, -1));
                        setMoveFocus(false);
                    }}
                >
                    <ChevronLeft />
                </Button>
                <p className="text-sm font-semibold" aria-live="polite">
                    {monthLabel}
                </p>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={lang === "bn" ? "পরের মাস" : "Next month"}
                    onClick={() => {
                        setFocused(addMonths(focused, 1));
                        setMoveFocus(false);
                    }}
                >
                    <ChevronRight />
                </Button>
            </div>

            <table className="border-separate border-spacing-1" aria-label={monthLabel}>
                <thead>
                    <tr>
                        {WEEKDAYS[lang].map((day) => (
                            <th key={day} scope="col" className="size-9 text-xs font-medium text-muted-foreground">
                                {day}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {weeks.map((week, weekIndex) => (
                        <tr key={weekIndex}>
                            {week.map((key, dayIndex) =>
                                key ? (
                                    <td key={key}>
                                        <button
                                            ref={(element) => {
                                                if (element) dayRefs.current.set(key, element);
                                                else dayRefs.current.delete(key);
                                            }}
                                            type="button"
                                            tabIndex={key === focused ? 0 : -1}
                                            aria-label={formatDay(key, lang)}
                                            aria-pressed={key === selected}
                                            aria-current={key === todayKey ? "date" : undefined}
                                            aria-disabled={isOutOfRange(key) || undefined}
                                            onClick={() => {
                                                if (isOutOfRange(key)) return;
                                                setFocused(key);
                                                onSelect(key);
                                            }}
                                            onKeyDown={(event) => onKeyDown(event, key)}
                                            className={cn(
                                                "grid size-9 place-items-center rounded-lg text-sm tabular-nums transition-colors",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                key === selected
                                                    ? "bg-primary font-semibold text-primary-foreground"
                                                    : "hover:bg-secondary",
                                                key === todayKey && key !== selected && "ring-1 ring-primary/50",
                                                isOutOfRange(key) && "cursor-not-allowed text-muted-foreground/40 hover:bg-transparent",
                                            )}
                                        >
                                            {lang === "bn" ? bnDigits(parseDateKey(key).getDate()) : parseDateKey(key).getDate()}
                                        </button>
                                    </td>
                                ) : (
                                    <td key={`blank-${dayIndex}`} />
                                ),
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface PickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    kind?: PickerKind;
    title: ReactNode;
    description?: string;
    /** In the kind's own format; "" for nothing chosen yet. */
    value: string;
    /** Same format as `value`. Earlier choices are refused. */
    min?: string;
    max?: string;
    onSet: (value: string) => void;
    setLabel?: string;
    /** Offers a button that clears the value — pass it only when there is one. */
    onClear?: () => void;
    clearLabel?: string;
}

/**
 * The popup itself — usable on its own where there's no field to show the
 * value, like a "Schedule" button. Styled to match the console's SweetAlert
 * dialogs: centred card, title, the choice, Cancel · Set.
 */
export function DateTimePickerDialog({
    open,
    onOpenChange,
    kind = "datetime-local",
    ...rest
}: PickerDialogProps) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-60 bg-primary-950/45 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
                <Dialog.Content
                    className={cn(
                        "fixed left-1/2 top-1/2 z-60 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-104 -translate-x-1/2 -translate-y-1/2 overflow-y-auto",
                        "rounded-2xl border border-border bg-card p-6 text-center text-card-foreground focus:outline-none",
                        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                    )}
                    style={{ boxShadow: "var(--shadow-panel)" }}
                    {...(rest.description ? {} : { "aria-describedby": undefined })}
                >
                    {/* Remounted on every open, so the draft always starts from the current value. */}
                    <PickerBody kind={kind} onClose={() => onOpenChange(false)} {...rest} />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function PickerBody({
    kind,
    title,
    description,
    value,
    min,
    max,
    onSet,
    setLabel,
    onClear,
    clearLabel,
    onClose,
}: Omit<PickerDialogProps, "open" | "onOpenChange" | "kind"> & { kind: PickerKind; onClose: () => void }) {
    const lang = useUiLanguage();
    const bn = lang === "bn";
    const [date, setDate] = useState(kind === "time" ? "" : value.slice(0, 10));
    const [time, setTime] = useState(
        kind === "date" ? "" : kind === "time" ? value : value.slice(11, 16) || "10:00",
    );
    const [error, setError] = useState<string | null>(null);

    const next = kind === "datetime-local" ? (date && time ? `${date}T${time}` : "") : kind === "date" ? date : time;

    const commit = () => {
        if (kind !== "time" && !date) return setError(bn ? "ক্যালেন্ডার থেকে একটি দিন বেছে নিন।" : "Pick a day on the calendar.");
        if (kind !== "date" && !time) return setError(bn ? "একটি সময় বেছে নিন।" : "Pick a time.");
        if (min && next < min) {
            return setError(
                bn
                    ? `${formatValue(min, kind, lang)}-এর পরের কিছু বেছে নিন।`
                    : `Pick something after ${formatValue(min, kind)}.`,
            );
        }
        if (max && next > max) {
            return setError(
                bn
                    ? `${formatValue(max, kind, lang)}-এর আগের কিছু বেছে নিন।`
                    : `Pick something before ${formatValue(max, kind)}.`,
            );
        }
        onSet(next);
        onClose();
    };

    return (
        <>
            <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
            {description && (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>
            )}

            <div className="mt-5 space-y-4">
                {kind !== "time" && (
                    <Calendar
                        selected={date}
                        onSelect={(key) => {
                            setDate(key);
                            setError(null);
                        }}
                        minDate={min?.slice(0, 10) || undefined}
                        maxDate={max?.slice(0, 10) || undefined}
                    />
                )}

                {kind !== "date" && (
                    <label className="mx-auto flex w-fit items-center gap-2 text-sm font-medium">
                        <Clock className="size-4 text-muted-foreground" aria-hidden />
                        {bn ? "সময়" : "Time"}
                        <input
                            type="time"
                            value={time}
                            onChange={(event) => {
                                setTime(event.target.value);
                                setError(null);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    commit();
                                }
                            }}
                            className={cn(controlBase, "h-10 w-36 py-2")}
                        />
                    </label>
                )}

                <p className="text-sm text-muted-foreground" aria-live="polite">
                    {next ? (
                        <>
                            <span className="font-medium text-foreground">{formatValue(next, kind, lang)}</span>
                        </>
                    ) : (
                        bn ? "এখনো কিছু বেছে নেওয়া হয়নি" : "Nothing chosen yet"
                    )}
                </p>

                {error && (
                    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </p>
                )}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
                {onClear && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                            onClear();
                            onClose();
                        }}
                    >
                        {clearLabel ?? (bn ? "মুছে ফেলুন" : "Clear")}
                    </Button>
                )}
                <Dialog.Close asChild>
                    <Button type="button" variant="outline">
                        {bn ? "বাতিল" : "Cancel"}
                    </Button>
                </Dialog.Close>
                <Button type="button" onClick={commit}>
                    {setLabel ?? (bn ? "ঠিক আছে" : "Set")}
                </Button>
            </div>
        </>
    );
}

interface PickerInputProps {
    id?: string;
    value?: string;
    /** For use outside a `FormField`; inside one, the field is wired automatically. */
    onValueChange?: (value: string) => void;
    onBlur?: () => void;
    min?: string;
    max?: string;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    /** Heading of the popup — defaults to the `FormField` label, else "Pick a date…". */
    title?: ReactNode;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
}

/**
 * The field: a button that reads like an input and shows the chosen value.
 * Inside a `FormField` it's wired through context like every other control;
 * explicit props still win, same as there.
 */
const PickerInput = ({
    kind,
    id,
    value,
    onValueChange,
    onBlur,
    min,
    max,
    disabled,
    placeholder,
    className,
    title,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: PickerInputProps & { kind: PickerKind }) => {
    const field = useField();
    const lang = useUiLanguage();
    const [open, setOpen] = useState(false);

    const current = value ?? ((field?.value as string | undefined) || "");
    const setValue = (next: string) => (onValueChange ? onValueChange(next) : field?.setValue(next));
    const Icon = kind === "time" ? Clock : CalendarDays;
    // A button can't carry `aria-invalid`; the error text reaches screen
    // readers through `aria-describedby`, and the border shows it visually.
    const isInvalid = ariaInvalid ?? Boolean(field?.error);

    return (
        <>
            <button
                type="button"
                id={id ?? field?.id}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-describedby={ariaDescribedBy ?? field?.describedBy}
                onClick={() => setOpen(true)}
                className={cn(
                    controlBase,
                    "h-11 items-center justify-between gap-2 py-2 text-left sm:h-10",
                    !current && "text-muted-foreground",
                    isInvalid && "border-destructive focus-visible:ring-destructive",
                    className,
                )}
            >
                <span className="truncate">
                    {current ? formatValue(current, kind, lang) : (placeholder ?? PLACEHOLDER[lang][kind])}
                </span>
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>

            <DateTimePickerDialog
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    // Closing counts as leaving the field, so its validation shows.
                    if (!next) (onBlur ?? field?.onBlur)?.();
                }}
                kind={kind}
                title={title ?? field?.label ?? PLACEHOLDER[lang][kind]}
                value={current}
                min={min || undefined}
                max={max || undefined}
                onSet={setValue}
                onClear={current ? () => setValue("") : undefined}
            />
        </>
    );
};

export const DateInput = (props: PickerInputProps) => <PickerInput kind="date" {...props} />;

export const TimeInput = (props: PickerInputProps) => <PickerInput kind="time" {...props} />;

export const DateTimeInput = (props: PickerInputProps) => <PickerInput kind="datetime-local" {...props} />;
