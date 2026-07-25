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
