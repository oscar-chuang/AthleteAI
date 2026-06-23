import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import jwt from "jsonwebtoken";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalRateLimit } from "./middleware/rateLimit";

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
app.use(cors());
app.use(softAuth);
app.use(globalRateLimit);
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, method: req.method, url: req.url?.split("?")[0] }, "Unhandled route error");
  if (!res.headersSent) {
    res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

export default app;
