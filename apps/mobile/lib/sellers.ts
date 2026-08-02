import { supabase } from "./supabase";

export type PublicProfile = {
  id: string;
  name: string | null;
  avatar: string | null;
  verified: boolean | null;
};

export type Review = {
  reviewer_id: string;
  rating: number;
  created_at: string;
};

export function sellerInitials(name: string | null | undefined): string {
  return (name || "S").trim().charAt(0).toUpperCase();
}

export function averageRating(reviews: Review[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
}

// Server-side count/avg (get_seller_rating_summary RPC) instead of fetching
// up to 200 raw review rows just to reduce them client-side — screens that
// only ever show a count and a star average (not the review list itself)
// should use this so a seller with 200+ reviews gets a correct average
// instead of one silently truncated to their most recent 200.
export async function fetchSellerRatingSummary(sellerId: string): Promise<{ count: number; average: number }> {
  const { data } = await supabase.rpc("get_seller_rating_summary", { seller: sellerId }).maybeSingle();
  const row = data as { review_count: number; avg_rating: number } | null;
  return { count: row?.review_count ?? 0, average: Number(row?.avg_rating ?? 0) };
}
