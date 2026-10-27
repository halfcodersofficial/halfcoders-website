import { createAdapter } from "@socket.io/redis-adapter";
import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { envVars } from "../config/env";
import { logger } from "../utils/logger";
import { resolveCookieHeaderSession } from "./session";
import { redis, redisSubscriber } from "./redis";

/**
 * Real-time push: the support queue (plan §27) and, since then, every
 * in-app notification.
 *
 * The mentor advances the queue by hand — they finish with a student, click
 * Done, and the next serial becomes current. Without a push channel every
 * waiting student would have to poll to notice, so the queue is broadcast to a
 * room per session instead. Notifications reuse the same socket server: every
 * connected user sits in their own room from the moment they connect, so
 * `NotificationService` can hand a freshly created row straight to
 * `emitNotification` without the client asking to watch anything first.
 *
 * Deliberately thin: the service layer calls `emitQueueUpdate` /
 * `emitNotification` and knows nothing else about sockets, so that logic
 * stays testable and the API works correctly even when the socket server
 * never started.
 */

let io: SocketServer | null = null;

const sessionRoom = (sessionId: string) => `support:${sessionId}`;
const userRoom = (userId: string) => `user:${userId}`;

export const initRealtime = (httpServer: HttpServer) => {
    io = new SocketServer(httpServer, {
        // Same origin policy as the REST API — a socket carries the same
        // session cookie, so it needs the same restriction.
        cors: {
            origin: [
                envVars.FRONTEND_URL,
                ...(envVars.NODE_ENV === "development" ? ["http://localhost:3001"] : []),
            ],
            credentials: true,
        },
        path: "/socket.io",
        // WebSocket only. Behind nginx the API runs as several containers,
        // and the long-polling fallback is a series of requests that must all
        // reach the instance holding the handshake; a WebSocket is one
        // connection to one instance. (The client asks for the same.)
        transports: ["websocket"],
    });

    // Several containers: a push raised on one instance (a mentor moving the
    // queue, a new notification) reaches browsers connected to the others.
    const subscriber = redisSubscriber();
    if (redis && subscriber) {
        io.adapter(createAdapter(redis, subscriber, { key: "halfcoders:socket.io" }));
    }

    // Authenticate on connect with the same session cookie the REST API
    // accepts. An unauthenticated socket is refused outright rather
    // than being allowed to sit in a room silently receiving names and queue
    // positions of real students.
    io.use(async (socket, next) => {
        try {
            const result = await resolveCookieHeaderSession(socket.handshake.headers.cookie);

            if (!result.ok) {
                return next(new Error("Unauthorized"));
            }

            socket.data.userId = result.identity.userId;
            socket.data.role = result.identity.role;
            next();
        } catch (error) {
            logger.warn("Socket authentication failed", error);
            next(new Error("Unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        // Every authenticated socket gets its own notification room straight
        // away — unlike support sessions, which are a resource the client
        // chooses to watch, a user's own notifications aren't opt-in, and the
        // auth middleware has already put the id on `socket.data`.
        void socket.join(userRoom(socket.data.userId));

        // Rooms are per session. Membership is not a permission grant: the
        // payload broadcast to a room is the same public queue board the REST
        // endpoint returns, and the meeting link is never pushed over a socket.
        socket.on("support:join", (sessionId: unknown) => {
            if (typeof sessionId === "string" && sessionId.length > 0) {
                void socket.join(sessionRoom(sessionId));
            }
        });

        socket.on("support:leave", (sessionId: unknown) => {
            if (typeof sessionId === "string" && sessionId.length > 0) {
                void socket.leave(sessionRoom(sessionId));
            }
        });
    });

    logger.info("Realtime support queue ready");
    return io;
};

/** Broadcasts the current queue board to everyone watching a session. */
export const emitQueueUpdate = (sessionId: string, payload: unknown) => {
    // No socket server (tests, or a deployment that hasn't enabled it) is not
    // an error — the REST endpoints remain the source of truth.
    if (!io) return;
    io.to(sessionRoom(sessionId)).emit("support:queue", payload);
};

/** Announces a session going live or ending, so clients can flip the UI. */
export const emitSessionStatus = (sessionId: string, payload: unknown) => {
    if (!io) return;
    io.to(sessionRoom(sessionId)).emit("support:session", payload);
};

/** Pushes a freshly created notification straight to its owner, if connected. */
export const emitNotification = (userId: string, payload: unknown) => {
    if (!io) return;
    io.to(userRoom(userId)).emit("notification:new", payload);
};

export const closeRealtime = async () => {
    if (!io) return;
    await io.close();
    io = null;
};
