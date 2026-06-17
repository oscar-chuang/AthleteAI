import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable must be set.");
}

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2025-03-31.basil",
});

export const STRIPE_TIERS = {
  FREE: {
    id: "free",
    name: "Free",
    priceId: null,
    monthlyAnalyses: 3,
    includesChat: false,
    includesBiomechanics: false,
    priceCents: 0,
    features: [
      "3 analyses per month",
      "Basic scoring",
      "Performance insights",
    ],
  },
  PRO: {
    id: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    monthlyAnalyses: 20,
    includesChat: true,
    includesBiomechanics: true,
    priceCents: 999,
    features: [
      "20 analyses per month",
      "Full AI biomechanics analysis",
      "AI coach chat",
      "Joint angle tracking",
      "Injury risk assessment",
    ],
  },
  ELITE: {
    id: "elite",
    name: "Elite",
    priceId: process.env.STRIPE_ELITE_PRICE_ID ?? "",
    monthlyAnalyses: 99999,
    includesChat: true,
    includesBiomechanics: true,
    priceCents: 2499,
    features: [
      "Unlimited analyses",
      "Full AI biomechanics analysis",
      "AI coach chat",
      "Joint angle tracking",
      "Injury risk assessment",
      "Priority support",
      "Video storage",
      "Advanced analytics",
    ],
  },
} as const;

export type TierId = keyof typeof STRIPE_TIERS;

export function getTierConfig(tier: string) {
  return STRIPE_TIERS[tier.toUpperCase() as keyof typeof STRIPE_TIERS] ?? STRIPE_TIERS.FREE;
}

export function getUsageLimits(tier: string) {
  const config = getTierConfig(tier);
  return {
    monthlyAnalyses: config.monthlyAnalyses,
    includesChat: config.includesChat,
    includesBiomechanics: config.includesBiomechanics,
  };
}

export async function createStripeCustomer(email: string, userId: number): Promise<string> {
  const existingCustomers = await stripe.customers.list({ email, limit: 1 });
  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0]!.id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId: String(userId) },
  });
  return customer.id;
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  userId: number,
  successUrl: string,
  cancelUrl: string,
) {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: String(userId) },
    subscription_data: {
      metadata: { userId: String(userId) },
    },
  });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscriptionStatus(subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return {
    status: sub.status,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    tier: getTierFromPriceId(sub.items.data[0]?.price.id ?? ""),
  };
}

export function getTierFromPriceId(priceId: string): string {
  if (priceId === STRIPE_TIERS.PRO.priceId) return "pro";
  if (priceId === STRIPE_TIERS.ELITE.priceId) return "elite";
  return "free";
}

export function getPriceIdFromTier(tier: string): string | null {
  const config = STRIPE_TIERS[tier.toUpperCase() as keyof typeof STRIPE_TIERS];
  return config?.priceId ?? null;
}

export const WEBHOOK_SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export function constructWebhookEvent(body: string | Buffer, signature: string) {
  if (!WEBHOOK_SIGNING_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable must be set.");
  }
  return stripe.webhooks.constructEvent(body, signature, WEBHOOK_SIGNING_SECRET);
}

export function formatSubscriptionResponse(sub: {
  tier: string;
  status: string;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  currentPeriodStart: Date | null;
}) {
  const tierConfig = getTierConfig(sub.tier);
  return {
    id: sub.stripeSubscriptionId ?? `free_${sub.tier}`,
    tier: sub.tier as TierId,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    features: tierConfig.features,
    monthlyAnalyses: tierConfig.monthlyAnalyses,
    includesChat: tierConfig.includesChat,
    includesBiomechanics: tierConfig.includesBiomechanics,
    priceCents: tierConfig.priceCents,
  };
}