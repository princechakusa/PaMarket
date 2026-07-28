import { View } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

function Star({ filled, size, color }: { filled: boolean; size: number; color: { star: string; empty: string } }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill={filled ? color.star : "none"}
        stroke={filled ? color.star : color.empty}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

export function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  const tones = useThemedStyles(buildTones);
  const filled = Math.round(rating || 0);
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= filled} size={size} color={tones} />
      ))}
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return {
    star: color.star,
    empty: color.border,
  };
}
