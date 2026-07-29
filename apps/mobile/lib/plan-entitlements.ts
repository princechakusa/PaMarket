import { supabase } from "./supabase";

// Mirrors www/js/business-subscription.js H.PLAN_ENTITLEMENTS — the single
// source of truth for plan limits. Paid upgrades (app-store billing) are
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
  if (data.current_period_end && !data.auto_renew && Date.now() > new Date(data.current_period_end).getTime()) {
    return null;
  }
  return data as BusinessSubscription;
}

export async function businessEntitlements(businessId: string, fallbackPlanId?: string | null): Promise<PlanEntitlements> {
  const active = await activeSubscription(businessId);
  const planId = active?.plan_id || fallbackPlanId || "free";
  return planEntitlements(planId);
}
