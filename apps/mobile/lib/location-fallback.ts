// Mirrors detail.html's resolveCoords/TOWN_COORDS/PROVINCE_COORDS exactly —
// a listing with no captured lat/lng still shows a location on the website
// (city center, then province center), so the mobile app must fall back the
// same way instead of hiding the whole Location card. Keep these tables in
// sync with detail.html if either one changes.
const TOWN_COORDS: Record<string, [number, number]> = {
  "harare cbd": [-17.8292, 31.0522],
  harare: [-17.8292, 31.0522],
  borrowdale: [-17.7644, 31.0908],
  highlands: [-17.7889, 31.1103],
  msasa: [-17.8283, 31.1264],
  kambuzuma: [-17.8494, 30.9903],
  "milton park": [-17.8206, 31.0364],
  "the avenues": [-17.8236, 31.0475],
  chitungwiza: [-18.0127, 31.0755],
  norton: [-17.8833, 30.7],
  "mutare cbd": [-18.9707, 32.6709],
  mutare: [-18.9707, 32.6709],
  "bulawayo cbd": [-20.15, 28.5833],
  bellevue: [-20.1667, 28.6167],
  marondera: [-18.1853, 31.5514],
  ruwa: [-17.8908, 31.2436],
  goromonzi: [-17.8, 31.4167],
  seke: [-17.9833, 31.1333],
  chinhoyi: [-17.3667, 30.2],
  karoi: [-16.8167, 29.6833],
  masvingo: [-20.0637, 30.8277],
  gweru: [-19.45, 29.8167],
  plumtree: [-20.4833, 27.8167],
  filabusi: [-20.5333, 29.2833],
  umguza: [-19.7, 28.5],
};

const PROVINCE_COORDS: Record<string, [number, number]> = {
  Harare: [-17.8292, 31.0522],
  Bulawayo: [-20.15, 28.5833],
  Manicaland: [-18.9707, 32.6709],
  "Mashonaland East": [-18.1853, 31.5514],
  "Mashonaland West": [-17.3667, 30.2],
  "Mashonaland Central": [-17.0058, 31.3306],
  Masvingo: [-20.0637, 30.8277],
  "Matabeleland North": [-18.9333, 27.8],
  "Matabeleland South": [-20.9333, 29.0],
  Midlands: [-19.45, 29.8167],
};

export type ResolvedListingCoords = { latitude: number; longitude: number; exact: boolean };

export function resolveListingCoords(listing: {
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  province?: string | null;
}): ResolvedListingCoords | null {
  if (listing.latitude != null && listing.longitude != null) {
    return { latitude: listing.latitude, longitude: listing.longitude, exact: true };
  }
  const cityKey = (listing.city || "").trim().toLowerCase();
  const townMatch = TOWN_COORDS[cityKey];
  if (townMatch) return { latitude: townMatch[0], longitude: townMatch[1], exact: false };
  const provinceMatch = listing.province ? PROVINCE_COORDS[listing.province] : undefined;
  if (provinceMatch) return { latitude: provinceMatch[0], longitude: provinceMatch[1], exact: false };
  return null;
}
