import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import jwt from "jsonwebtoken";
import router from "./routes";
import { logger } from "./lib/logger";


const JWT_SECRET = process.env["JWT_SECRET"];

function softAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET ?? "") as { userId?: number };
      if (typeof payload.userId === "number") {
        (req as Request & { userId?: number }).userId = payload.userId;
      }
    }
  } catch {
  }
  next();
}

const app: Express = express();

// Security headers — XSS protection, MIME sniffing, HSTS, framing, etc.
app.use(helmet());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS: This API is consumed exclusively by the Expo/React Native mobile app.
// Mobile clients do not use CORS — the Access-Control-Allow-Origin: * is intentional,
// not a gap. If a web client is added in the future, switch to an explicit allowlist.
app.use(cors());
// softAuth: optionally decodes a JWT on every request and attaches userId,
// so route handlers can access it without requiring auth on public routes.
app.use(softAuth);

// ─── Rate limiters ────────────────────────────────────────────────────────────
// Two complementary layers:
//   1. express-rate-limit (in-memory, per-IP) — fast baseline, no Redis dependency
//   2. Redis-based per-user limiters applied per-route in the router (aiRateLimit)

// Global: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Auth: 10 requests per 15 minutes per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." },
});

// AI routes: 20 requests per hour per IP (Claude calls are expensive)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI request limit reached. Please try again in an hour." },
});

app.use(globalLimiter);

// Apply strict auth limiter to login and signup before the main router
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/register", authLimiter);

// Apply AI limiter to chat and analysis creation (both trigger Claude calls)
app.use("/api/chat", aiLimiter);
app.use("/api/analyses", (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === "POST") { aiLimiter(req, res, next); return; }
  next();
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
// The biomechanics PATCH sends a base64-encoded video frame (up to ~3 MB).
// Every other route should never need more than 50 KB of JSON.
app.use((req: Request, res: Response, next: NextFunction): void => {
  const isAnalysesPatch =
    req.method === "PATCH" && /^\/api\/analyses\/\d+$/.test(req.path);
  express.json({ limit: isAnalysesPatch ? "15mb" : "50kb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

app.use("/api", router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  // Pass through HTTP errors from middleware (e.g. 413 from body-parser, 429 from rate limiter).
  // Only log and convert to 500 for unexpected server errors.
  const httpErr = err as { status?: number; statusCode?: number; message?: string };
  const status = httpErr.status ?? httpErr.statusCode;
  if (status && status >= 400 && status < 500) {
    if (!res.headersSent) {
      res.status(status).json({ error: httpErr.message ?? "Request error" });
    }
    return;
  }
  logger.error({ err, method: req.method, url: req.url?.split("?")[0] }, "Unhandled route error");
  if (!res.headersSent) {
    res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

export default app;
