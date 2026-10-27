"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { loginPopupAlert } from "@/lib/confirm";
import { useSession } from "@/hooks/useSession";
import { notificationService } from "@/services";

/**
 * Which repeating pop-ups this browser has already shown in the current login
 * session — so "every time they log in" means once per sign-in, not once per
 * page load (each with its ten-second lock).
 */
const SHOWN_KEY = "halfcoders.loginPopups.shown";

const readShown = (session: string): string[] => {
    try {
        const saved = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "null") as { session?: unknown; ids?: unknown } | null;
        if (saved?.session !== session || !Array.isArray(saved.ids)) return [];
        return saved.ids.filter((id): id is string => typeof id === "string");
    } catch {
        return [];
    }
};

const rememberShown = (session: string, ids: string[]) => {
    try {
        localStorage.setItem(SHOWN_KEY, JSON.stringify({ session, ids }));
    } catch {
        // Storage blocked — it shows again on the next page load, as it did before.
    }
};

/**
 * Mounted once in the root layout. The moment a session resolves to a signed-
 * in user, it asks the API for the admin broadcasts flagged to pop up at
 * login and walks through them one at a time as blocking SweetAlert modals.
 *
 * A one-shot pop-up is marked read once the recipient has closed it — not
 * when it's fetched — so one cut short by a reload or a navigation comes back
 * instead of being lost. A repeating one stays unread (that's what keeps it
 * coming) and is shown once per login session: the API names the session,
 * and this browser remembers what it has shown under that name.
 */
export default function LoginPopupListener() {
    const { user } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();
    const lastUserId = useRef<string | null>(null);

    useEffect(() => {
        if (!user || lastUserId.current === user.id) return;
        lastUserId.current = user.id;

        (async () => {
            const result = await notificationService.loginPopups().catch(() => null);
            if (!result) return;

            const { session, popups } = result;
            const shown = session ? readShown(session) : [];

            for (const popup of popups) {
                if (popup.repeatOnLogin && shown.includes(popup.id)) continue;

                const link = await loginPopupAlert({
                    title: popup.title,
                    text: popup.message,
                    link: popup.link,
                });

                if (!popup.repeatOnLogin) {
                    await notificationService.markRead(popup.id).catch(() => undefined);
                } else if (session) {
                    shown.push(popup.id);
                    rememberShown(session, shown);
                }
                // The bell's unread count and list move with it.
                void queryClient.invalidateQueries({ queryKey: ["notifications"] });

                if (link) router.push(link);
            }
        })();
    }, [user, router, queryClient]);

    return null;
}
