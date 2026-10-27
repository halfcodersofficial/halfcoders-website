"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supportService } from "@/services";

/**
 * Prefills a new support session's minutes-per-student with the platform
 * default (admin Settings → Support sessions) once it's known — unless the
 * field has already been changed by hand. Until then, or if the request
 * fails, the form keeps the value it started with.
 */
export function useSupportSlotDefault(current: string, apply: (value: string) => void) {
    const { data } = useQuery({
        queryKey: ["support", "defaults"],
        queryFn: supportService.defaults,
        staleTime: 60_000,
    });
    const started = useRef(current);
    const applied = useRef(false);

    useEffect(() => {
        if (!data || applied.current) return;
        applied.current = true;
        if (current === started.current) apply(String(data.slotMinutes));
    }, [data, current, apply]);
}
