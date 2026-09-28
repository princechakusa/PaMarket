// Approximate centre points for Zimbabwe's main towns, used to place ads on
// the search map when the seller didn't drop a pin (most don't). Positions
// are town-level only and get a small per-listing spread so pins in the
// same town don't stack; the map labels them as approximate.
const CITY_COORDS: Record<string, [number, number]> = {
  harare: [-17.8292, 31.0522],
  chitungwiza: [-18.0127, 31.0756],
  epworth: [-17.89, 31.1475],
  norton: [-17.8833, 30.7],
  ruwa: [-17.8897, 31.2447],
  bulawayo: [-20.1325, 28.6265],
  mutare: [-18.9707, 32.6709],
  gweru: [-19.4514, 29.8167],
  kwekwe: [-18.9281, 29.8149],
  kadoma: [-18.3333, 29.9153],
  masvingo: [-20.0744, 30.8328],
  chinhoyi: [-17.3667, 30.2],
  marondera: [-18.1853, 31.5519],
  bindura: [-17.3019, 31.3306],
  beitbridge: [-22.2167, 30],
  "victoria falls": [-17.9243, 25.8572],
  hwange: [-18.3645, 26.4988],
  kariba: [-16.5167, 28.8],
  zvishavane: [-20.3333, 30.0333],
  chegutu: [-18.1302, 30.1407],
  rusape: [-18.5278, 32.1284],
  chiredzi: [-21.05, 31.6667],
  karoi: [-16.8167, 29.6833],
  gwanda: [-20.9333, 29],
  filabusi: [-20.5333, 29.2833],
  shurugwi: [-19.6667, 30],
  redcliff: [-19.0333, 29.7833],
  plumtree: [-20.4833, 27.8167],
  chipinge: [-20.1883, 32.6236],
  mazowe: [-17.5, 30.9667],
  banket: [-17.3833, 30.4],
  gokwe: [-18.2167, 28.9333],
  lupane: [-18.9315, 27.807],
};

// Harare suburbs people type as their "city".
const HARARE_AREAS = [
  "mbare", "glen norah", "belvedere", "avondale", "borrowdale", "highfield", "budiriro", "kuwadzana",
  "warren park", "mabvuku", "tafara", "glen view", "dzivarasekwa", "hatfield", "waterfalls", "mount pleasant",
  "greendale", "msasa", "eastlea", "cbd", "harare cbd", "westgate", "marlborough", "mabelreign", "kambuzuma",
];

function hashUnit(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000 - 0.5;
}

export function approximateCoords(
  listingId: string,
  city: string | null | undefined,
  province?: string | null
): [number, number] | null {
  const key = (city ?? "").toLowerCase().trim();
  let base: [number, number] | null = null;
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (key === name || key.includes(name)) {
      base = coords;
      break;
    }
  }
  if (!base && HARARE_AREAS.some((a) => key.includes(a))) base = CITY_COORDS.harare;
  if (!base && (province ?? "").toLowerCase().includes("harare")) base = CITY_COORDS.harare;
  if (!base && (province ?? "").toLowerCase().includes("bulawayo")) base = CITY_COORDS.bulawayo;
  if (!base) return null;
  // ~±3km spread, stable per listing.
  return [base[0] + hashUnit(listingId, 1) * 0.055, base[1] + hashUnit(listingId, 2) * 0.055];
}
