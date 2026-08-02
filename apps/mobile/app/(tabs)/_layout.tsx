import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { BottomNav } from "../../components/BottomNav";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      {/* Post is the one tab with a real back affordance (it's a multi-step
          wizard that can also be pushed with a businessId param from
          outside the tab bar) — headerShown here is iOS-only, same as every
          other screen's native-header conversion; see post.tsx for why
          headerLeft stays custom instead of the default native back button. */}
      <Tabs.Screen name="post" options={{ title: "Post", headerShown: Platform.OS === "ios" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Account" }} />
    </Tabs>
  );
}
