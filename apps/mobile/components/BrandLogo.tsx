import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import { useThemedStyles } from "../lib/theme-provider";

type BrandSymbolProps = {
  size?: number;
  monochrome?: boolean;
  contained?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BrandSymbol({ size = 48, monochrome = false, contained = false, style }: BrandSymbolProps) {
  const palette = useThemedStyles((color) => color);
  const gold = monochrome ? palette.textOnBrand : "url(#pmGold)";

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="PaMarket logo">
        <Defs>
          <LinearGradient id="pmGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFE078" />
            <Stop offset="0.58" stopColor={palette.gold} />
            <Stop offset="1" stopColor={palette.goldDark} />
          </LinearGradient>
        </Defs>
        {contained ? <Rect width={512} height={512} rx={116} fill={palette.brandDark} /> : null}
        <SvgText
          x={186}
          y={338}
          textAnchor="middle"
          fontFamily="Georgia, Times New Roman, serif"
          fontSize={252}
          fontWeight="700"
          fill={gold}
        >
          P
        </SvgText>
        <SvgText
          x={324}
          y={338}
          textAnchor="middle"
          fontFamily="Georgia, Times New Roman, serif"
          fontSize={220}
          fontWeight="700"
          fill={palette.textOnBrand}
        >
          M
        </SvgText>
      </Svg>
    </View>
  );
}

type BrandWordmarkProps = {
  size?: number;
  onBrand?: boolean;
  style?: StyleProp<TextStyle>;
};

export function BrandWordmark({ size = 26, onBrand = false, style }: BrandWordmarkProps) {
  const palette = useThemedStyles((color) => color);
  const marketColor = onBrand ? palette.textOnBrand : palette.brand;

  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="PaMarket"
      style={[
        {
          color: marketColor,
          fontSize: size,
          fontWeight: "900",
          letterSpacing: 0,
          lineHeight: Math.round(size * 1.2),
        },
        style,
      ]}
    >
      <Text style={{ color: palette.gold }}>Pa</Text>
      <Text style={{ color: marketColor }}>Market</Text>
    </Text>
  );
}
