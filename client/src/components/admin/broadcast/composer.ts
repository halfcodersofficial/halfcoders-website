"use client";

import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";
import { optionalTextField, textField } from "@/lib/validation";
import type { BroadcastAudience } from "@/types/admin.types";

/*
 * What the two broadcast composers — Broadcast and Popup Alert — share: the
 * message's fields and rules, who it reaches, where it can link to, and the
 * draft kept on this device.
 */

export const AUDIENCES = ["ALL_STUDENTS", "ALL_MENTORS", "COURSE"] as const;

export const count = (value: number) => value.toLocaleString("en-US");

export const messageShape = {
    // An enum rather than a string so the audience reaching the API is
    // narrowed to the three the endpoint accepts.
    audience: z.enum(AUDIENCES),
    courseId: z.string(),
    title: textField({ label: "Title", min: 3, max: 160 }),
    message: textField({ label: "Message", min: 3, max: 2000 }),
    type: z.string(),
    // A full URL here would send the recipient off the platform, and the bell
    // and the pop-up both build their href from this as a path.
    link: optionalTextField({ label: "Link", max: 500 }).refine((value) => value === "" || value.startsWith("/"), {
        message: "Use a path inside Half Coders, starting with / — not a full URL",
    }),
};

/** For `.refine(courseChosen, COURSE_REQUIRED)`: a course audience needs its course. */
export const courseChosen = (data: { audience: string; courseId: string }) =>
    data.audience !== "COURSE" || Boolean(data.courseId);
export const COURSE_REQUIRED = { path: ["courseId"], message: "Choose which course's students to notify" };

export const EMPTY_MESSAGE = {
    audience: "ALL_STUDENTS",
    courseId: "",
    title: "",
    message: "",
    type: "GENERAL",
    link: "",
};

export type MessageDraft = typeof EMPTY_MESSAGE;

export const hasWords = (values: MessageDraft) =>
    Boolean(values.title.trim() || values.message.trim() || values.link.trim());

/** The words cleared, the audience and the rest kept — what the next message usually reuses. */
export const withoutWords = <T extends MessageDraft>(values: T): T => ({ ...values, title: "", message: "", link: "" });

export const people = (n: number, audience: string) =>
    `${count(n)} ${audience === "ALL_MENTORS" ? "mentor" : "student"}${n === 1 ? "" : "s"}`;

/** How many the current audience reaches — `null` until known (or until a course is picked). */
export const reachOf = (values: MessageDraft, audience: BroadcastAudience | undefined) => {
    if (!audience) return null;
    if (values.audience === "ALL_STUDENTS") return audience.students;
    if (values.audience === "ALL_MENTORS") return audience.mentors;
    return audience.courses.find((entry) => entry.course.id === values.courseId)?.recipients ?? null;
};

/** Where a message to this audience usually points — one click instead of remembering the path. */
export const destinationsFor = (values: MessageDraft, audience: BroadcastAudience | undefined) => {
    if (values.audience === "ALL_MENTORS") return [{ label: "Mentor console", path: "/mentor" }];
    if (values.audience !== "COURSE") {
        return [
            { label: "Dashboard", path: "/dashboard" },
            { label: "Courses", path: "/courses" },
        ];
    }

    const course = audience?.courses.find((entry) => entry.course.id === values.courseId)?.course;
    if (!course) return [];
    return [
        { label: "Course player", path: `/learn/${course.slug}` },
        { label: "Outline", path: `/learn/${course.slug}/outline` },
        { label: "Assignments", path: `/learn/${course.slug}/assignments` },
        { label: "Support", path: `/learn/${course.slug}/support` },
    ];
};

const forget = (key: string) => {
    try {
        localStorage.removeItem(key);
    } catch {
        // Storage blocked — there was nothing kept to forget.
    }
};

/** A kept draft, if it still has the shape of one; a field holding a value it can't take falls back to empty's. */
const readDraft = <T extends MessageDraft>(key: string, empty: T, allowed: Partial<Record<keyof T, readonly string[]>>) => {
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
        if (!raw || typeof raw !== "object") return null;

        const draft = { ...empty };
        for (const field of Object.keys(empty) as (keyof T)[]) {
            const value = (raw as Record<keyof T, unknown>)[field];
            if (typeof value !== "string") continue;
            const options = allowed[field];
            if (!options || options.includes(value)) draft[field] = value as T[keyof T];
        }
        return draft;
    } catch {
        return null;
    }
};

/**
 * Keeps an unsent message on this device under `key`, so a reload or a
 * wander to another page doesn't lose it: restored once after mount (so the
 * server render and the first client render agree), saved as it's typed,
 * dropped once there are no words left. Returns `forget`, for a send or a
 * "Clear". `empty` and `allowed` must be stable (module constants).
 */
export function useKeptDraft<T extends MessageDraft>(
    key: string,
    empty: T,
    allowed: Partial<Record<keyof T, readonly string[]>>,
    values: T,
    reset: (next: T) => void,
) {
    const restored = useRef(false);

    useEffect(() => {
        const draft = readDraft(key, empty, { audience: AUDIENCES, ...allowed });
        if (draft) reset(draft);
        restored.current = true;
    }, [key, empty, allowed, reset]);

    useEffect(() => {
        if (!restored.current) return;
        const timer = window.setTimeout(() => {
            try {
                if (hasWords(values)) localStorage.setItem(key, JSON.stringify(values));
                else localStorage.removeItem(key);
            } catch {
                // Not kept this time; the form still works.
            }
        }, 400);
        return () => window.clearTimeout(timer);
    }, [key, values]);

    return useCallback(() => forget(key), [key]);
}

/**
 * A kept draft can name a course that has since been deleted — drop it rather
 * than send to a course the picker can no longer show.
 */
export function useDropMissingCourse(
    audience: BroadcastAudience | undefined,
    courseId: string,
    clear: () => void,
) {
    useEffect(() => {
        if (audience && courseId && !audience.courses.some((entry) => entry.course.id === courseId)) clear();
    }, [audience, courseId, clear]);
}
