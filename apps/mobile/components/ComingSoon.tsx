import { StyleSheet, Text, View } from "react-native";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

export function ComingSoon({ label }: { label: string }) {
  const styles = useThemedStyles(buildStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color.bg,
      gap: 6,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: color.text,
    },
    subtitle: {
      fontSize: 14,
      color: color.textSub,
    },
  });
}
