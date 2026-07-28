import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useThemedStyles } from "../lib/theme-provider";

type BrandSymbolProps = {
  size?: number;
  monochrome?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BrandSymbol({ size = 48, monochrome = false, style }: BrandSymbolProps) {
  const palette = useThemedStyles((color) => color);
  const topLeft = monochrome ? palette.textOnBrand : palette.brand;
  const topRight = monochrome ? palette.textOnBrand : palette.gold;
  const bottomLeft = monochrome ? palette.textOnBrand : palette.brandDark;
  const bottomRight = monochrome ? palette.textOnBrand : palette.info;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="PaMarket logo">
        <Path fill={topLeft} d="M66 32h124c19 0 34 15 34 34v124l-34 34H66c-19 0-34-15-34-34V66c0-19 15-34 34-34Z" />
        <Path fill={topRight} d="M322 32h124c19 0 34 15 34 34v124c0 19-15 34-34 34H322l-34-34V66c0-19 15-34 34-34Z" />
        <Path fill={bottomLeft} d="M66 288h124l34 34v124c0 19-15 34-34 34H66c-19 0-34-15-34-34V322c0-19 15-34 34-34Z" />
        <Path fill={bottomRight} d="M322 288h124c19 0 34 15 34 34v124c0 19-15 34-34 34H322c-19 0-34-15-34-34V322l34-34Z" />
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

  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="PaMarket"
      style={[
        {
          color: onBrand ? palette.textOnBrand : palette.brand,
          fontSize: size,
          fontWeight: "900",
          letterSpacing: -1,
          lineHeight: Math.round(size * 1.2),
        },
        style,
      ]}
    >
      <Text style={{ color: palette.gold }}>Pa</Text>
      <Text>Market</Text>
    </Text>
  );
}
