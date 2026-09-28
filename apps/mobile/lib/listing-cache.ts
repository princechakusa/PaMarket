// In-memory "last seen" copy of listings, so opening an ad from any feed is
// instant: every card/row that renders a listing primes this cache, and the
// listing page starts from it while it refreshes the full record in the
// background. Bounded so a long scroll session can't grow it forever.
import type { Listing } from "./listings";

const MAX = 400;
const cache = new Map<string, Listing>();

export function primeListing(listing: Listing | null | undefined) {
  if (!listing?.id) return;
  const existing = cache.get(listing.id);
  // Never replace a fuller record (from the detail page) with a card's
  // partial one.
  cache.set(listing.id, existing ? { ...listing, ...existing, ...pickDefined(listing) } : listing);
  if (cache.size > MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export function getCachedListing(id: string | null | undefined): Listing | null {
  return id ? cache.get(id) ?? null : null;
}

function pickDefined(l: Listing): Partial<Listing> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(l)) if (v !== undefined && v !== null) out[k] = v;
  return out as Partial<Listing>;
}
