import { supabase } from "./supabase";

export type LeadType = "whatsapp" | "call" | "chat";
export type LeadStatus = "new" | "active" | "closed";

export type BusinessLead = {
  id: string;
  business_id: string;
  listing_id: string | null;
  user_id: string | null;
  user_name: string | null;
  type: LeadType;
  status: LeadStatus;
  created_at: string;
};

export async function fetchBusinessLeads(businessId: string): Promise<BusinessLead[]> {
  const { data } = await supabase
    .from("business_leads")
    .select("id,business_id,listing_id,user_id,user_name,type,status,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as BusinessLead[]) ?? [];
}

// Mirrors www/js/business-leads.js H.recordLead — captured whenever a user
// contacts a business-owned listing via WhatsApp/Call/Chat.
export async function recordLead(listingId: string, type: LeadType, userId: string | null, userName: string) {
  const { data: listing } = await supabase
    .from("listings")
    .select("id,business_id,leads,clicks,title")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing?.business_id) return;

  // business_leads INSERT is restricted to `authenticated` with
  // user_id = auth.uid(), so a signed-out visitor tapping Call or WhatsApp got
  // a 401. Lead capture is analytics for the seller — it must never stop a
  // buyer from making contact, so guests are skipped and any failure is
  // swallowed rather than propagated to the tap handler.
  if (userId) {
    const { error } = await supabase.from("business_leads").insert({
      business_id: listing.business_id,
      listing_id: listingId,
      user_id: userId,
      user_name: userName,
      type,
      status: "new",
    });
    if (error) console.warn("[leads] insert failed:", error.message);
  }
  await supabase
    .from("listings")
    .update({ leads: (listing.leads ?? 0) + 1, clicks: (listing.clicks ?? 0) + 1 })
    .eq("id", listingId);
}

// Mirrors H.recordShopLead — a contact action on the shop itself (not tied
// to one listing).
export async function recordShopLead(businessId: string, type: LeadType, userId: string | null, userName: string) {
  await supabase.from("business_leads").insert({
    business_id: businessId,
    listing_id: null,
    user_id: userId,
    user_name: userName,
    type,
    status: "new",
  });
}
