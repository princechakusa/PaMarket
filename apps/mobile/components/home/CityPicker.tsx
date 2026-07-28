import { Pressable, StyleSheet, Text, View } from "react-native";
import { ZW_CITIES } from "../../lib/constants";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Matches www/css/styles.css .city-picker: an inline expanding panel directly
// under the header (not a modal overlay), 2-column grid, solid-blue selected
// pill.
export function CityPicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(buildStyles);
  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Select your city</Text>
      <View style={styles.grid}>
        {ZW_CITIES.map((city) => (
          <Pressable
            key={city}
            style={[styles.option, city === selected && styles.optionSelected]}
            onPress={() => {
              onSelect(city);
              onClose();
            }}
          >
            <Text style={[styles.optionText, city === selected && styles.optionTextSelected]}>{city}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    panel: {
      backgroundColor: color.surface,
      marginHorizontal: 12,
      borderRadius: 14,
      padding: 14,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    title: {
      fontSize: 10,
      fontWeight: "700",
      color: color.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    option: {
      width: "48.5%",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: color.surfaceAlt,
      borderWidth: 1.5,
      borderColor: "transparent",
      alignItems: "center",
    },
    optionSelected: {
      backgroundColor: color.brand,
      borderColor: color.brand,
    },
    optionText: {
      fontSize: 13,
      fontWeight: "500",
      color: color.textSub,
    },
    optionTextSelected: {
      color: color.textOnBrand,
      fontWeight: "700",
    },
  });
}
