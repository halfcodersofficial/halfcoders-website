import Redis from "ioredis";
import { envVars } from "../config/env";
import { logger } from "../utils/logger";

/**
 * The shared Redis, when REDIS_URL is set — what lets the API run as several
 * containers at once. Rate-limit counters (middleware/rateLimiter.ts) and
 * Socket.IO pushes (lib/realtime.ts) go through it, so every instance counts
 * the same requests and every connected browser gets every push, whichever
 * instance raised it.
 *
 * Unset (development, tests, a single PM2 process) → null, and both keep
 * their state in the process, which is exact when there is only one.
 */

const clients: Redis[] = [];

const connect = (name: string): Redis => {
    const client = new Redis(envVars.REDIS_URL as string, {
        connectionName: `halfcoders-${name}`,
        // Fail a command quickly while Redis is down rather than holding the
        // request: the rate limiter lets requests through on a store error.
        maxRetriesPerRequest: 2,
    });
    client.on("error", (error: Error) => logger.warn(`Redis (${name}) unavailable`, error.message));
    clients.push(client);
    return client;
};

export const redis: Redis | null = envVars.REDIS_URL ? connect("main") : null;

/** A connection of its own for Socket.IO's subscriptions: a subscribed connection can't run other commands. */
export const redisSubscriber = (): Redis | null => (envVars.REDIS_URL ? connect("subscriber") : null);

export const closeRedis = async () => {
    await Promise.allSettled(clients.map((client) => client.quit()));
};
