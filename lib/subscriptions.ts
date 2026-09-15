import { env } from "cloudflare:workers";

export type SubscriptionPlan = "demo" | "monthly" | "yearly" | "legacy";
export type PaidPlan = "monthly" | "yearly";
export type SubscriptionStatus = "trialing" | "pending_payment" | "pending_review" | "active" | "expired" | "suspended";

export const PLATFORM_ADMIN_EMAIL = "mussawarhussain@gmail.com";
export const DEMO_DAYS = 7;
export const PLAN_PRICES: Record<PaidPlan, number> = { monthly: 5000, yearly: 50000 };

export type SubscriptionRecord = {
  id: string;
  organization_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  amount_pkr: number;
  trial_starts_at: number | null;
  trial_ends_at: number | null;
  starts_at: number | null;
  ends_at: number | null;
};

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "monthly" || value === "yearly";
}

export function isRegistrationPlan(value: unknown): value is Exclude<SubscriptionPlan, "legacy"> {
  return value === "demo" || isPaidPlan(value);
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}

export async function getOrganizationSubscription(organizationId: string) {
  if (!env.DB) return null;
  return env.DB.prepare(
    "SELECT id,organization_id,plan,status,amount_pkr,trial_starts_at,trial_ends_at,starts_at,ends_at FROM organization_subscriptions WHERE organization_id=?1 LIMIT 1",
  ).bind(organizationId).first<SubscriptionRecord>();
}

export function subscriptionAllowsDashboard(subscription: SubscriptionRecord | null, now = Date.now()) {
  if (!subscription) return false;
  if (subscription.status === "trialing") return !!subscription.trial_ends_at && subscription.trial_ends_at > now;
  return subscription.status === "active" && (!subscription.ends_at || subscription.ends_at > now);
}

export async function organizationAllowsDashboard(organizationId: string) {
  return subscriptionAllowsDashboard(await getOrganizationSubscription(organizationId));
}
