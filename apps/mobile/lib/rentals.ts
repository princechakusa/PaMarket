export type RentalListingSummary = {
  id: string;
  cover_url: string | null;
  is_featured: boolean;
  is_available: boolean;
  brand_slug: string | null;
  model: string;
  year: number | null;
  category_slug: string | null;
  city: string | null;
  company_name: string | null;
  daily_rate: number | null;
  view_count: number | null;
};

export type RentalVehicleDetail = {
  id: string;
  model: string;
  year: number | null;
  daily_rate: number | null;
  weekly_rate: number | null;
  monthly_rate: number | null;
  deposit: number | null;
  min_rental_days: number | null;
  driver_rate: number | null;
  description: string | null;
  is_available: boolean;
  company_id: string | null;
  brand_id: string | null;
  location_id: string | null;
};

export type RentalSpecs = {
  transmission: string | null;
  fuel_type: string | null;
  drive_type: string | null;
  seats: number | null;
  doors: number | null;
  mileage_km: number | null;
};

export const BRAND_LABELS: Record<string, string> = {
  toyota: "Toyota",
  honda: "Honda",
  nissan: "Nissan",
  mercedes: "Mercedes-Benz",
  bmw: "BMW",
  ford: "Ford",
  isuzu: "Isuzu",
  hyundai: "Hyundai",
  kia: "Kia",
  vw: "Volkswagen",
  mitsubishi: "Mitsubishi",
  suzuki: "Suzuki",
  mazda: "Mazda",
  other: "Other",
};

export const CATEGORY_LABELS: Record<string, string> = {
  suv: "SUV",
  sedan: "Sedan",
  pickup: "Pickup",
  minibus: "Minibus",
  luxury: "Luxury",
  bus: "Bus",
  motorbike: "Motorbike",
  other: "Other",
};

export function brandLabel(slug: string | null): string {
  if (!slug) return "";
  return BRAND_LABELS[slug] ?? slug;
}

export function categoryLabel(slug: string | null): string {
  if (!slug) return "";
  return CATEGORY_LABELS[slug] ?? slug;
}

// ── Fleet-owner (business) side types ──────────────────────────────────
// Mirrors www/js/rentals-business.js — table/column names verified against
// supabase/migrations/rental_marketplace_schema.sql and
// rental_marketplace_extensions.sql.

export type RentalAccess = {
  has_business: boolean;
  has_rental_company: boolean;
  company_id: string | null;
  company_status: "pending" | "active" | "suspended" | "rejected" | null;
  can_access_dashboard: boolean;
  can_create_fleet: boolean;
  can_create_vehicle: boolean;
};

export type RentalCompanyRecord = {
  id: string;
  business_id: string;
  status: "pending" | "active" | "suspended" | "rejected";
  avg_rating: number | null;
  review_count: number | null;
  fleet_count: number | null;
  company_name?: string | null;
};

export type RentalFleetVehicle = {
  id: string;
  model: string;
  year: number | null;
  daily_rate: number | null;
  weekly_rate: number | null;
  monthly_rate: number | null;
  deposit: number | null;
  min_rental_days: number | null;
  driver_rate: number | null;
  description: string | null;
  status: "draft" | "active" | "paused" | "archived" | "removed";
  is_available: boolean;
  view_count: number | null;
  save_count: number | null;
  inquiry_count: number | null;
  brand_id: string | null;
  category_id: string | null;
  brand_slug?: string | null;
  brand_label?: string | null;
  cover_url?: string | null;
  transmission?: string | null;
  fuel_type?: string | null;
  drive_type?: string | null;
  seats?: number | null;
  mileage_km?: number | null;
  featured_until?: string | null;
};

export type RentalLead = {
  id: string;
  listing_id: string;
  company_id: string;
  user_id: string | null;
  lead_source: "chat" | "whatsapp_click" | "call_click" | "favorite" | "share" | "view_detail" | "booking_request";
  status: "new" | "contacted" | "converted" | "lost";
  created_at: string;
  user_name?: string | null;
  vehicle_name?: string | null;
  requested_start_date?: string | null;
  requested_end_date?: string | null;
};

export type RentalAvailabilityBlock = {
  id: string;
  listing_id: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
};

export type RentalLookupOption = { slug: string; label: string; id?: string };

export const RENTAL_TRANSMISSIONS = ["automatic", "manual"] as const;
export const RENTAL_FUEL_TYPES = ["petrol", "diesel", "hybrid", "electric", "other"] as const;
export const RENTAL_DRIVE_TYPES = ["4wd", "awd", "fwd", "rwd"] as const;

export function fleetVehicleLabel(v: { brand_label?: string | null; model: string; year?: number | null }): string {
  return [v.brand_label, v.model].filter(Boolean).join(" ").trim() || v.model;
}
