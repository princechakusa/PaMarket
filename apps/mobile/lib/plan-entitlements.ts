import { supabase } from "./supabase";

// Mirrors www/js/business-subscription.js H.PLAN_ENTITLEMENTS — the single
// source of truth for plan limits. Paid upgrades (Google Play Billing) are
// out of scope for now; this covers read-only entitlement checks (listing
// limits, staff limits, featured slots) needed by the listings/team screens.
export type PlanEntitlements = {
  name: string;
  listingLimit: number; // -1 = unlimited
  staffLimit: number;
  featuredSlots: number;
  analytics: "none" | "basic" | "full";
  rank: number;
};

export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlements> = {
  free: { name: "Free", listingLimit: 3, staffLimit: 0, featuredSlots: 0, analytics: "none", rank: 0 },
  starter: { name: "Starter", listingLimit: 15, staffLimit: 2, featuredSlots: 0, analytics: "basic", rank: 1 },
  pro: { name: "Pro", listingLimit: 60, staffLimit: 10, featuredSlots: 1, analytics: "full", rank: 2 },
  premium: { name: "Premium", listingLimit: -1, staffLimit: Infinity, featuredSlots: 3, analytics: "full", rank: 3 },
};

export function planEntitlements(planId: string | null | undefined): PlanEntitlements {
  return PLAN_ENTITLEMENTS[planId || "free"] || PLAN_ENTITLEMENTS.free;
}

export type BusinessSubscription = {
  id: string;
  business_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  auto_renew: boolean;
};

export async function activeSubscription(businessId: string): Promise<BusinessSubscription | null> {
  const { data } = await supabase
    .from("business_subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  // auto_renew says Apple/Google *intends* to bill again — it does not extend
  // entitlement past the period already paid for. The old condition included
  // `&& !data.auto_renew`, so a lapsed subscription whose auto_renew was still
  // true stayed on a paid plan forever; that is why a reset Starter kept
  // reappearing. A renewal moves current_period_end forward, and that is the
  // only thing that should keep access alive.
  if (data.current_period_end && Date.now() > new Date(data.current_period_end).getTime()) {
    return null;
  }
  return data as BusinessSubscription;
}

export async function businessEntitlements(businessId: string, fallbackPlanId?: string | null): Promise<PlanEntitlements> {
  const active = await activeSubscription(businessId);
  if (active) return planEntitlements(active.plan_id);

  // businesses.plan_id is a cached display value written by
  // activate_play_subscription; it is not authoritative and nothing clears it
  // when a period lapses. Using it as a fallback re-granted the paid plan the
  // moment the expiry check above started working, so a stale 'starter' here
  // must never outrank an expired (or absent) subscription row. Only trust it
  // when it is already a free tier.
  const cached = (fallbackPlanId || "free").toLowerCase();
  return planEntitlements(cached === "free" ? cached : "free");
}
