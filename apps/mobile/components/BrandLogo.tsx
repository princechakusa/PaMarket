import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Text, View } from "react-native";
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
  const canopy = monochrome ? palette.textOnBrand : palette.gold;
  const hands = palette.textOnBrand;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="PaMarket logo">
        {contained ? <Rect width={512} height={512} rx={116} fill="#06266F" /> : null}
        <Path
          fill={canopy}
          d="M108 188C129 111 187 72 256 72s127 39 148 116c4 14-5 28-19 31-31 7-58-7-72-33-10 32-31 49-57 49s-47-17-57-49c-14 26-41 40-72 33-14-3-23-17-19-31Z"
        />
        <Path
          fill={hands}
          d="M83 229c0-24 8-39 22-39 16 0 20 18 20 44 0 35 15 68 41 91 9 8 16 13 21 16 10 7 14 0 7-9l-38-51c-9-13-7-29 6-36 11-6 23-2 35 10l61 61c20 20 30 45 30 74v63c0 11-9 20-20 18-56-9-102-35-136-78-32-41-49-95-49-164Z"
        />
        <Path
          fill={hands}
          d="M429 229c0-24-8-39-22-39-16 0-20 18-20 44 0 35-15 68-41 91-9 8-16 13-21 16-10 7-14 0-7-9l38-51c9-13 7-29-6-36-11-6-23-2-35 10l-61 61c-20 20-30 45-30 74v63c0 11 9 20 20 18 56-9 102-35 136-78 32-41 49-95 49-164Z"
        />
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
