"use client";

import { useSyncExternalStore } from "react";

/*
 * A coupon code the visitor arrived with (`?coupon=EDEN-25` on a share link),
 * kept in this browser until checkout applies it. Per-browser on purpose: a
 * visitor isn't signed in yet when they open the link, and nothing here is
 * secret — checkout re-checks the code on the server either way.
 */

const KEY = "halfcoders.coupon";
const CHANGED = "halfcoders:coupon";
/** A link opened weeks ago shouldn't still be applying itself. */
const KEEP_MS = 14 * 24 * 60 * 60 * 1000;

const read = (): string | null => {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const saved = JSON.parse(raw) as { code?: string; savedAt?: number };
        if (!saved.code || !saved.savedAt || Date.now() - saved.savedAt > KEEP_MS) return null;
        return saved.code;
    } catch {
        return null;
    }
};

export const saveCoupon = (code: string) => {
    try {
        localStorage.setItem(KEY, JSON.stringify({ code: code.trim().toUpperCase(), savedAt: Date.now() }));
    } catch {
        // Storage blocked — the student can still type the code at checkout.
    }
    window.dispatchEvent(new Event(CHANGED));
};

export const clearCoupon = () => {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // Nothing saved, or storage blocked: nothing to clear.
    }
    window.dispatchEvent(new Event(CHANGED));
};

const subscribe = (onChange: () => void) => {
    window.addEventListener(CHANGED, onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener(CHANGED, onChange);
        window.removeEventListener("storage", onChange);
    };
};

/** The saved code, kept in step across components and tabs; null on the server and when there's none. */
export const useSavedCoupon = () => useSyncExternalStore(subscribe, read, () => null);
