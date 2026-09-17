import { useCallback, useState } from "react";
import * as Location from "expo-location";

export type ResolvedLocation = {
  latitude: number;
  longitude: number;
  province?: string;
  city?: string;
  suburb?: string;
};

type State = { loading: boolean; error: string | null };

// Rounds to ~100m precision. Personal listings should only ever persist an
// approximate point — the public listing API selects the raw row, so an
// exact GPS coordinate saved here would be exactly as exposed as the
// website's jittered map display is meant to prevent. Businesses are
// allowed exact coordinates (they're meant to be found) and should NOT use
// this — pass the raw value from resolve() straight through instead.
export function roundApproxCoord(value: number | null): number | null {
  return value == null ? null : Math.round(value * 1000) / 1000;
}

// A single reverse-geocode call to OpenStreetMap's free Nominatim service.
// Shared by useCurrentLocation's GPS flow below and the map-based "drop a
// pin" picker (components/post/MapLocationPicker.tsx) -- one Nominatim
// integration, not two. The result is matched against the taxonomy the
// caller already loaded (provinces/citiesByProvince) so it slots straight
// into the existing Province/City SelectFields instead of introducing a
// second location vocabulary; an unmatched province/city is left blank for
// the user to pick manually rather than guessed.
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  provinces: readonly string[],
  citiesByProvince: Record<string, readonly string[]>,
): Promise<{ province?: string; city?: string; suburb?: string }> {
  try {
    // Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
    // requires requests to identify the calling application — a browser
    // satisfies this with its own Referer header, but React Native's fetch
    // sends neither a Referer nor a distinguishing User-Agent by default, so
    // it's set explicitly here. A hard timeout matters: without one, a
    // slow/hanging Nominatim response would block returning the coordinates
    // we already have, even though reverse geocoding is only a convenience.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
      {
        headers: { "Accept-Language": "en", "User-Agent": "PaMarket/1.0 (https://pamarketzw.com)" },
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timeout));
    const data = await res.json();
    const addr = (data && data.address) || {};
    const rawProvince = String(addr.state || "");
    const rawCity = String(addr.city || addr.town || addr.village || addr.county || "");
    const suburb: string | undefined = addr.suburb || addr.neighbourhood || addr.residential || undefined;

    const province = provinces.find((p) => p.toLowerCase() === rawProvince.toLowerCase());
    const city = province ? (citiesByProvince[province] ?? []).find((c) => c.toLowerCase() === rawCity.toLowerCase()) : undefined;
    return { province, city, suburb };
  } catch {
    // Reverse geocoding is a convenience only — the caller still gets real
    // coordinates and the user can fill province/city by hand.
    return {};
  }
}

// One-shot GPS fix + a reverse-geocode call, then stop — no watcher, no
// polling, no background permission requested.
export function useCurrentLocation(
  provinces: readonly string[],
  citiesByProvince: Record<string, readonly string[]>,
) {
  const [state, setState] = useState<State>({ loading: false, error: null });

  const resolve = useCallback(async (): Promise<ResolvedLocation | null> => {
    setState({ loading: true, error: null });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState({
          loading: false,
          error: "Location permission wasn't granted — you can still set your area manually below.",
        });
        return null;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;

      // This fires at most once per "Use my current location" tap — never
      // polled or repeated.
      const { province, city, suburb } = await reverseGeocode(latitude, longitude, provinces, citiesByProvince);

      setState({ loading: false, error: null });
      return { latitude, longitude, province, city, suburb };
    } catch {
      setState({
        loading: false,
        error: "Couldn't get your location. Check that location services are enabled, or set your area manually.",
      });
      return null;
    }
  }, [provinces, citiesByProvince]);

  return { loading: state.loading, error: state.error, resolve };
}
