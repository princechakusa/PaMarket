import { View } from "react-native";
import Svg, { Polygon } from "react-native-svg";

export function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  const filled = Math.round(rating || 0);
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Svg key={n} width={size} height={size} viewBox="0 0 24 24">
          <Polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            fill={n <= filled ? "#F5A623" : "none"}
            stroke={n <= filled ? "#F5A623" : "#D8DCE5"}
            strokeWidth={1.5}
          />
        </Svg>
      ))}
    </View>
  );
}
