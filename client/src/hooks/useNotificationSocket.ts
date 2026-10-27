"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import envConfig from "@/lib/envConfig";

interface IncomingNotification {
    title: string;
    message: string;
    link?: string | null;
    /** An unread entry updated in place (a mentor's hand-in count going up) — refresh, no second toast. */
    silent?: boolean;
}

/**
 * Live delivery for in-app notifications — an enrolment, a published module,
 * a graded assignment — instead of waiting on the bell's 60-second poll.
 *
 * Unlike `useSupportSocket`, there's nothing to join: the server puts every
 * authenticated socket in its own room the moment it connects, since a
 * user's own notifications aren't a resource they opt into watching. This
 * hook only has to listen, then nudge React Query to refetch — the pushed
 * payload is a "something changed" signal, not always a full row (a
 * broadcast to many recipients at once doesn't carry per-row ids), so
 * re-fetching the real list is simpler than trying to splice it in by hand.
 */
export const useNotificationSocket = (enabled: boolean) => {
    const queryClient = useQueryClient();
    const router = useRouter();
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const socket = io(envConfig.socketUrl, {
            withCredentials: true,
            // WebSocket only: the API runs as several containers, and a
            // long-polling session would spread across them (lib/realtime.ts).
            transports: ["websocket"],
        });
        socketRef.current = socket;

        socket.on("notification:new", (payload: IncomingNotification) => {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            if (payload.silent) return;

            toast.message(payload.title, {
                description: payload.message,
                action: payload.link
                    ? { label: "View", onClick: () => router.push(payload.link!) }
                    : undefined,
            });
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [enabled, queryClient, router]);
};
