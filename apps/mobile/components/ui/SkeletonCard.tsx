import { StyleSheet, View } from "react-native";

// Mirrors www/js/app.js H.skeletonCards — loading placeholder shaped like a
// listing card (thumb + 3 lines).
export function SkeletonCard() {
  return (
    <View style={styles.row}>
      <View style={styles.thumb} />
      <View style={styles.body}>
        <View style={[styles.line, { width: "70%" }]} />
        <View style={[styles.line, { width: "40%" }]} />
        <View style={[styles.line, { width: "55%" }]} />
      </View>
    </View>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#E4E7EF",
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
  },
  line: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E4E7EF",
  },
});
