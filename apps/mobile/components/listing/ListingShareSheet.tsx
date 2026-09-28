// "Share" for a listing: a 9:16 image card sized for WhatsApp Status /
// Instagram Stories (photo, price, location, link), plus a plain link share.
// Sellers sharing their own ads to WhatsApp Status is how listings travel in
// Zimbabwe — every share advertises PaMarket too.
import { useRef, useState } from "react";
import { Image, Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Svg, { Path } from "react-native-svg";
import { BrandWordmark } from "../BrandLogo";
import { Button, toast } from "../ui";
import { formatPrice, listingLocation, type Listing } from "../../lib/listings";
import { listingUrl } from "../../lib/site-urls";
import { shareViewAsImage } from "../../lib/share-image";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type ShareableListing = Pick<Listing, "id" | "title" | "price" | "currency" | "suburb" | "city" | "province" | "photos">;

const CARD_W = 270;
const CARD_H = 480;
const BRAND = "#1A3A8F";
const GOLD = "#F5B700";

export function ListingShareSheet({
  listing,
  visible,
  onClose,
  isOwner,
}: {
  listing: ShareableListing;
  visible: boolean;
  onClose: () => void;
  isOwner: boolean;
}) {
  const styles = useThemedStyles(buildStyles);
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const link = listingUrl(listing);
  const price = formatPrice(listing);
  const photo = listing.photos?.[0] ?? null;
  const shortLink = link.replace(/^https?:\/\//, "");
  const message = `${listing.title} — ${price}\n${listingLocation(listing)}\n\nSee it on PaMarket: ${link}`;

  async function shareImage() {
    setBusy(true);
    // WhatsApp Status can't carry a caption from another app, so the link
    // goes on the clipboard, ready to paste.
    await Clipboard.setStringAsync(link).catch(() => {});
    const result = await shareViewAsImage(cardRef, message, "Share to WhatsApp Status");
    setBusy(false);
    if (result === "image") toast("Link copied. Paste it as your status caption so buyers can tap through.", 5000);
  }

  async function shareLink() {
    try {
      await Share.share({ message, url: link, title: listing.title });
    } catch {
      // cancelled
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close share options" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {/* On shorter phones the sheet covers the whole screen, leaving no
            backdrop to tap — so it always gets its own close button. */}
        <Pressable
          style={styles.close}
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close share options"
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color.textSub} strokeWidth={2.4} strokeLinecap="round">
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </Pressable>
        <Text style={styles.title}>{isOwner ? "Promote your ad for free" : "Share this listing"}</Text>
        <Text style={styles.sub}>
          {isOwner
            ? "Post this card to your WhatsApp Status. Friends and family see it for 24 hours, and every tap brings buyers to your ad."
            : "Know someone who needs this? Share it to WhatsApp or your status."}
        </Text>

        {/* The captured card uses fixed brand colours (not the theme) so it
            looks the same in everyone's status, light or dark mode. */}
        <View style={styles.previewWrap}>
          <View ref={cardRef} collapsable={false} style={cardStyles.card}>
            <View style={cardStyles.top}>
              <BrandWordmark size={20} onBrand />
              <Text style={cardStyles.tag}>ZIMBABWE&apos;S MARKETPLACE</Text>
            </View>
            <View style={cardStyles.photoBox}>
              {photo ? (
                <Image source={{ uri: photo }} style={cardStyles.photo} resizeMode="cover" />
              ) : (
                <View style={[cardStyles.photo, cardStyles.photoEmpty]}>
                  <Text style={cardStyles.photoEmptyText}>PaMarket</Text>
                </View>
              )}
              <View style={cardStyles.priceTag}>
                <Text style={cardStyles.priceText}>{price}</Text>
              </View>
            </View>
            <View style={cardStyles.body}>
              <Text style={cardStyles.itemTitle} numberOfLines={2}>
                {listing.title}
              </Text>
              <Text style={cardStyles.location} numberOfLines={1}>
                {listingLocation(listing)}
              </Text>
            </View>
            <View style={cardStyles.footer}>
              <Text style={cardStyles.cta}>Tap the link to see it</Text>
              <Text style={cardStyles.link} numberOfLines={1}>
                {shortLink}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Share image to WhatsApp Status" onPress={() => void shareImage()} loading={busy} />
          <Button label="Share link" variant="secondary" onPress={() => void shareLink()} />
        </View>
      </View>
    </Modal>
  );
}

const cardStyles = StyleSheet.create({
  card: { width: CARD_W, height: CARD_H, backgroundColor: BRAND, borderRadius: 18, overflow: "hidden", padding: 14 },
  top: { alignItems: "center", gap: 4, marginBottom: 10 },
  tag: { color: "rgba(255,255,255,0.75)", fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  photoBox: { flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#0F2566" },
  photo: { width: "100%", height: "100%" },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  photoEmptyText: { color: "rgba(255,255,255,0.4)", fontSize: 22, fontWeight: "900" },
  priceTag: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  priceText: { color: "#0B1B4A", fontSize: 18, fontWeight: "900" },
  body: { paddingTop: 10 },
  itemTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", lineHeight: 20 },
  location: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600", marginTop: 3 },
  footer: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  cta: { color: GOLD, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  link: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", marginTop: 2 },
});

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.55)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: color.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: space.xl,
      paddingBottom: space.xxxl,
    },
    close: {
      position: "absolute",
      top: space.md,
      right: space.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.bg,
      zIndex: 2,
    },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: color.borderStrong, marginBottom: space.md },
    title: { ...font.h3, color: color.text, textAlign: "center" },
    sub: { ...font.sub, color: color.textSub, textAlign: "center", marginTop: space.xs },
    previewWrap: { alignItems: "center", marginVertical: space.lg },
    actions: { gap: space.sm },
  });
}
