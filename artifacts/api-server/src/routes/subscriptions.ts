import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: null,
    description: "Get started with AI coaching",
    features: [
      "3 video analyses per month",
      "Basic biomechanics report",
      "Technique scores",
      "Injury risk indicators",
    ],
    limits: {
      analysesPerMonth: 3,
      aiChat: false,
      proComparisons: false,
      priorityProcessing: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: 9.99,
    period: "month",
    description: "For serious athletes",
    popular: true,
    revenueCatProductId: "com.athleteai.pro.monthly",
    features: [
      "Unlimited video analyses",
      "AI coach chat (powered by Claude)",
      "Detailed coaching tips & drills",
      "Injury prevention plans",
      "Progress tracking & charts",
      "Priority processing",
    ],
    limits: {
      analysesPerMonth: -1,
      aiChat: true,
      proComparisons: false,
      priorityProcessing: true,
    },
  },
  {
    id: "elite",
    name: "Elite",
    price: 24.99,
    period: "month",
    description: "For competitive athletes",
    revenueCatProductId: "com.athleteai.elite.monthly",
    features: [
      "Everything in Pro",
      "Pro athlete comparisons",
      "Side-by-side technique analysis",
      "Advanced biomechanics report",
      "Custom training programs",
      "Early access to new features",
    ],
    limits: {
      analysesPerMonth: -1,
      aiChat: true,
      proComparisons: true,
      priorityProcessing: true,
    },
  },
];

// GET /api/subscriptions/plans
router.get("/subscriptions/plans", (_req, res) => {
  res.json({ plans: PLANS });
});

// GET /api/subscriptions/current
router.get("/subscriptions/current", authenticate, async (req: AuthRequest, res) => {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, req.userId!))
    .limit(1);

  const plan = PLANS.find((p) => p.id === (sub?.tier ?? "free")) ?? PLANS[0];
  res.json({ subscription: sub, plan });
});

// POST /api/subscriptions/update — called by RevenueCat webhook or manually
const updateSchema = z.object({
  tier: z.enum(["free", "pro", "elite"]),
  revenueCatCustomerId: z.string().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
});

router.post("/subscriptions/update", authenticate, async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [updated] = await db
    .update(subscriptionsTable)
    .set({
      tier: parsed.data.tier,
      revenueCatCustomerId: parsed.data.revenueCatCustomerId,
      currentPeriodEnd: parsed.data.currentPeriodEnd
        ? new Date(parsed.data.currentPeriodEnd)
        : undefined,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.userId, req.userId!))
    .returning();

  res.json({ subscription: updated });
});

export default router;
