"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useId, useState } from "react";
import type { PickerOption } from "@/components/admin/pickers";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface EntityPickerProps {
    label: string;
    placeholder: string;
    value: PickerOption | null;
    onChange: (option: PickerOption | null) => void;
    /** Runs against the API as the admin types. An empty term lists the most recent. */
    search: (term: string) => Promise<PickerOption[]>;
    /** Namespaces the query cache — "students", "published-courses". */
    queryKey: string;
    emptyText?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    /** People get an avatar; courses don't. */
    avatar?: boolean;
    autoFocus?: boolean;
}

/**
 * Type a name, click the match. Replaces every "paste the ID from another
 * screen" field the console had — the enrolment ID box on the certificates
 * screen was the worst of them, but a `<select>` of two thousand students
 * would have been no better.
 *
 * Once something is picked the search collapses to a single row with a
 * "Change" button, so the form reads as filled in rather than still open.
 */
export default function EntityPicker({
    label,
    placeholder,
    value,
    onChange,
    search,
    queryKey,
    emptyText = "Nothing matches.",
    hint,
    error,
    required = false,
    avatar = false,
    autoFocus = false,
}: EntityPickerProps) {
    const id = useId();
    const [term, setTerm] = useState("");
    const debounced = useDebouncedValue(term, 250).trim();

    const results = useQuery({
        queryKey: ["admin", "picker", queryKey, debounced],
        queryFn: () => search(debounced),
        enabled: value === null,
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });

    const options = results.data ?? [];
    const errorId = error ? `${id}-error` : undefined;
    const hintId = hint ? `${id}-hint` : undefined;

    return (
        <div className="space-y-1.5">
            <Label htmlFor={value ? undefined : id}>
                {label}
                {required && (
                    <span className="ml-0.5 text-destructive" aria-hidden>
                        *
                    </span>
                )}
            </Label>

            {value ? (
                <div className="flex items-center gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2.5">
                    {avatar && <Avatar src={value.image} name={value.label} size={36} />}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{value.label}</p>
                        {value.hint && <p className="truncate text-xs text-muted-foreground">{value.hint}</p>}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                        Change
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id={id}
                            type="search"
                            value={term}
                            onChange={(event) => setTerm(event.target.value)}
                            placeholder={placeholder}
                            autoComplete="off"
                            autoFocus={autoFocus}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
                            className="pl-9"
                        />
                    </div>

                    <div className="overflow-hidden rounded-md border border-border">
                        {results.isLoading ? (
                            <div className="space-y-2 p-3">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <Skeleton key={index} className="h-9" />
                                ))}
                            </div>
                        ) : options.length === 0 ? (
                            <p className="p-4 text-center text-sm text-muted-foreground">{emptyText}</p>
                        ) : (
                            <ul
                                role="listbox"
                                aria-label={label}
                                className="max-h-64 divide-y divide-border overflow-y-auto"
                            >
                                {options.map((option) => (
                                    <li key={option.id}>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={false}
                                            onClick={() => onChange(option)}
                                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                                        >
                                            {avatar && <Avatar src={option.image} name={option.label} size={32} />}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{option.label}</span>
                                                {option.hint && (
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {option.hint}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {hint && (
                <p id={hintId} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
            {error && <FieldError id={errorId}>{error}</FieldError>}
        </div>
    );
}
