import { supabase } from "./supabase";

// Mirrors www/js/app.js H._setupRealtimeListings/_setupRealtimeBusinesses:
// live-refreshes browse feeds when listings/businesses change server-side,
// instead of requiring a manual pull-to-refresh.
export function subscribeToFeedChanges(onChange: () => void) {
  // A fixed topic name ("feed-live") can collide with a channel from a
  // previous mount that's still mid-teardown (removeChannel unsubscribes
  // over the socket, it isn't instant) — supabase.channel() then returns
  // that same already-subscribed instance, and calling .on() on it throws
  // "cannot add postgres_changes callbacks after subscribe()". This shows up
  // reliably under Fast Refresh, which re-runs this effect rapidly. A unique
  // topic per call guarantees a fresh channel every time.
  const channel = supabase
    .channel(`feed-live-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
