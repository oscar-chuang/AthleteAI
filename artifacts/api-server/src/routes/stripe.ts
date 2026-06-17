import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { requireAuth } from "./auth";
import {
  stripe,
  createStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  getSubscriptionStatus,
  formatSubscriptionResponse,
  getUsageLimits,
  STRIPE_TIERS,
} from "../lib/stripe";

const router: IRouter = Router();

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";

/**
 * GET /stripe/config — returns public Stripe key and tier info
 */
router.get("/stripe/config", (_req: Request, res: Response) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    tiers: Object.values(STRIPE_TIERS).map((t) => ({
      id: t.id,
      name: t.name,
      priceCents: t.priceCents,
      features: t.features,
      priceId: t.priceId,
    })),
  });
});

/**
 * GET /stripe/subscription — returns current user's subscription
 */
router.get("/stripe/subscription", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  if (!sub) {
    res.json({ subscription: formatSubscriptionResponse({
      tier: "free",
      status: "active",
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      currentPeriodStart: null,
    })});
    return;
  }

  res.json({ subscription: formatSubscriptionResponse(sub) });
});

/**
 * POST /stripe/create-checkout — create a Stripe checkout session for a subscription
 */
router.post("/stripe/create-checkout", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { tier } = req.body as { tier?: string };

  if (!tier || !["pro", "elite"].includes(tier)) {
    res.status(400).json({ error: "tier must be 'pro' or 'elite'" });
    return;
  }

  const tierConfig = STRIPE_TIERS[tier.toUpperCase() as keyof typeof STRIPE_TIERS];
  if (!tierConfig?.priceId) {
    res.status(400).json({ error: `No price configured for tier: ${tier}` });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let customerId: string;

  // Check if user already has a Stripe customer ID
  const [existingSub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  if (existingSub?.stripeCustomerId) {
    customerId = existingSub.stripeCustomerId;
  } else {
    customerId = await createStripeCustomer(user.email, userId);
  }

  const session = await createCheckoutSession(
    customerId,
    tierConfig.priceId,
    userId,
    `${CLIENT_URL}/settings?checkout=success`,
    `${CLIENT_URL}/settings?checkout=cancelled`,
  );

  res.json({ url: session.url });
});

/**
 * POST /stripe/create-portal — create a Stripe customer portal session
 */
router.post("/stripe/create-portal", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  if (!sub?.stripeCustomerId) {
    res.status(400).json({ error: "No Stripe customer found" });
    return;
  }

  const session = await createPortalSession(sub.stripeCustomerId, `${CLIENT_URL}/settings`);
  res.json({ url: session.url });
});

/**
 * POST /stripe/webhook — Stripe webhook endpoint
 * Processes subscription lifecycle events from Stripe.
 */
router.post("/stripe/webhook", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;
  if (!signature) {
    res.status(400).json({ error: "No stripe signature" });
    return;
  }

  let event;
  try {
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = parseInt(session.metadata?.userId ?? "", 10);
        const subscriptionId = session.subscription as string;

        if (!userId || !subscriptionId) break;

        const status = await getSubscriptionStatus(subscriptionId);

        await db
          .insert(subscriptionsTable)
          .values({
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId,
            tier: status.tier,
            status: status.status,
            currentPeriodStart: status.currentPeriodStart,
            currentPeriodEnd: status.currentPeriodEnd,
          })
          .onConflictDoUpdate({
            target: [subscriptionsTable.userId],
            set: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              tier: status.tier,
              status: status.status,
              currentPeriodStart: status.currentPeriodStart,
              currentPeriodEnd: status.currentPeriodEnd,
              updatedAt: new Date(),
            },
          });

        console.log(`Subscription activated for user ${userId}: ${status.tier}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        const status = await getSubscriptionStatus(subscriptionId);

        await db
          .update(subscriptionsTable)
          .set({
            status: status.status,
            currentPeriodStart: status.currentPeriodStart,
            currentPeriodEnd: status.currentPeriodEnd,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionsTable.stripeSubscriptionId, subscriptionId));

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const subId = subscription.id;

        const status = await getSubscriptionStatus(subId);

        await db
          .update(subscriptionsTable)
          .set({
            status: status.status,
            tier: status.tier,
            currentPeriodStart: status.currentPeriodStart,
            currentPeriodEnd: status.currentPeriodEnd,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionsTable.stripeSubscriptionId, subId));

        console.log(`Subscription ${subId} updated: ${status.status} (${status.tier})`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

/**
 * GET /stripe/usage — returns current user's usage limits and counts
 */
router.get("/stripe/usage", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { count } = require("../lib/stats");
  const { getMonthlyAnalysisCount } = count;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);

  const tier = sub?.tier ?? "free";
  const limits = getUsageLimits(tier);
  const used = await getMonthlyAnalysisCount(userId);

  res.json({
    tier,
    limits,
    used,
    remaining: Math.max(0, limits.monthlyAnalyses - used),
  });
});

export default router;