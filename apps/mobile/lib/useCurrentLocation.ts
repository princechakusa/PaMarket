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

// One-shot GPS fix + a single reverse-geocode call to OpenStreetMap's free
// Nominatim service, then stop — no watcher, no polling, no background
// permission requested. The result is matched against the taxonomy the
// caller already loaded (provinces/citiesByProvince) so it slots straight
// into the existing Province/City SelectFields instead of introducing a
// second location vocabulary; an unmatched province/city is left blank for
// the user to pick manually rather than guessed.
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

      let province: string | undefined;
      let city: string | undefined;
      let suburb: string | undefined;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
          { headers: { "Accept-Language": "en" } },
        );
        const data = await res.json();
        const addr = (data && data.address) || {};
        const rawProvince = String(addr.state || "");
        const rawCity = String(addr.city || addr.town || addr.village || addr.county || "");
        suburb = addr.suburb || addr.neighbourhood || addr.residential || undefined;

        province = provinces.find((p) => p.toLowerCase() === rawProvince.toLowerCase());
        if (province) {
          const cities = citiesByProvince[province] ?? [];
          city = cities.find((c) => c.toLowerCase() === rawCity.toLowerCase());
        }
      } catch {
        // Reverse geocoding is a convenience only — the caller still gets
        // real coordinates and the user can fill province/city by hand.
      }

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
