"use client";

import { Check, Search, X } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { controlBase } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useDigits, useT, useUiLanguage } from "@/lib/i18n";
import {
    TECH_STACK_GROUPS,
    TECH_STACK_ICON_KEYS,
    TECH_STACK_ICONS,
    type TechStackGroupId,
} from "@/lib/techStackIcons";
import { cn } from "@/lib/utils";

/**
 * One icon for an existing chip (`onPick`, closes on the pick), or several
 * new chips at once (`onPickMany`, added together from the footer).
 */
type PickerMode =
    | {
        onPick: (key: string) => void;
        /** The row's current icon, marked in the grid. */
        value?: string;
        onPickMany?: never;
    }
    | {
        onPickMany: (keys: string[]) => void;
        /** How many more chips the list takes, */
        limit: number;
        /** out of how many in all. */
        max: number;
        /** Icons already in the list — shown as added, not offered twice. */
        taken?: string[];
        onPick?: never;
    };

type TechStackIconPickerProps = PickerMode & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const normalise = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Every tech-stack icon — several hundred tools and subjects across all kinds
 * of course — searchable and grouped by field. Far too many for a dropdown:
 * type a few letters ("exc", "photo", "cook") or narrow to a field, then
 * click. Adding chips takes several at once; Enter picks the first match.
 */
export function TechStackIconPicker({ open, onOpenChange, ...mode }: TechStackIconPickerProps) {
    const t = useT();
    const digits = useDigits();
    const count = digits(TECH_STACK_ICON_KEYS.length);
    const multiple = Boolean(mode.onPickMany);

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={multiple ? t("Add tech stack", "টেক স্ট্যাক যোগ করুন") : t("Choose an icon", "আইকন বেছে নিন")}
            description={
                multiple
                    ? t(
                        `Pick as many as you need from ${TECH_STACK_ICON_KEYS.length} tools and subjects — each one's name fills in, and you can still change it.`,
                        `${count}টি টুল ও বিষয় থেকে যতগুলো দরকার বেছে নিন — নামগুলো নিজে থেকেই বসে যাবে, পরে বদলানো যায়।`,
                    )
                    : t(
                        `${TECH_STACK_ICON_KEYS.length} tools and subjects. Picking one fills in the name, which you can still change.`,
                        `${count}টি টুল ও বিষয়। বেছে নিলে নামও বসে যায় — চাইলে পরে বদলাতে পারবেন।`,
                    )
            }
        >
            {/* Mounted only while open, so each opening starts with a clear search and selection. */}
            <PickerBody mode={mode as PickerMode} onClose={() => onOpenChange(false)} />
        </Modal>
    );
}

function PickerBody({ mode, onClose }: { mode: PickerMode; onClose: () => void }) {
    const t = useT();
    const lang = useUiLanguage();
    const digits = useDigits();
    const [query, setQuery] = useState("");
    const [group, setGroup] = useState<TechStackGroupId | "all">("all");
    // Multiple mode: the picks so far, in the order they were made — the order they're added in.
    const [selected, setSelected] = useState<string[]>([]);

    const multiple = mode.onPickMany !== undefined;
    const takenKeys = mode.onPickMany ? mode.taken : undefined;
    const taken = useMemo(() => new Set(takenKeys ?? []), [takenKeys]);
    const limit = mode.onPickMany ? mode.limit : 1;
    const full = selected.length >= limit;

    const sections = useMemo(() => {
        const needle = normalise(query);
        return TECH_STACK_GROUPS.filter((entry) => group === "all" || entry.id === group)
            .map((entry) => ({
                ...entry,
                keys: TECH_STACK_ICON_KEYS.filter((key) => {
                    const icon = TECH_STACK_ICONS[key];
                    if (icon.group !== entry.id) return false;
                    if (!needle) return true;
                    return [icon.label, key, entry.label, entry.labelBn].some((text) => normalise(text).includes(needle));
                }),
            }))
            .filter((entry) => entry.keys.length > 0);
    }, [query, group]);

    const toggle = (key: string) =>
        setSelected((current) =>
            current.includes(key)
                ? current.filter((picked) => picked !== key)
                : current.length < limit
                    ? [...current, key]
                    : current,
        );

    const choose = (key: string) => {
        if (mode.onPickMany) toggle(key);
        else mode.onPick(key);
    };

    // Enter takes the first match. Adding several, it joins the picks and the
    // search clears for the next one: "excel ⏎ word ⏎ powerpoint ⏎", then Add.
    const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const first = sections
            .flatMap((section) => section.keys)
            .find((key) => !taken.has(key) && (!multiple || !selected.includes(key)));
        if (!first) return;
        if (multiple && full) return;
        choose(first);
        if (multiple) setQuery("");
    };

    const chip = (id: TechStackGroupId | "all", label: string) => (
        <button
            key={id}
            type="button"
            onClick={() => setGroup(id)}
            aria-pressed={group === id}
            className={cn(
                "shrink-0 rounded-sm border px-3 py-1 text-xs font-medium transition-colors",
                group === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
        >
            {label}
        </button>
    );

    return (
        <>
            <div className="space-y-3 border-b border-border px-6 pb-4">
                <label className="relative block">
                    <span className="sr-only">{t("Search icons", "আইকন খুঁজুন")}</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input
                        autoFocus
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={onSearchKey}
                        placeholder={t("Search — e.g. Excel, Photoshop, Cooking", "খুঁজুন — যেমন Excel, Photoshop, Cooking")}
                        className={cn(controlBase, "h-10 pl-9")}
                    />
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t("Field", "বিষয়")}>
                    {chip("all", t("All", "সব"))}
                    {TECH_STACK_GROUPS.map((entry) => chip(entry.id, lang === "bn" ? entry.labelBn : entry.label))}
                </div>
            </div>

            <ModalBody className="space-y-5">
                {sections.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        {t(
                            "Nothing matches. Pick the closest icon and type the name yourself.",
                            "কিছু মেলেনি। কাছাকাছি একটি আইকন বেছে নিয়ে নামটি নিজে লিখুন।",
                        )}
                    </p>
                ) : (
                    sections.map((section) => (
                        <section key={section.id} aria-label={lang === "bn" ? section.labelBn : section.label}>
                            <h3 className="mb-2 text-xs font-semibold font-mono uppercase tracking-wide text-muted-foreground">
                                {lang === "bn" ? section.labelBn : section.label}{" "}
                                <span className="font-normal">({digits(section.keys.length)})</span>
                            </h3>
                            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {section.keys.map((key) => {
                                    const { icon: Icon, label } = TECH_STACK_ICONS[key];
                                    const added = taken.has(key);
                                    const order = selected.indexOf(key);
                                    const isSelected = multiple ? order !== -1 : key === mode.value;
                                    // Adding: an icon already in the list, or one more than the list takes.
                                    const unavailable = multiple && (added || (full && !isSelected));
                                    return (
                                        <li key={key}>
                                            <button
                                                type="button"
                                                onClick={() => choose(key)}
                                                disabled={unavailable}
                                                aria-pressed={isSelected}
                                                title={added ? t("Already in the list", "তালিকায় আগেই আছে") : undefined}
                                                className={cn(
                                                    "relative flex h-full w-full flex-col items-center gap-1.5 rounded-md border p-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    isSelected
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border hover:border-primary/40 hover:bg-secondary/60",
                                                    unavailable && "cursor-not-allowed opacity-45 hover:border-border hover:bg-transparent",
                                                )}
                                            >
                                                {multiple && isSelected && (
                                                    <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                                        {digits(order + 1)}
                                                    </span>
                                                )}
                                                {added && (
                                                    <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                                                        <Check className="size-3" aria-hidden /> {t("Added", "যুক্ত")}
                                                    </span>
                                                )}
                                                <Icon className="size-6 shrink-0" aria-hidden />
                                                <span className="line-clamp-2 text-[11px] leading-tight">{label}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))
                )}
            </ModalBody>

            {mode.onPickMany && (
                <ModalFooter className="flex-col items-stretch gap-3">
                    {selected.length > 0 && (
                        <ul className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto" aria-label={t("Picked", "বেছে নেওয়া")}>
                            {selected.map((key) => {
                                const { icon: Icon, label } = TECH_STACK_ICONS[key];
                                return (
                                    <li key={key}>
                                        <button
                                            type="button"
                                            onClick={() => toggle(key)}
                                            aria-label={t(`Remove ${label}`, `${label} বাদ দিন`)}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-2 pr-1.5 text-xs text-primary hover:bg-primary/15"
                                        >
                                            <Icon className="size-3.5" aria-hidden />
                                            {label}
                                            <X className="size-3" aria-hidden />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground" aria-live="polite">
                            {full
                                ? t(
                                    `That fills the list — ${mode.max} chips at most.`,
                                    `তালিকা পূর্ণ — সর্বোচ্চ ${digits(mode.max)}টি টেক স্ট্যাক।`,
                                )
                                : t(
                                    `${selected.length} picked · room for ${mode.limit - selected.length} more`,
                                    `${digits(selected.length)}টি বেছে নেওয়া · আরও ${digits(mode.limit - selected.length)}টি নেওয়া যাবে`,
                                )}
                        </p>
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                {t("Cancel", "বাতিল")}
                            </Button>
                            <Button
                                type="button"
                                disabled={selected.length === 0}
                                onClick={() => mode.onPickMany(selected)}
                            >
                                {selected.length > 0
                                    ? t(`Add ${selected.length}`, `${digits(selected.length)}টি যোগ করুন`)
                                    : t("Add", "যোগ করুন")}
                            </Button>
                        </div>
                    </div>
                </ModalFooter>
            )}
        </>
    );
}
