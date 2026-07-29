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
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tones.brand }}>
        <ActivityIndicator color={tones.textOnBrand} />
      </View>
    );
  }

  // Guests can browse Home/Search freely — individual screens/actions
  // (posting, messaging, saving, etc.) each gate themselves and push to
  // sign-in only when actually needed. Always redirecting to sign-in
  // whenever there was no session was the actual bug: the app should never
  // force a login just to open it.
  return <Redirect href="/(tabs)" />;
}
