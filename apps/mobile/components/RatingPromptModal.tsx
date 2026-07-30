import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { shadow, type ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";
import { openAppRating, shouldShowRatingPrompt, snoozeRatingPrompt } from "../lib/rating-prompt";

const STAR_PATH = "M12 2.5l2.9 6.06 6.6.83-4.86 4.63 1.28 6.55L12 17.35l-5.92 3.22 1.28-6.55L2.5 9.39l6.6-.83L12 2.5z";

function Star({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d={STAR_PATH} />
    </Svg>
  );
}

export function RatingPromptModal() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const [visible, setVisible] = useState(false);
  const storeName = Platform.OS === "ios" ? "App Store" : "Play Store";

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
        <Pressable style={[styles.card, shadow.lg]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, shadow.md]}>
            <Star size={32} color={tones.starOnGold} />
          </View>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={20} color={tones.star} />
            ))}
          </View>
          <Text style={styles.title}>Enjoying PaMarket?</Text>
          <Text style={styles.subtitle}>
            Tell us with a rating. It takes <Text style={styles.bold}>10 seconds</Text> and helps other Zimbabweans
            find the app.
          </Text>
          <Pressable style={styles.rateBtn} onPress={rate}>
            <Star size={16} color={tones.star} />
            <Text style={styles.rateBtnText}>Rate on {storeName}</Text>
          </Pressable>
          <Pressable style={styles.laterBtn} onPress={dismiss}>
            <Text style={styles.laterBtnText}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function buildTones(color: ColorPalette) {
  return {
    star: color.gold,
    starOnGold: color.textOnBrand,
  };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: color.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: color.surface,
      borderRadius: 22,
      padding: 24,
      paddingTop: 28,
      alignItems: "center",
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: color.gold,
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
      color: color.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: color.textSub,
      lineHeight: 21,
      textAlign: "center",
      marginBottom: 22,
    },
    bold: {
      fontWeight: "700",
      color: color.text,
    },
    rateBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      width: "100%",
      paddingVertical: 14,
      backgroundColor: color.brand,
      borderRadius: 14,
      marginBottom: 10,
    },
    rateBtnText: {
      color: color.textOnBrand,
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
      color: color.textSub,
    },
  });
}
