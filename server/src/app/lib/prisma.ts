import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import pg from "pg";
import { PrismaClient } from "../../generated/prisma/client";
import { envVars } from "../config/env";
import { logger } from "../utils/logger";
import dns from "node:dns";
import net from "node:net";

// On networks without working IPv6, Node tries the DB host's IPv6 addresses
// first and gives each attempt only 250ms — shorter than Neon's handshake —
// so every connect fails with ETIMEDOUT. Prefer IPv4 and allow slower attempts.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

// Keep the pool modest: every API replica shares the database's connection
// limit. Raise via DB_POOL_MAX only together with the database's
// max_connections.
const POOL_MAX = Number(process.env.DB_POOL_MAX) || 25;

const pool = new pg.Pool({
    connectionString: envVars.DATABASE_URL,
    max: POOL_MAX,
    // Close idle connections quickly so a quiet period doesn't hold slots the
    // neighbouring app might need.
    idleTimeoutMillis: 30_000,
    // Fail fast on pool exhaustion instead of hanging the request forever.
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    maxLifetimeSeconds: 30 * 60,
    application_name: `halfcoders-api-${envVars.NODE_ENV}`,
});

const adapter = new PrismaPg(pool, {
    // The pool is ours; prisma.$disconnect() ends it on graceful shutdown.
    disposeExternalPool: true,
    // pg-pool emits 'error' when an *idle* client dies (TCP reset, server-side
    // close). Without a handler Node crashes with "Unhandled 'error' event".
    onPoolError: (err) => {
        logger.warn(`[pg-pool] Idle client error (dead client will be dropped): ${err?.message ?? err}`);
    },
    onConnectionError: (err) => {
        logger.warn(`[pg-pool] Connection error mid-query: ${err?.message ?? err}`);
    },
});

export const prisma = new PrismaClient({ adapter });
