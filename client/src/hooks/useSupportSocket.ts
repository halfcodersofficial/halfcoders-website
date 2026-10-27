"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import envConfig from "@/lib/envConfig";
import type { QueueBoard } from "@/types/domain.types";

/**
 * Subscribes to live queue updates for one support session (plan §27).
 *
 * The mentor advances the serial by hand, so without a push channel every
 * waiting student would have to refresh to notice their number came up. The
 * socket carries the same session cookie as the REST API — `withCredentials`
 * is what makes the handshake authenticate.
 *
 * Returns `null` until the first push arrives; callers render the REST snapshot
 * until then, so the page is never blank waiting on a socket.
 */
export const useSupportSocket = (sessionId: string | null) => {
    const [board, setBoard] = useState<QueueBoard | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!sessionId) return;

        const socket = io(envConfig.socketUrl, {
            withCredentials: true,
            // WebSocket only: the API runs as several containers, and a
            // long-polling session would spread across them (lib/realtime.ts).
            transports: ["websocket"],
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            setIsConnected(true);
            socket.emit("support:join", sessionId);
        });

        socket.on("disconnect", () => setIsConnected(false));

        // A failed handshake is not fatal — the page falls back to polling.
        socket.on("connect_error", () => setIsConnected(false));

        socket.on("support:queue", (payload: QueueBoard) => setBoard(payload));

        socket.on("support:session", (payload: { isLive: boolean; status: string }) => {
            setBoard((current) =>
                current
                    ? { ...current, isLive: payload.isLive, status: payload.status as QueueBoard["status"] }
                    : current,
            );
        });

        return () => {
            socket.emit("support:leave", sessionId);
            socket.disconnect();
            socketRef.current = null;
            setBoard(null);
            setIsConnected(false);
        };
    }, [sessionId]);

    return { board, isConnected };
};
