import pino from "pino";
import { isDevelopment } from "../config/env";

type CrudOperation = "CREATE" | "READ" | "UPDATE" | "DELETE" | "AUTH";

const SENSITIVE_KEYS = [
    "password", "token", "secret", "accesstoken", "refreshtoken",
    "sessiontoken", "otp", "newpassword", "oldpassword", "currentpassword",
    "authorization", "cookie", "storepassword", "temporaryPassword",
];

/**
 * Pino is async and non-blocking, so heavy logging never stalls the event
 * loop. Dev gets pretty-printed lines; production emits raw JSON to stdout for
 * whatever log shipper the VPS runs.
 */
const baseLogger = pino({
    level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
    base: {
        env: process.env.NODE_ENV,
        service: "halfcoders-api",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: SENSITIVE_KEYS.flatMap((k) => [k, `*.${k}`, `*.*.${k}`]),
        censor: "[REDACTED]",
    },
    ...(isDevelopment
        ? {
            transport: {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:HH:MM:ss.l",
                    ignore: "pid,hostname,service,env",
                },
            },
        }
        : {}),
});

const withOp = (op: CrudOperation) => (message: string, data?: unknown) => {
    if (data === undefined) {
        baseLogger.debug({ op }, message);
    } else {
        baseLogger.debug({ op, data }, message);
    }
};

export const logger = {
    create: withOp("CREATE"),
    read: withOp("READ"),
    update: withOp("UPDATE"),
    delete: withOp("DELETE"),
    auth: (message: string, data?: unknown) =>
        data === undefined
            ? baseLogger.debug({ op: "AUTH" }, message)
            : baseLogger.debug({ op: "AUTH", data }, message),
    info: (message: string, data?: unknown) =>
        data === undefined ? baseLogger.info(message) : baseLogger.info({ data }, message),
    warn: (message: string, data?: unknown) =>
        data === undefined ? baseLogger.warn(message) : baseLogger.warn({ data }, message),
    error: (message: string, error?: unknown) =>
        error === undefined ? baseLogger.error(message) : baseLogger.error({ err: error }, message),
    raw: baseLogger,
};
