import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textOnBrand: color.textOnBrand };
}

export default function Index() {
  const tones = useThemedStyles(buildTones);
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tones.brand }}>
        <ActivityIndicator color={tones.textOnBrand} />
      </View>
    );
  }

  return <Redirect href={session ? "/(tabs)" : "/(auth)/sign-in"} />;
}
