// Admin-controlled operational switches (Admin → General Settings), read
// from the same app_settings row (id = 1) the website and admin use. Every
// value has a default equal to the app's normal behaviour, so a failed or
// slow fetch never hides features or blocks users — the switches only take
// effect once the real row has been read.
//
// Server-side enforcement lives in the database/edge functions (sign-up
// pause trigger, listing approval trigger, free-mode plan limits, upload
// kill-switch); this module only keeps the UI consistent with them.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { loadCache, saveCache } from "./offlineCache";

export type AppSettings = {
  signupPaused: boolean;
  freeOnly: boolean;
  enablePremiumListings: boolean;
  showSponsoredAds: boolean;
  allowImageUploads: boolean;
  requireListingApproval: boolean;
  autoApproveVerified: boolean;
  requirePhoneVerification: boolean;
  fxRate: number | null;
  fxRateUpdatedAt: string | null;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  signupPaused: false,
  freeOnly: false,
  enablePremiumListings: true,
  showSponsoredAds: true,
  allowImageUploads: true,
  requireListingApproval: false,
  autoApproveVerified: false,
  requirePhoneVerification: false,
  fxRate: null,
  fxRateUpdatedAt: null,
};

const CACHE_KEY = "app-settings-v1";
const REFRESH_MS = 5 * 60 * 1000;

let current: AppSettings = DEFAULT_APP_SETTINGS;
let lastFetchedAt = 0;
let inflight: Promise<AppSettings> | null = null;
const listeners = new Set<(s: AppSettings) => void>();

function bool(raw: Record<string, unknown>, key: keyof AppSettings, fallback: boolean): boolean {
  return typeof raw[key] === "boolean" ? (raw[key] as boolean) : fallback;
}

export function parseAppSettings(raw: Record<string, unknown> | null | undefined): AppSettings {
  const r = raw ?? {};
  const fx = typeof r.fxRate === "number" && r.fxRate > 0 ? r.fxRate : null;
  return {
    signupPaused: bool(r, "signupPaused", DEFAULT_APP_SETTINGS.signupPaused),
    freeOnly: bool(r, "freeOnly", DEFAULT_APP_SETTINGS.freeOnly),
    enablePremiumListings: bool(r, "enablePremiumListings", DEFAULT_APP_SETTINGS.enablePremiumListings),
    showSponsoredAds: bool(r, "showSponsoredAds", DEFAULT_APP_SETTINGS.showSponsoredAds),
    allowImageUploads: bool(r, "allowImageUploads", DEFAULT_APP_SETTINGS.allowImageUploads),
    requireListingApproval: bool(r, "requireListingApproval", DEFAULT_APP_SETTINGS.requireListingApproval),
    autoApproveVerified: bool(r, "autoApproveVerified", DEFAULT_APP_SETTINGS.autoApproveVerified),
    requirePhoneVerification: bool(r, "requirePhoneVerification", DEFAULT_APP_SETTINGS.requirePhoneVerification),
    fxRate: fx,
    fxRateUpdatedAt: typeof r.fxRateUpdatedAt === "string" ? r.fxRateUpdatedAt : null,
  };
}

function publish(next: AppSettings) {
  current = next;
  listeners.forEach((fn) => fn(next));
}

// Last known settings, synchronously (defaults until the first fetch lands).
export function getCachedAppSettings(): AppSettings {
  return current;
}

// Resolves with the freshest settings available; never throws.
export async function getAppSettings(force = false): Promise<AppSettings> {
  if (!force && lastFetchedAt && Date.now() - lastFetchedAt < REFRESH_MS) return current;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      if (!lastFetchedAt) {
        const cached = await loadCache<AppSettings>(CACHE_KEY);
        if (cached) publish({ ...DEFAULT_APP_SETTINGS, ...cached });
      }
      const { data, error } = await supabase.from("app_settings").select("settings").eq("id", 1).maybeSingle();
      if (!error && data?.settings) {
        const parsed = parseAppSettings(data.settings as Record<string, unknown>);
        lastFetchedAt = Date.now();
        publish(parsed);
        saveCache(CACHE_KEY, parsed).catch(() => {});
      }
    } catch {
      // Keep whatever we already have (cache or defaults).
    } finally {
      inflight = null;
    }
    return current;
  })();
  return inflight;
}

export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(current);
  useEffect(() => {
    listeners.add(setSettings);
    getAppSettings().catch(() => {});
    return () => {
      listeners.delete(setSettings);
    };
  }, []);
  return settings;
}

// "Free for everyone" mode hides every paid surface: plans, credits,
// subscriptions, boosts and featured slots.
export function paidFeaturesEnabled(s: AppSettings): boolean {
  return !s.freeOnly;
}

// Boosts & featured slots specifically (Enable premium listings switch).
export function premiumListingsEnabled(s: AppSettings): boolean {
  return !s.freeOnly && s.enablePremiumListings;
}
