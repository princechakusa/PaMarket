import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { BrandWordmark } from "../BrandLogo";

function BellIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={color.textOnBrand} strokeWidth={2}>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function MessageIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={color.textOnBrand} strokeWidth={2}>
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function PinIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={color.textOnBrandSub} strokeWidth={2.5}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={color.textOnBrandSub} strokeWidth={2.5}>
      <Polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={color.textMuted} strokeWidth={2.5}>
      <Circle cx={11} cy={11} r={8} />
      <Path d="m21 21-4.35-4.35" />
    </Svg>
  );
}

function BriefcaseIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={color.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 7h18v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <Path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Path d="M3 13h18" />
    </Svg>
  );
}

function CarIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={color.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM3 17V11l2-5h10l3 5h3v6" />
      <Path d="M5 11h14" />
    </Svg>
  );
}

function HouseIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={color.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11.5 12 4l9 7.5" />
      <Path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </Svg>
  );
}

function SofaIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={color.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3H4v-3Z" />
      <Path d="M4 16v3M20 16v3M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
    </Svg>
  );
}

function WrenchIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={color.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2Z" />
    </Svg>
  );
}

function SparkleIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={color.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </Svg>
  );
}

const SEARCH_PHRASES: { Icon: () => React.ReactElement; keyword: string }[] = [
  { Icon: BriefcaseIcon, keyword: "jobs" },
  { Icon: CarIcon, keyword: "cars" },
  { Icon: HouseIcon, keyword: "houses" },
  { Icon: SofaIcon, keyword: "furniture" },
  { Icon: WrenchIcon, keyword: "services" },
  { Icon: SparkleIcon, keyword: "anything" },
];

// Only shown while the search field is empty — mirrors normal placeholder
// behavior (disappears the moment there's real text), it just cycles
// through a few phrases instead of being static. Uses the plain Animated
// API (no reanimated dependency) since this is a simple fade+slide loop.
function AnimatedSearchPlaceholder({ visible }: { visible: boolean }) {
  const styles = useThemedStyles(buildStyles);
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    function cycle() {
      opacity.setValue(0);
      translateY.setValue(6);
      Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }).start();
      Animated.timing(translateY, { toValue: 0, duration: 380, useNativeDriver: true }).start();
      timer = setTimeout(() => {
        if (!mounted) return;
        Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => {
          if (!mounted) return;
          setIndex((i) => (i + 1) % SEARCH_PHRASES.length);
          timer = setTimeout(cycle, 20);
        });
        Animated.timing(translateY, { toValue: -6, duration: 320, useNativeDriver: true }).start();
      }, 1700);
    }
    cycle();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [visible]);

  if (!visible) return null;
  const { Icon, keyword } = SEARCH_PHRASES[index];
  return (
    <Animated.View style={[styles.animatedPlaceholder, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      <Icon />
      <Text style={styles.animatedPlaceholderText} numberOfLines={1}>
        Search for <Text style={styles.animatedPlaceholderKeyword}>{keyword}</Text>…
      </Text>
    </Animated.View>
  );
}

function Badge({ count }: { count: number }) {
  const styles = useThemedStyles(buildStyles);
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

export function HomeHeader({
  cityFilter,
  unreadNotifs,
  unreadMessages,
  searchValue,
  onChangeSearch,
  onSubmitSearch,
  onPressNotifications,
  onPressMessages,
  onPressCity,
}: {
  cityFilter: string;
  unreadNotifs: number;
  unreadMessages: number;
  searchValue: string;
  onChangeSearch: (text: string) => void;
  onSubmitSearch: () => void;
  onPressNotifications: () => void;
  onPressMessages: () => void;
  onPressCity: () => void;
}) {
  const styles = useThemedStyles(buildStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topRow}>
        <BrandWordmark onBrand style={styles.brand} />
        <View style={styles.iconRow}>
          <Pressable style={styles.iconButton} onPress={onPressNotifications} hitSlop={8}>
            <BellIcon />
            <Badge count={unreadNotifs} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onPressMessages} hitSlop={8}>
            <MessageIcon />
            <Badge count={unreadMessages} />
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.cityRow} onPress={onPressCity} hitSlop={8}>
        <PinIcon />
        <Text style={styles.cityText}>{cityFilter}</Text>
        <ChevronDownIcon />
      </Pressable>

      <View style={styles.searchBar}>
        <SearchIcon />
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            value={searchValue}
            onChangeText={onChangeSearch}
            onSubmitEditing={onSubmitSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <AnimatedSearchPlaceholder visible={!searchValue} />
        </View>
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      backgroundColor: color.brand,
      paddingBottom: space.lg,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: space.lg,
      paddingTop: space.md,
    },
    brand: {
      ...font.h1,
    },
    iconRow: {
      flexDirection: "row",
      gap: space.sm,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: color.gold,
      borderRadius: radius.sm,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: "900",
      color: color.brand,
    },
    cityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      paddingBottom: space.sm,
    },
    cityText: {
      ...font.sub,
      color: color.textOnBrand,
      fontWeight: "600",
    },
    searchBar: {
      marginHorizontal: space.lg,
      backgroundColor: color.surface,
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: space.md,
      gap: space.sm,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    searchInputWrap: {
      flex: 1,
      justifyContent: "center",
    },
    searchInput: {
      paddingVertical: space.md,
      ...font.body,
      color: color.text,
    },
    animatedPlaceholder: {
      position: "absolute",
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    animatedPlaceholderText: {
      ...font.body,
      color: color.textMuted,
    },
    animatedPlaceholderKeyword: {
      color: color.brand,
      fontWeight: "700",
    },
  });
}
