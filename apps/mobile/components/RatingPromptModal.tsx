import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { BRAND_BLUE, BRAND_GOLD } from "../lib/constants";
import { openAppRating, shouldShowRatingPrompt, snoozeRatingPrompt } from "../lib/rating-prompt";

const STAR_PATH = "M12 2.5l2.9 6.06 6.6.83-4.86 4.63 1.28 6.55L12 17.35l-5.92 3.22 1.28-6.55L2.5 9.39l6.6-.83L12 2.5z";

function Star({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={BRAND_GOLD}>
      <Path d={STAR_PATH} />
    </Svg>
  );
}

// Mirrors www/js/app.js H._showRatingPrompt/maybeShowRatingPrompt.
export function RatingPromptModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      shouldShowRatingPrompt().then((show) => {
        if (show) setVisible(true);
      });
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  async function dismiss() {
    await snoozeRatingPrompt();
    setVisible(false);
  }

  async function rate() {
    setVisible(false);
    await openAppRating();
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Star size={30} />
          </View>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={20} />
            ))}
          </View>
          <Text style={styles.title}>Enjoying PaMarket?</Text>
          <Text style={styles.subtitle}>
            Tell us with a rating — it takes <Text style={styles.bold}>10 seconds</Text> and helps other Zimbabweans
            find the app.
          </Text>
          <Pressable style={styles.rateBtn} onPress={rate}>
            <Star size={16} />
            <Text style={styles.rateBtnText}>Rate on Play Store</Text>
          </Pressable>
          <Pressable style={styles.laterBtn} onPress={dismiss}>
            <Text style={styles.laterBtnText}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 24,
    paddingTop: 28,
    alignItems: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#FFF7E6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  starsRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#5A6480",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 22,
  },
  bold: {
    fontWeight: "700",
    color: "#111827",
  },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    backgroundColor: BRAND_BLUE,
    borderRadius: 14,
    marginBottom: 10,
  },
  rateBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  laterBtn: {
    width: "100%",
    paddingVertical: 11,
    alignItems: "center",
  },
  laterBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#5A6480",
  },
});
