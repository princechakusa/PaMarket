import { supabase } from "./supabase";

// Mirrors www/js/app.js H._setupRealtimeListings/_setupRealtimeBusinesses:
// live-refreshes browse feeds when listings/businesses change server-side,
// instead of requiring a manual pull-to-refresh.
//
// event is scoped to INSERT only, not "*" — listing/[id].tsx calls the
// increment_listing_view RPC on every single detail-page view, which is an
// UPDATE on listings.view_count. With "*", every listing view by ANY user
// anywhere used to broadcast a postgres_changes event to EVERY client with
// the home feed mounted — at real scale that's a constant, high-frequency
// fan-out storm for something the feed doesn't even need to react to (a new
// listing appearing is what actually matters here, not a view counter
// ticking). This is still an unfiltered table-wide subscription (Realtime's
// postgres_changes filter can't express "any active listing"), but scoping
// the event type removes by far the highest-volume source of noise.
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
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings" }, onChange)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "businesses" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
