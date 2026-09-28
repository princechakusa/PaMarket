// "Meet safely in <city>" — admin-managed busy public places
// (safe_meeting_spots) for buyers on a listing page, each opening in Maps.
// Renders nothing when the city has no spots or the table isn't there yet.
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

type Spot = { id: string; name: string; area: string | null; note: string | null };

const cache = new Map<string, Spot[]>();

function mapsUrl(spot: Spot, city: string): string {
  const q = encodeURIComponent(`${spot.name}, ${spot.area ? spot.area + ", " : ""}${city}, Zimbabwe`);
  return Platform.OS === "ios" ? `http://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function SafeMeetingSpots({ city }: { city: string | null | undefined }) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles((c: ColorPalette) => ({ brand: c.brand, success: c.success }));
  const key = (city ?? "").trim().toLowerCase();
  const [spots, setSpots] = useState<Spot[]>(key ? cache.get(key) ?? [] : []);

  useEffect(() => {
    if (!key || cache.has(key)) {
      if (key) setSpots(cache.get(key) ?? []);
      return;
    }
    let cancelled = false;
    supabase
      .from("safe_meeting_spots")
      .select("id,name,area,note")
      .ilike("city", key)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(4)
      .then(({ data, error }) => {
        const rows = error ? [] : ((data as Spot[]) ?? []);
        cache.set(key, rows);
        if (!cancelled) setSpots(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!spots.length || !city) return null;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tones.success} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <Path d="M9 12l2 2 4-4" />
        </Svg>
        <Text style={styles.title}>Meet safely in {city}</Text>
      </View>
      <Text style={styles.sub}>Busy public places buyers and sellers use. Go in daylight and bring someone if you can.</Text>
      {spots.map((s) => (
        <Pressable key={s.id} style={styles.row} onPress={() => void Linking.openURL(mapsUrl(s, city))} accessibilityRole="link">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={tones.brand} strokeWidth={2}>
            <Path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
            <Circle cx={12} cy={10} r={3} />
          </Svg>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{s.name}{s.area ? ` · ${s.area}` : ""}</Text>
            {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
          </View>
          <Text style={styles.link}>Map</Text>
        </Pressable>
      ))}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, marginTop: space.lg, borderWidth: 1, borderColor: color.border },
    header: { flexDirection: "row", alignItems: "center", gap: space.sm },
    title: { ...font.title, color: color.text },
    sub: { ...font.sub, color: color.textSub, marginTop: space.xs, marginBottom: space.sm },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingVertical: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: color.border,
    },
    name: { ...font.bodyStrong, color: color.text },
    note: { ...font.caption, color: color.textSub, marginTop: 1 },
    link: { ...font.caption, color: color.brand },
  });
}
