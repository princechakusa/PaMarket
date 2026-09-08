// Reactive cart state, shared app-wide (badge counts, the storefront's Add
// to Cart button, the cart screen) — mirrors the AuthProvider/ThemeProvider
// context pattern already used in this app. Persistence reuses the
// existing "last good snapshot" file cache (lib/offlineCache.ts) rather
// than introducing a new storage dependency; only listingId+quantity (plus
// the shop id/name needed for the single-shop rule) are ever written to
// disk — no customer personal details live in the cart.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clearCache, loadCache, saveCache } from "./offlineCache";
import { useAuth } from "./auth";
import {
  type AddResult,
  type CartItem,
  type CartState,
  addToCart as addToCartPure,
  cartUnitCount,
  emptyCart,
  removeFromCart,
  replaceCartWithItem,
  setItemQuantity,
} from "./cart";

const CART_CACHE_KEY = "shop-cart";

type CartContextValue = {
  cart: CartState;
  isHydrated: boolean;
  lineItemCount: number;
  unitCount: number;
  addItem: (business: { id: string; name: string }, listingId: string, quantity?: number) => AddResult;
  replaceWithItem: (business: { id: string; name: string }, listingId: string, quantity?: number) => void;
  setQuantity: (listingId: string, quantity: number) => void;
  removeItem: (listingId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [cart, setCart] = useState<CartState>(emptyCart());
  const [isHydrated, setIsHydrated] = useState(false);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  // undefined = "no session observed yet" (cold start) — distinct from null
  // ("observed, and it's signed out") so a fresh app launch with an
  // existing session doesn't look like a sign-out and wipe a legitimately
  // persisted cart.
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    loadCache<CartState>(CART_CACHE_KEY)
      .then((stored) => {
        if (stored && Array.isArray(stored.items) && stored.items.length) setCart(stored);
      })
      .finally(() => setIsHydrated(true));
  }, []);

  // Logout, switching accounts, or account deletion (which signs the user
  // out immediately after) must never leave one customer's cart visible to
  // the next person who opens the app on this device.
  useEffect(() => {
    const previous = previousUserIdRef.current;
    if (previous !== undefined && previous !== userId) {
      setCart(emptyCart());
      clearCache(CART_CACHE_KEY).catch(() => {});
    }
    previousUserIdRef.current = userId;
  }, [userId]);

  const persist = useCallback((next: CartState) => {
    setCart(next);
    saveCache(CART_CACHE_KEY, next).catch(() => {});
  }, []);

  const addItem = useCallback(
    (business: { id: string; name: string }, listingId: string, quantity = 1) => {
      const { cart: next, result } = addToCartPure(cartRef.current, business, listingId, quantity);
      if (result === "added" || result === "updated") persist(next);
      return result;
    },
    [persist]
  );

  const replaceWithItem = useCallback(
    (business: { id: string; name: string }, listingId: string, quantity = 1) => {
      persist(replaceCartWithItem(business, listingId, quantity));
    },
    [persist]
  );

  const setQuantity = useCallback(
    (listingId: string, quantity: number) => {
      persist(setItemQuantity(cartRef.current, listingId, quantity));
    },
    [persist]
  );

  const removeItem = useCallback(
    (listingId: string) => {
      persist(removeFromCart(cartRef.current, listingId));
    },
    [persist]
  );

  const clear = useCallback(() => {
    setCart(emptyCart());
    clearCache(CART_CACHE_KEY).catch(() => {});
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isHydrated,
      lineItemCount: cart.items.length,
      unitCount: cartUnitCount(cart),
      addItem,
      replaceWithItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [cart, isHydrated, addItem, replaceWithItem, setQuantity, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export type { CartItem, CartState };
