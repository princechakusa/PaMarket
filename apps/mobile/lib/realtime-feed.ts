import { supabase } from "./supabase";

let feedChannelSeq = 0;

// Mirrors www/js/app.js H._setupRealtimeListings/_setupRealtimeBusinesses:
// live-refreshes browse feeds when listings/businesses change server-side,
// instead of requiring a manual pull-to-refresh.
export function subscribeToFeedChanges(onChange: () => void) {
  feedChannelSeq += 1;
  const channel = supabase
    .channel(`feed-live-${feedChannelSeq}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
