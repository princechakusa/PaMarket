// Fetches the live listing rows for whatever is currently in the cart, and
// resolves each into a display-ready line (or "unavailable" when the
// listing has since been deleted, paused, un-opted-out of ordering, or
// moved to a different shop). Shared by the cart screen and the checkout
// screen so both show identical data and neither re-implements the same
// fetch — the server re-validates everything again at order time
// regardless of what this hook shows.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useCart } from "./cart-context";
import { isListingOrderable } from "./cart";
import type { Listing } from "./listings";
import type { ResolvedCartLine } from "../components/cart/CartLineItem";

const FETCH_TIMEOUT_MS = 12000;
const CART_COLUMNS = "id,title,photos,price,currency,status,is_orderable,business_id";

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

export function useResolvedCart() {
  const { cart, isHydrated } = useCart();
  const [lines, setLines] = useState<ResolvedCartLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cart.items.length) {
      setLines([]);
      return;
    }
    setError(null);
    try {
      const ids = cart.items.map((i) => i.listingId);
      const { data, error: fetchError } = await withTimeout(
        supabase.from("listings").select(CART_COLUMNS).in("id", ids),
        FETCH_TIMEOUT_MS
      );
      if (fetchError) throw fetchError;
      const byId = new Map((data as Listing[]).map((l) => [l.id, l]));
      const resolved: ResolvedCartLine[] = cart.items.map((item) => {
        const listing = byId.get(item.listingId);
        const available = !!listing && isListingOrderable(listing) && listing.business_id === cart.businessId;
        return {
          listingId: item.listingId,
          quantity: item.quantity,
          title: listing?.title ?? null,
          photo: listing?.photos?.[0] ?? null,
          price: listing?.price ?? null,
          currency: listing?.currency ?? null,
          available,
        };
      });
      setLines(resolved);
    } catch (e) {
      setError((e as Error)?.message === "timeout" ? "This is taking longer than expected." : "Couldn't load your cart. Please try again.");
    }
  }, [cart.items, cart.businessId]);

  useEffect(() => {
    if (!isHydrated) return;
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [isHydrated, load]);

  const hasUnavailable = lines.some((l) => !l.available);
  const estimatedTotal = lines.reduce((sum, l) => sum + (l.available && l.price != null ? l.price * l.quantity : 0), 0);
  const currency = lines.find((l) => l.available)?.currency ?? "USD";

  return { lines, isLoading, error, reload: load, hasUnavailable, estimatedTotal, currency };
}
