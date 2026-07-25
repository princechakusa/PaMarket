import { Pressable, StyleSheet, Text, View } from "react-native";
import { ZW_CITIES, BRAND_BLUE } from "../../lib/constants";

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

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#ffffff",
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
    color: "#8A93A6",
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
    backgroundColor: "#F5F6F9",
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
  },
  optionSelected: {
    backgroundColor: BRAND_BLUE,
    borderColor: BRAND_BLUE,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3A4258",
  },
  optionTextSelected: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
