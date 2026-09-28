// "Similar items sell for $X–$Y" — real asking prices of recent comparable
// ads (price_guide RPC). Used on the post screen (helps sellers price
// right) and the listing page (helps buyers judge a price). Renders nothing
// when there aren't enough comparable ads or the RPC isn't deployed yet.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { formatMoney } from "../lib/listings";
import { font, radius, space, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

type Guide = { count: number; low: number; median: number; high: number; scope: string };

const cache = new Map<string, Guide | null>();

export function PriceGuide({
  category,
  title,
  city,
  mode,
}: {
  category: string | null | undefined;
  title?: string | null;
  city?: string | null;
  mode: "seller" | "buyer";
}) {
  const styles = useThemedStyles(buildStyles);
  const [guide, setGuide] = useState<Guide | null>(null);
  const keywords = (title ?? "").trim().split(/\s+/).slice(0, 3).join(" ");
  const key = `${category}|${keywords.toLowerCase()}|${(city ?? "").toLowerCase()}`;

  useEffect(() => {
    if (!category || category === "jobs") {
      setGuide(null);
      return;
    }
    if (cache.has(key)) {
      setGuide(cache.get(key) ?? null);
      return;
    }
    let cancelled = false;
    // Debounced so typing a title doesn't fire a query per keystroke.
    const t = setTimeout(() => {
      supabase
        .rpc("price_guide", { p_category: category, p_keywords: keywords || null, p_city: city || null })
        .then(({ data, error }) => {
          const value = !error && data && Number((data as Guide).count) >= 5 ? (data as Guide) : null;
          cache.set(key, value);
          if (!cancelled) setGuide(value);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key, category, keywords, city]);

  if (!guide) return null;
  const range = guide.low === guide.high ? formatMoney(guide.median, "USD") : `${formatMoney(guide.low, "USD")} – ${formatMoney(guide.high, "USD")}`;
  const where = guide.scope.endsWith("city") && city ? ` in ${city}` : "";
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{mode === "seller" ? "PRICE GUIDE" : "TYPICAL PRICE"}</Text>
      <Text style={styles.range}>{range}</Text>
      <Text style={styles.sub}>
        {mode === "seller" ? "Similar ads" : "Most similar ads"}
        {where} are priced in this range (based on {guide.count} ads in the last 6 months).
      </Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    box: { backgroundColor: color.surfaceAlt, borderRadius: radius.md, padding: space.md, marginTop: space.md },
    label: { ...font.micro, color: color.textMuted },
    range: { ...font.title, color: color.text, marginTop: 2 },
    sub: { ...font.caption, color: color.textSub, marginTop: 2 },
  });
}
