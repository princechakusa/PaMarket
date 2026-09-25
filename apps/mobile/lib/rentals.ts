import { supabase } from "./supabase";

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

// ── Customer availability ───────────────────────────────────────────────
// rental_vehicle_availability is owner-only under RLS, so customers never
// read it directly — a direct read returns [] and makes every day look
// free. rental_vehicle_busy_ranges() (SECURITY DEFINER, see
// 20260924120000_rental_phase0_private_fields_and_availability.sql)
// returns only merged, inclusive date ranges: no reason, note or customer.
// The same RPC re-checks dates server-side when a booking request is
// captured, so these helpers drive the UI, not the final decision.

export type BusyRange = { starts_on: string; ends_on: string };

const DAY_MS = 86400000;
// Zimbabwe is UTC+2 year-round (no DST); the server uses Africa/Harare too.
const HARARE_OFFSET_MS = 2 * 3600000;

/** Today's date in Zimbabwe as YYYY-MM-DD, independent of device timezone. */
export function rentalToday(): string {
  return new Date(Date.now() + HARARE_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds whole days to a YYYY-MM-DD date using UTC math (no DST/timezone drift). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive day count between two YYYY-MM-DD dates. */
export function daysInclusive(startIso: string, endIso: string): number {
  const [ys, ms, ds] = startIso.split("-").map(Number);
  const [ye, me, de] = endIso.split("-").map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / DAY_MS) + 1;
}

export function isDateBusy(iso: string, ranges: BusyRange[]): boolean {
  return ranges.some((r) => iso >= r.starts_on && iso <= r.ends_on);
}

export function rangeOverlapsBusy(startIso: string, endIso: string, ranges: BusyRange[]): boolean {
  return ranges.some((r) => r.starts_on <= endIso && r.ends_on >= startIso);
}

/** First busy day on or after `startIso`, or null — the furthest a return date can go. */
export function nextBusyDateAfter(startIso: string, ranges: BusyRange[]): string | null {
  let next: string | null = null;
  for (const r of ranges) {
    if (r.ends_on < startIso) continue;
    const candidate = r.starts_on > startIso ? r.starts_on : startIso;
    if (next === null || candidate < next) next = candidate;
  }
  return next;
}

export async function fetchBusyRanges(
  listingId: string,
  fromIso: string,
  toIso: string
): Promise<{ ranges: BusyRange[]; error: string | null }> {
  const { data, error } = await supabase.rpc("rental_vehicle_busy_ranges", {
    p_listing_id: listingId,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) return { ranges: [], error: error.message };
  return { ranges: (data as BusyRange[] | null) ?? [], error: null };
}

/** Postgres codes raised by the booking-request guard trigger. */
export const RENTAL_DATES_UNAVAILABLE_CODE = "23P01";
export const RENTAL_DATES_INVALID_CODE = "22023";

// ── Phase 1: bookings ────────────────────────────────────────────────────
// See supabase/migrations/20260924130000_rental_phase1_booking_core.sql.
// Distinct from RentalLead (rental_vehicle_leads stays the analytics/
// inquiry funnel, unaffected by any of this) and from the vehicle's own
// available/unavailable/maintenance/inactive state machine.

export type RentalBookingStatus =
  | "requested"
  | "confirmed"
  | "picked_up"
  | "active"
  | "returned"
  | "completed"
  | "declined"
  | "cancelled";

export const RENTAL_BOOKING_STATUS_LABEL: Record<RentalBookingStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  picked_up: "Picked Up",
  active: "Active",
  returned: "Returned",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

// Matches the Badge component's Tone union (components/ui/Badge.tsx).
export const RENTAL_BOOKING_STATUS_TONE: Record<
  RentalBookingStatus,
  "brand" | "gold" | "success" | "warning" | "danger" | "info" | "neutral"
> = {
  requested: "info",
  confirmed: "brand",
  picked_up: "gold",
  active: "success",
  returned: "warning",
  completed: "success",
  declined: "danger",
  cancelled: "neutral",
};

export type RentalQuote = {
  daily_rate: number;
  rental_days: number;
  rate_subtotal: number;
  driver_fee: number;
  extras_fee: number;
  deposit: number;
  total_amount: number;
  currency: string;
};

/** Server-computed quote — never derive a price to show the customer client-side. */
export async function quoteRentalBooking(opts: {
  listingId: string;
  pickupAt: string; // ISO timestamp
  returnAt: string;
  withDriver?: boolean;
}): Promise<{ quote: RentalQuote | null; error: string | null }> {
  const { data, error } = await supabase.rpc("rental_quote_booking", {
    p_listing_id: opts.listingId,
    p_pickup_at: opts.pickupAt,
    p_return_at: opts.returnAt,
    p_with_driver: opts.withDriver ?? false,
  });
  if (error) return { quote: null, error: error.message };
  const row = (data as RentalQuote[] | null)?.[0] ?? null;
  return { quote: row, error: null };
}

export type RequestRentalBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; code: string | null; message: string };

/**
 * The only way a booking is created. The server derives the customer from
 * auth.uid(), re-verifies the vehicle and availability, computes the quote,
 * and inserts — never trust a client-supplied price or availability check.
 */
export async function requestRentalBooking(opts: {
  listingId: string;
  pickupAt: string;
  returnAt: string;
  fulfillment: "pickup" | "delivery";
  deliveryAddress?: string | null;
  withDriver?: boolean;
  customerNote?: string | null;
  conversationId?: string | null;
}): Promise<RequestRentalBookingResult> {
  const { data, error } = await supabase.rpc("request_rental_booking", {
    p_listing_id: opts.listingId,
    p_pickup_at: opts.pickupAt,
    p_return_at: opts.returnAt,
    p_fulfillment: opts.fulfillment,
    p_delivery_address: opts.deliveryAddress ?? null,
    p_with_driver: opts.withDriver ?? false,
    p_customer_note: opts.customerNote ?? null,
    p_conversation_id: opts.conversationId ?? null,
  });
  if (error) return { ok: false, code: (error as { code?: string }).code ?? null, message: error.message };
  return { ok: true, bookingId: data as string };
}

export type MyRentalBooking = {
  id: string;
  listing_id: string;
  company_id: string;
  status: RentalBookingStatus;
  pickup_at: string;
  return_at: string;
  fulfillment: "pickup" | "delivery";
  with_driver: boolean;
  total_amount: number;
  currency: string;
  conversation_id: string | null;
  created_at: string;
  vehicle_model: string;
  vehicle_year: number | null;
  cover_url: string | null;
  company_name: string;
};

// p_limit/p_offset are optional — omitting them calls the 1-arg RPC overload
// (list_my_rental_bookings(p_status)), which defaults to 50 rows. Pass them
// explicitly only once a screen actually needs to page past that.
export async function listMyRentalBookings(
  status?: RentalBookingStatus | null,
  opts?: { limit?: number; offset?: number }
): Promise<MyRentalBooking[]> {
  const args: Record<string, unknown> = { p_status: status ?? null };
  if (opts?.limit != null) args.p_limit = opts.limit;
  if (opts?.offset != null) args.p_offset = opts.offset;
  const { data, error } = await supabase.rpc("list_my_rental_bookings", args);
  if (error) {
    console.warn("listMyRentalBookings:", error.message);
    return [];
  }
  return (data as MyRentalBooking[] | null) ?? [];
}

export type CompanyRentalBooking = {
  id: string;
  listing_id: string;
  customer_id: string;
  status: RentalBookingStatus;
  pickup_at: string;
  return_at: string;
  fulfillment: "pickup" | "delivery";
  delivery_address: string | null;
  with_driver: boolean;
  rate_subtotal: number;
  driver_fee: number;
  deposit: number;
  total_amount: number;
  currency: string;
  customer_note: string | null;
  conversation_id: string | null;
  decline_reason: string | null;
  cancellation_reason: string | null;
  created_at: string;
  vehicle_model: string;
  customer_name: string;
};

export async function listCompanyRentalBookings(
  companyId: string,
  status?: RentalBookingStatus | null,
  opts?: { limit?: number; offset?: number }
): Promise<CompanyRentalBooking[]> {
  const args: Record<string, unknown> = { p_company_id: companyId, p_status: status ?? null };
  if (opts?.limit != null) args.p_limit = opts.limit;
  if (opts?.offset != null) args.p_offset = opts.offset;
  const { data, error } = await supabase.rpc("list_company_rental_bookings", args);
  if (error) {
    console.warn("listCompanyRentalBookings:", error.message);
    return [];
  }
  return (data as CompanyRentalBooking[] | null) ?? [];
}

async function callBookingTransition(
  fn: string,
  args: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export const acceptRentalBooking = (bookingId: string) =>
  callBookingTransition("accept_rental_booking", { p_booking_id: bookingId });
export const declineRentalBooking = (bookingId: string, reason?: string | null) =>
  callBookingTransition("decline_rental_booking", { p_booking_id: bookingId, p_reason: reason ?? null });
export const cancelRentalBooking = (bookingId: string, reason?: string | null) =>
  callBookingTransition("cancel_rental_booking", { p_booking_id: bookingId, p_reason: reason ?? null });
export const markRentalPickedUp = (bookingId: string) =>
  callBookingTransition("mark_rental_picked_up", { p_booking_id: bookingId });
export const markRentalReturned = (bookingId: string) =>
  callBookingTransition("mark_rental_returned", { p_booking_id: bookingId });
export const completeRentalBooking = (bookingId: string) =>
  callBookingTransition("complete_rental_booking", { p_booking_id: bookingId });
