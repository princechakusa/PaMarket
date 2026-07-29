import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Image, Text, View } from "react-native";

import { useThemedStyles } from "../lib/theme-provider";

type BrandSymbolProps = {
  size?: number;
  monochrome?: boolean;
  contained?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BrandSymbol({ size = 48, monochrome = false, contained = false, style }: BrandSymbolProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: contained ? Math.round(size * 0.22) : 0,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Image
        source={require("../assets/brand/pamarket-final-logo-source.png")}
        accessibilityLabel="PaMarket logo"
        resizeMode="contain"
        style={{
          width: size,
          height: size,
          opacity: monochrome ? 0.96 : 1,
        }}
      />
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
