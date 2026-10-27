import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { redis } from "../lib/redis";

/**
 * Where a limiter keeps its counts. The Docker deployment runs the API as
 * several containers with a shared Redis (REDIS_URL), so counts live there —
 * otherwise each instance would grant its own allowance and a visitor landing
 * on two of them would get double. Without REDIS_URL (development, tests, a
 * single PM2 process) they stay in the process, which is exact for one.
 */
const store = (name: string): Partial<Options> => {
    const client = redis;
    if (!client) return {};
    return {
        store: new RedisStore({
            prefix: `halfcoders:rate-limit:${name}:`,
            sendCommand: (command: string, ...args: string[]) => client.call(command, ...args) as Promise<RedisReply>,
        }),
        // Redis being down must not take the API down with it.
        passOnStoreError: true,
    };
};

/** Strict limiter for sign-in / sign-up / OTP — blunts credential stuffing. */
export const authRateLimiter = rateLimit({
    ...store("auth"),
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many attempts. Please try again in 15 minutes.",
    },
});

/** General API limiter. */
export const apiRateLimiter = rateLimit({
    ...store("api"),
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please slow down.",
    },
});

/**
 * For endpoints that do real work per call — certificate PDF generation,
 * checkout initiation, bulk notification sends.
 */
export const heavyOpsRateLimiter = rateLimit({
    ...store("heavy-ops"),
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests for this operation. Please wait a few minutes.",
    },
});

/**
 * A student's own checkout steps — placing an order, a coupon, starting a
 * payment — counted per student, not per address: at a campus programme a
 * whole hall buys on one Wi-Fi, which a per-IP limit would treat as one very
 * busy visitor. Mount it after `checkAuth`, which sets `req.user`.
 */
export const checkoutRateLimiter = rateLimit({
    ...store("checkout"),
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : ipKeyGenerator(req.ip ?? "")),
    message: {
        success: false,
        message: "Too many tries at checkout. Please wait a few minutes.",
    },
});
