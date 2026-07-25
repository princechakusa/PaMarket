import { ScrollView, StyleSheet, View } from "react-native";
import { ListingCard } from "../ListingCard";
import type { Listing } from "../../lib/listings";
import { space } from "../../lib/theme";
import { SectionHeader } from "../ui";

const CARD_WIDTH = 160;

export function CategoryRail({
  title,
  subtitle,
  listings,
  savedIds,
  verifiedSellerIds,
  onSeeAll,
  onPressListing,
  onToggleSave,
}: {
  title: string;
  subtitle?: string;
  listings: Listing[];
  savedIds: Set<string>;
  verifiedSellerIds?: Set<string>;
  onSeeAll: () => void;
  onPressListing: (listing: Listing) => void;
  onToggleSave: (listing: Listing) => void;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} actionLabel="See all" onAction={onSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            width={CARD_WIDTH}
            saved={savedIds.has(listing.id)}
            onToggleSave={() => onToggleSave(listing)}
            verified={verifiedSellerIds?.has(listing.seller_id)}
            onPress={() => onPressListing(listing)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: space.xl,
  },
  rail: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
});
