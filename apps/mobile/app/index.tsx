import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1A3A8F" }}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return <Redirect href={session ? "/(tabs)" : "/(auth)/sign-in"} />;
}
