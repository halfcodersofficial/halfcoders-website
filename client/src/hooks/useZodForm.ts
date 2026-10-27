"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { ZodType } from "zod";
import { collectIssues, FORM_ERROR_KEY } from "@/lib/validation";

/**
 * The form engine behind every Half Coders form.
 *
 * It is deliberately small — one Zod schema in, live per-field errors out —
 * because the alternative (react-hook-form + a resolver) is two dependencies
 * for behaviour we can express in a hook, and the schemas already exist.
 *
 * When errors appear
 * ------------------
 * A pristine form shows nothing: shouting "Email is required" at someone who
 * has not reached the field yet is noise. From the first keystroke in a field,
 * that field validates on every change, so a bad email is flagged while it is
 * still being typed rather than after the round trip. Blurring a field also
 * arms it, which is what catches a field tabbed straight past. Submitting arms
 * everything at once and moves focus to the first problem.
 */

export type FormValues = Record<string, unknown>;

/**
 * What a form hands its fields. Deliberately not parameterised by the schema's
 * *output* type — nothing on this surface exposes the parsed value, so carrying
 * it would only be a phantom generic every `FormField` had to thread through.
 */
export interface ZodFormApi<TValues extends FormValues> {
    values: TValues;
    /** Every current error, whether or not it is being shown yet. */
    errors: Record<string, string>;
    /** True once the schema accepts the whole form. */
    isValid: boolean;
    /** True once any value differs from the one the form started with. */
    isDirty: boolean;
    isSubmitted: boolean;

    setValue: <K extends keyof TValues & string>(name: K, value: TValues[K]) => void;
    setValues: (patch: Partial<TValues>) => void;
    /** Replaces the whole form, and clears which fields count as touched. */
    reset: (next?: TValues) => void;
    touch: (name: string) => void;

    /** The error to render under a field, or `undefined` while it stays hidden. */
    errorFor: (name: string) => string | undefined;
    /** A cross-field error with no single field to blame. */
    formError: string | undefined;
    /** Stable DOM id for a field, so labels and focus management line up. */
    idFor: (name: string) => string;

    handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    /** Runs validation and submits without a form event — for a button outside a `<form>`. */
    submit: () => void;
}

interface UseZodFormOptions<TValues extends FormValues, TOutput> {
    schema: ZodType<TOutput, TValues>;
    initialValues: TValues;
    onSubmit: (values: TOutput) => void;
}

export function useZodForm<TValues extends FormValues, TOutput>({
    schema,
    initialValues,
    onSubmit,
}: UseZodFormOptions<TValues, TOutput>): ZodFormApi<TValues> {
    const formId = useId();

    const [values, setValuesState] = useState<TValues>(initialValues);
    const [armed, setArmed] = useState<Record<string, boolean>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);

    // The baseline for `isDirty`, and what `reset()` falls back to. Held in a
    // ref so a parent re-rendering with a fresh object literal for
    // `initialValues` doesn't make every field look dirty.
    const baseline = useRef(initialValues);

    // Callers pass an inline arrow for `onSubmit`; reading it through a ref
    // keeps `handleSubmit` stable instead of changing every render.
    const onSubmitRef = useRef(onSubmit);
    onSubmitRef.current = onSubmit;

    const result = useMemo(() => schema.safeParse(values), [schema, values]);

    const errors = useMemo(
        () => (result.success ? {} : collectIssues(result.error)),
        [result],
    );

    const idFor = useCallback((name: string) => `${formId}-${name}`, [formId]);

    const setValue = useCallback(
        <K extends keyof TValues & string>(name: K, value: TValues[K]) => {
            setValuesState((current) => ({ ...current, [name]: value }));
            setArmed((current) => (current[name] ? current : { ...current, [name]: true }));
        },
        [],
    );

    const setValues = useCallback((patch: Partial<TValues>) => {
        setValuesState((current) => ({ ...current, ...patch }));
        setArmed((current) => {
            const next = { ...current };
            for (const key of Object.keys(patch)) next[key] = true;
            return next;
        });
    }, []);

    const reset = useCallback((next?: TValues) => {
        const target = next ?? baseline.current;
        baseline.current = target;
        setValuesState(target);
        setArmed({});
        setIsSubmitted(false);
    }, []);

    const touch = useCallback((name: string) => {
        setArmed((current) => (current[name] ? current : { ...current, [name]: true }));
    }, []);

    const errorFor = useCallback(
        (name: string) => (isSubmitted || armed[name] ? errors[name] : undefined),
        [errors, armed, isSubmitted],
    );

    const runSubmit = useCallback(() => {
        setIsSubmitted(true);

        const parsed = schema.safeParse(values);
        if (parsed.success) {
            onSubmitRef.current(parsed.data);
            return;
        }

        // Take the user to the first problem rather than leaving them to hunt
        // for the red text — on a long form it may be off-screen entirely.
        const issues = collectIssues(parsed.error);
        const firstField = Object.keys(values).find((key) => key in issues);
        const target = firstField ? document.getElementById(idFor(firstField)) : null;

        if (target) {
            target.focus({ preventScroll: true });
            target.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }, [schema, values, idFor]);

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            runSubmit();
        },
        [runSubmit],
    );

    const isDirty = useMemo(
        () =>
            Object.keys({ ...baseline.current, ...values }).some(
                (key) => values[key] !== baseline.current[key],
            ),
        [values],
    );

    return {
        values,
        errors,
        isValid: result.success,
        isDirty,
        isSubmitted,
        setValue,
        setValues,
        reset,
        touch,
        errorFor,
        formError: isSubmitted ? errors[FORM_ERROR_KEY] : undefined,
        idFor,
        handleSubmit,
        submit: runSubmit,
    };
}
