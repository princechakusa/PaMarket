import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORIES } from "../../lib/constants";

const CAT_ICONS: Record<string, ReturnType<typeof require>> = {
  property: require("../../assets/cats/cat_property.png"),
  vehicles: require("../../assets/cats/cat_vehicles.png"),
  rooms: require("../../assets/cats/cat_rooms.png"),
  electronics: require("../../assets/cats/cat_electronics.png"),
  jobs: require("../../assets/cats/cat_jobs.png"),
  furniture: require("../../assets/cats/cat_furniture.png"),
  fashion: require("../../assets/cats/cat_fashion.png"),
  services: require("../../assets/cats/cat_services.png"),
  agriculture: require("../../assets/cats/cat_agriculture.png"),
  pets: require("../../assets/cats/cat_pets.png"),
  kids: require("../../assets/cats/cat_kids.png"),
  other: require("../../assets/cats/cat_other.png"),
};

export function CategoryPicker({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <View>
      <Text style={styles.label}>What are you posting?</Text>
      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.id} style={styles.item} onPress={() => onSelect(c.id)}>
            <Image source={CAT_ICONS[c.id]} style={styles.icon} />
            <Text style={styles.itemLabel} numberOfLines={2}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  item: {
    width: "32%",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#E4E7EF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  icon: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
});
