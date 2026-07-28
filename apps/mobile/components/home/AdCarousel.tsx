import { useEffect, useRef, useState } from "react";
import { Dimensions, Image, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { PaidAd } from "../../lib/ads";
import { trackAdClick, trackAdImpression } from "../../lib/ads";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDE_WIDTH = SCREEN_WIDTH - 32;

export function AdCarousel({ ads, title = "Featured Partners" }: { ads: PaidAd[]; title?: string }) {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const trackedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    ads.forEach((a) => {
      if (!trackedRef.current.has(a.id)) {
        trackedRef.current.add(a.id);
        trackAdImpression(a.id);
      }
    });
  }, [ads]);

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % ads.length;
        scrollRef.current?.scrollTo({ x: next * SLIDE_WIDTH, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (!ads.length) return null;

  function onPress(ad: PaidAd) {
    trackAdClick(ad.id);
    if (ad.listingId) router.push(`/listing/${ad.listingId}`);
    else if (ad.linkUrl) Linking.openURL(ad.linkUrl).catch(() => {});
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.spon}>Sponsored</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH));
        }}
      >
        {ads.map((ad) => (
          <View key={ad.id} style={[styles.slide, { width: SLIDE_WIDTH, backgroundColor: ad.bgColor }]}>
            {ad.imageUrl ? (
              <>
                <Image source={{ uri: ad.imageUrl }} style={StyleSheet.absoluteFill} />
                <View style={styles.scrim} />
              </>
            ) : null}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>AD</Text>
            </View>
            <View style={styles.pressArea} onTouchEnd={() => onPress(ad)}>
              <Text style={styles.kick}>{ad.businessName}</Text>
              <Text style={styles.headline}>{ad.headline}</Text>
              {ad.tagline ? <Text style={styles.cta}>{ad.tagline} →</Text> : null}
            </View>
          </View>
        ))}
      </ScrollView>
      {ads.length > 1 ? (
        <View style={styles.dots}>
          {ads.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  wrap: { marginTop: space.lg, marginBottom: space.xl },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
  },
  spon: {
    ...font.micro,
    color: color.textMuted,
    textTransform: "uppercase",
  },
  title: {
    ...font.caption,
    color: color.text,
    fontWeight: "700",
  },
  slide: {
    height: 140,
    marginLeft: space.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  badge: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: radius.sm,
    paddingHorizontal: space.xs,
    paddingVertical: 2,
  },
  badgeText: {
    ...font.micro,
    color: color.text,
  },
  pressArea: {
    padding: space.md,
  },
  kick: {
    ...font.caption,
    color: color.textOnBrandSub,
    fontWeight: "700",
  },
  headline: {
    ...font.title,
    color: color.textOnBrand,
    marginTop: 2,
  },
  cta: {
    ...font.caption,
    color: color.textOnBrand,
    fontWeight: "700",
    marginTop: space.sm,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.xs,
    marginTop: space.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.borderStrong,
  },
  dotOn: {
    backgroundColor: color.brand,
    width: 16,
  },
  });
}
