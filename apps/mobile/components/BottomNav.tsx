import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";
import { useAuth } from "../lib/auth";
import { glass, type ColorPalette } from "../lib/theme";
import { useThemePreference, useThemedStyles } from "../lib/theme-provider";

// Mirrors the legacy web app's navTo() guard: tapping Post or Messages while
// signed out never renders those screens at all — it goes straight to
// sign-in with a contextual message instead.
const GATED_TAB_MESSAGES: Record<string, string> = {
  post: "Log in to post an ad",
  messages: "Sign in to view messages",
};

type Route = BottomTabBarProps["state"]["routes"][number];

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2="16.65" y2="16.65" />
    </Svg>
  );
}

function MessagesIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  );
}

const ICONS: Record<string, (props: { color: string }) => React.ReactElement> = {
  index: HomeIcon,
  search: SearchIcon,
  messages: MessagesIcon,
  profile: ProfileIcon,
};

const LABELS: Record<string, string> = {
  index: "Home",
  search: "Search",
  messages: "Messages",
  profile: "Account",
};

export function BottomNav({ state, navigation, insets }: BottomTabBarProps) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { resolvedScheme } = useThemePreference();
  const { session } = useAuth();
  const router = useRouter();
  const routes = state.routes.filter((r: Route) => r.name !== "post");
  const postRoute = state.routes.find((r: Route) => r.name === "post");
  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2);

  function goToTab(routeName: string) {
    const message = GATED_TAB_MESSAGES[routeName];
    if (message && !session?.user) {
      router.push({ pathname: "/(auth)/sign-in", params: { message } });
      return;
    }
    navigation.navigate(routeName);
  }

  function renderTab(route: Route) {
    const isFocused = state.index === state.routes.findIndex((r: Route) => r.key === route.key);
    const Icon = ICONS[route.name];
    const label = LABELS[route.name] ?? route.name;
    const color = isFocused ? tones.active : tones.inactive;

    return (
      <Pressable
        key={route.key}
        style={styles.tabButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) goToTab(route.name);
        }}
      >
        {isFocused ? <View style={styles.activeIndicator} /> : null}
        {Icon ? <Icon color={color} /> : null}
        <Text style={[styles.tabLabel, { color }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { height: 64 + insets.bottom, paddingBottom: insets.bottom }]}>
      <BlurView
        intensity={glass.intensity.standard}
        tint={resolvedScheme === "dark" ? "dark" : "light"}
        experimentalBlurMethod={Platform.OS === "android" ? glass.androidBlurMethod : undefined}
        style={StyleSheet.absoluteFill}
      />
      {leftRoutes.map(renderTab)}

      <View style={styles.fabWrap}>
        <Pressable
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            if (postRoute) goToTab(postRoute.name);
          }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tones.active} strokeWidth={2.5}>
            <Line x1={12} y1={5} x2={12} y2={19} />
            <Line x1={5} y1={12} x2={19} y2={12} />
          </Svg>
        </Pressable>
        <Text style={styles.fabLabel}>Post</Text>
      </View>

      {rightRoutes.map(renderTab)}
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return {
    active: color.brand,
    inactive: color.textMuted,
  };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      height: 64,
      backgroundColor: color.glassOverlay,
      borderTopWidth: StyleSheet.hairlineWidth * 1.5,
      borderTopColor: color.glassBorder,
      overflow: "hidden",
    },
    tabButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    activeIndicator: {
      position: "absolute",
      top: 0,
      width: 20,
      height: 2.5,
      backgroundColor: color.brand,
      borderRadius: 3,
    },
    tabLabel: {
      fontSize: 10,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.2,
    },
    fabWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    fab: {
      position: "absolute",
      top: -22,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: color.gold,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabLabel: {
      fontSize: 9,
      fontWeight: "700",
      color: color.goldDark,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginTop: 28,
    },
  });
}
