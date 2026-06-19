import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable, profilesTable } from "@workspace/db";
import { z } from "zod";
import { computeProfileStats } from "../lib/stats";

const router: IRouter = Router();

const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set.");
}

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1),
});

async function createAndReturnUser(email: string, password: string, res: Response, statusCode = 200) {
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash })
    .returning({ id: usersTable.id, email: usersTable.email, createdAt: usersTable.createdAt });

  const token = jwt.sign({ userId: user!.id, email: user!.email }, JWT_SECRET!, {
    expiresIn: "30d",
  });

  res.status(statusCode).json({ token, user });
}

// POST /auth/signup (and alias /auth/register)
async function handleSignup(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  await createAndReturnUser(email, password, res, 201);
}

router.post("/auth/signup", handleSignup);
router.post("/auth/register", handleSignup);

// POST /auth/login
router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET!, {
    expiresIn: "30d",
  });

  res.json({
    token,
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
  });
});

// GET /auth/me — returns the current user from the JWT token
router.get("/auth/me", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  let payload: { userId: number; email: string };
  try {
    payload = jwt.verify(token, JWT_SECRET!) as { userId: number; email: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const [profileRow] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, user.id))
    .limit(1);

  let formattedProfile = null;
  if (profileRow) {
    const { streak, weeklyProgress } = await computeProfileStats(
      user.id,
      profileRow.trainingDays ?? undefined
    );
    formattedProfile = {
      id: String(profileRow.id),
      userId: String(profileRow.userId),
      name: profileRow.name,
      sport: profileRow.sport,
      level: profileRow.level,
      goals: profileRow.goals ?? [],
      injuryConcerns: profileRow.injuryConcerns ?? [],
      weeklyGoal: profileRow.weeklyGoal,
      trainingDays: profileRow.trainingDays ?? [0, 1, 2, 3, 4, 5, 6],
      checkInHour: profileRow.checkInHour ?? 9,
      weeklyProgress,
      streakDays: streak,
      avatarUrl: profileRow.avatarUrl ?? null,
    };
  }

  res.json({ user, profile: formattedProfile, subscription: { id: "free", userId: String(user.id), tier: "free", status: "active" } });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: Function): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: "No token provided" }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET!) as { userId: number; email: string };
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export default router;
