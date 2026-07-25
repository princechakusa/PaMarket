import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";

export default function LoginCallback() {
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
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1A3A8F" }}>
      <ActivityIndicator color="#ffffff" />
    </View>
  );
}
