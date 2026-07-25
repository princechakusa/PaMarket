import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

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
        <Text style={styles.brand}>
          Pa<Text style={styles.brandAccent}>Market</Text>
        </Text>
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
        <TextInput
          style={styles.searchInput}
          placeholder="Search cars, houses, jobs..."
          placeholderTextColor={color.textMuted}
          value={searchValue}
          onChangeText={onChangeSearch}
          onSubmitEditing={onSubmitSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
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
      fontWeight: "900",
      color: color.textOnBrand,
      letterSpacing: -1,
    },
    brandAccent: {
      color: color.gold,
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
    searchInput: {
      flex: 1,
      paddingVertical: space.md,
      ...font.body,
      color: color.text,
    },
  });
}
