import { Server } from "http";
import app from "./app";
import { envVars } from "./app/config/env";
import { logEnvironmentConfig } from "./app/config/environment";
import { prisma } from "./app/lib/prisma";
import { closeRealtime, initRealtime } from "./app/lib/realtime";
import { closeRedis } from "./app/lib/redis";
import { startScheduler, stopScheduler } from "./app/lib/scheduler";
import { seedOnBoot } from "./app/utils/seed";

let server: Server;

const gracefulShutdown = async (signal: string, exitCode: number) => {
    console.log(`⚠️  ${signal} received. Shutting down gracefully...`);

    const cleanup = async () => {
        try {
            stopScheduler();
            await closeRealtime();
            console.log("Realtime server closed.");
        } catch (error) {
            console.error("Realtime close error:", error);
        }
        await closeRedis();
        try {
            await prisma.$disconnect();
            console.log("Prisma disconnected.");
        } catch (error) {
            console.error("Prisma disconnect error:", error);
        }
        process.exit(exitCode);
    };

    if (server) {
        server.close(() => {
            console.log("HTTP server closed.");
            void cleanup();
        });
    } else {
        await cleanup();
    }

    // Don't hang forever if an in-flight request refuses to finish.
    setTimeout(() => {
        console.error("Forced shutdown after timeout");
        process.exit(1);
    }, 30_000);
};

const bootstrap = async () => {
    try {
        logEnvironmentConfig();

        // Settings defaults, the first super admin and the starter categories
        // and courses — alongside the listen, never in its way: seeding is
        // convenience data, and each step logs its own failure.
        void seedOnBoot();

        server = app.listen(Number(envVars.PORT), () => {
            console.log(`Half Coders API running on http://localhost:${envVars.PORT}`);
            console.log(`Environment: ${envVars.NODE_ENV.toUpperCase()}`);
            console.log(`API base:    http://localhost:${envVars.PORT}/api/v1`);
        });

        // Socket.IO shares the HTTP server so the support queue rides the
        // same port and the same session cookie as the REST API.
        initRealtime(server);
        startScheduler();

        // Prevent zombie connections. keepAliveTimeout sits above a typical
        // 60s proxy idle timeout, and headersTimeout must stay above
        // keepAliveTimeout or Node returns spurious 502s on keep-alive reuse.
        server.requestTimeout = 30_000;
        server.keepAliveTimeout = 65_000;
        server.headersTimeout = 66_000;
        server.maxHeadersCount = 100;
        // Bound concurrent sockets so a connection flood can't exhaust memory
        // or file descriptors on the shared VPS.
        server.maxConnections = 10_000;
    } catch (error) {
        console.error("❌ Failed to start Half Coders API:", error);
        process.exit(1);
    }
};

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM", 0));
process.on("SIGINT", () => void gracefulShutdown("SIGINT", 0));

process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught exception:", error);
    void gracefulShutdown("uncaughtException", 1);
});

process.on("unhandledRejection", (error) => {
    console.error("💥 Unhandled rejection:", error);
    void gracefulShutdown("unhandledRejection", 1);
});

void bootstrap();
