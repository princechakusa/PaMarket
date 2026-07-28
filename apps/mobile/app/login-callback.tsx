import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textOnBrand: color.textOnBrand };
}

export default function LoginCallback() {
  const tones = useThemedStyles(buildTones);
  const params = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    if (params.code) {
      supabase.auth.exchangeCodeForSession(params.code).catch(() => {});
    }
  }, [params.code]);

  if (!params.code) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tones.brand }}>
      <ActivityIndicator color={tones.textOnBrand} />
    </View>
  );
}
