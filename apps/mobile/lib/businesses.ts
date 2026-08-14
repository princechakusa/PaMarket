export type Business = {
  id: string;
  owner_user_id: string;
  name: string;
  logo?: string | null;
  cover?: string | null;
  description?: string | null;
  biz_type?: string | null;
  category?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  province?: string | null;
  city?: string | null;
  suburb?: string | null;
  status: string;
  plan_id?: string | null;
  verification_level?: number | null;
  featured_listing_ids?: string[] | null;
  created_at?: string;
  updated_at?: string | null;
};

export function businessInitials(name: string): string {
  return (name || "S").trim().charAt(0).toUpperCase();
}
