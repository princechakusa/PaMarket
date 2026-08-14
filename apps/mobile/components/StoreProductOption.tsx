import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemedStyles } from "../lib/theme-provider";
import type { ColorPalette } from "../lib/theme";

type Props = {
  title: string;
  price?: string;
  description: string;
  buttonLabel: string;
  isLoading: boolean;
  isAvailable: boolean;
  isPurchasing: boolean;
  purchaseBlocked: boolean;
  error?: string;
  recommended?: boolean;
  onPurchase: () => void;
  onRetry: () => void;
};

export function StoreProductOption({
  title,
  price,
  description,
  buttonLabel,
  isLoading,
  isAvailable,
  isPurchasing,
  purchaseBlocked,
  error,
  recommended,
  onPurchase,
  onRetry,
}: Props) {
  const styles = useThemedStyles(buildStyles);
  const hasStorePrice = isAvailable && Boolean(price);
  const disabled = isLoading || !hasStorePrice || purchaseBlocked;

  return (
    <View style={[styles.card, recommended && styles.recommendedCard]}>
      {recommended ? <Text style={styles.tag}>BEST VALUE</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text
        style={[
          styles.price,
          !hasStorePrice && !isLoading && styles.unavailable,
        ]}
      >
        {isLoading
          ? "Loading price…"
          : hasStorePrice && price
          ? price
          : "Unavailable"}
      </Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.disclosure}>One-time purchase.</Text>
      {!isLoading && !hasStorePrice ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>
            {error || "This product is not available from the store."}
          </Text>
          <Pressable onPress={onRetry}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        style={[styles.button, disabled && styles.buttonDisabled]}
        disabled={disabled}
        onPress={onPurchase}
      >
        {isPurchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: color.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: color.border,
      padding: 14,
      gap: 5,
    },
    recommendedCard: {
      borderColor: color.gold,
      backgroundColor: color.goldTint,
    },
    tag: {
      fontSize: 9,
      fontWeight: "800",
      color: color.brand,
      letterSpacing: 0.4,
    },
    title: { fontSize: 14, fontWeight: "800", color: color.text },
    price: {
      fontSize: 18,
      fontWeight: "900",
      color: color.brand,
      marginTop: 2,
    },
    unavailable: { color: color.textMuted },
    description: { fontSize: 12.5, color: color.textSub, lineHeight: 18 },
    disclosure: {
      fontSize: 11.5,
      fontWeight: "700",
      color: color.textMuted,
    },
    errorBlock: { gap: 3, marginTop: 3 },
    errorText: { fontSize: 11, color: color.danger, lineHeight: 15 },
    retry: { fontSize: 12, fontWeight: "800", color: color.brand },
    button: {
      backgroundColor: color.brand,
      minHeight: 42,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 7,
      paddingHorizontal: 12,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: {
      color: color.textOnBrand,
      fontSize: 13,
      fontWeight: "800",
    },
  });
}
