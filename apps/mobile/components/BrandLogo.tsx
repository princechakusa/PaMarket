import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Image, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { useThemedStyles } from "../lib/theme-provider";

type BrandSymbolProps = {
  size?: number;
  monochrome?: boolean;
  contained?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BrandSymbol({ size = 48, monochrome = false, contained = false, style }: BrandSymbolProps) {
  const palette = useThemedStyles((color) => color);
  const useCompact = monochrome || size < 48;
  const gold = monochrome ? palette.textOnBrand : palette.gold;

  if (useCompact) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="PaMarket logo">
          {contained ? <Rect width={512} height={512} rx={116} fill={palette.brandDark} /> : null}
          <Path fill={gold} d="M198 86h128c68 0 112 40 112 101 0 63-45 104-115 104h-55v135h-70V86Zm70 64v82h52c31 0 49-15 49-42 0-26-18-40-49-40h-52Z" />
          <Path fill={palette.textOnBrand} d="M82 426V164h66l108 130 108-130h66v262h-69V265L266 378h-22L151 265v161H82Z" />
          {monochrome ? null : <Path d="M158 178 348 426" stroke={gold} strokeWidth={34} strokeLinecap="square" />}
        </Svg>
      </View>
    );
  }

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
