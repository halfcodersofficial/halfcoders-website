import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import path from "path";
import qs from "qs";
import { envVars } from "./app/config/env";
import AppError from "./app/errorHelpers/AppError";
import { installFriendlyZodMessages } from "./app/errorHelpers/zodMessages";
import { prisma } from "./app/lib/prisma";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { apiRateLimiter } from "./app/middleware/rateLimiter";
import { IndexRoutes } from "./app/routes";

// Validation messages go straight to the user as toasts — word Zod's defaults.
installFriendlyZodMessages();

const app: Application = express();

// The API sits behind a proxy (Render's load balancer, or nginx on a VPS) that
// forwards the client IP. express-rate-limit needs the right hop count to key
// limits per person rather than per proxy, and the devices list shows the IP —
// see TRUST_PROXY in .env.example.
app.set("trust proxy", envVars.TRUST_PROXY);

app.use(compression());

// This server returns JSON only — EJS templates are rendered to strings for
// email bodies and never served as documents — so the CSP can be maximally
// locked down: if a response is ever coerced into a document context, nothing
// in it can load or execute.
app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                "default-src": ["'none'"],
                "frame-ancestors": ["'none'"],
                "base-uri": ["'none'"],
                "form-action": ["'none'"],
            },
        },
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
    }),
);

// Headers helmet's defaults don't cover. This is a JSON API, so no response
// legitimately needs camera, mic, geolocation, payment-request, etc.
const PERMISSIONS_POLICY = [
    "accelerometer=()", "autoplay=()", "camera=()", "display-capture=()",
    "encrypted-media=()", "fullscreen=()", "geolocation=()", "gyroscope=()",
    "magnetometer=()", "microphone=()", "midi=()", "payment=()",
    "picture-in-picture=()", "usb=()", "interest-cohort=()",
].join(", ");

app.use((_req, res, next) => {
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
    res.removeHeader("X-Powered-By");
    next();
});

// `qs` so nested filter syntax works: ?price[gte]=500&price[lte]=5000
app.set("query parser", (str: string) => qs.parse(str));

app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), "src/app/templates"));

// CORS — only the Half Coders frontend, with credentials, so its fetches carry
// the session cookie.
const allowedOrigins = [
    envVars.FRONTEND_URL,
    ...(envVars.NODE_ENV === "development"
        ? ["http://localhost:3001", "http://localhost:5001"]
        : []),
];

const corsOptions = {
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Session-Refresh", "X-Session-Expires-At"],
    maxAge: 3600,
};

app.use(
    cors((req, callback) => {
        // No Origin header: curl, server-to-server, mobile apps.
        const origin = req.headers.origin;
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, { ...corsOptions, origin: true, credentials: true });
        }
        callback(new AppError(403, `CORS policy violation: origin "${origin}" is not allowed`));
    }),
);

app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));

app.use("/api/v1", apiRateLimiter, IndexRoutes);

app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: "Half Coders API is running" });
});

// Liveness — always 200 while the process is up.
app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness — 200 only when the database is actually reachable, so nginx and
// PM2 don't route traffic at a process that can't serve it.
app.get("/readiness", async (_req: Request, res: Response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: "ready", checks: { database: "ok" } });
    } catch {
        res.status(503).json({ status: "not ready", checks: { database: "error" } });
    }
});

// Must be last, and in this order.
app.use(globalErrorHandler);
app.use(notFound);

export default app;
