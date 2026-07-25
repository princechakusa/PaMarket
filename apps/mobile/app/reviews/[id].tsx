import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polygon, Polyline } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import { StarRow } from "../../components/StarRow";

type Review = {
  reviewer_id: string;
  reviewer_name: string | null;
  rating: number;
  text: string | null;
  created_at: string;
};

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4}>
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.starPickerRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Svg width={32} height={32} viewBox="0 0 24 24">
            <Polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              fill={n <= value ? "#f59e0b" : "none"}
              stroke={n <= value ? "#f59e0b" : "#8A93A6"}
              strokeWidth={2}
            />
          </Svg>
        </Pressable>
      ))}
    </View>
  );
}

function timeAgo(dateString: string): string {
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [sellerName, setSellerName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwn = session?.user?.id === id;
  const alreadyReviewed = reviews.some((r) => r.reviewer_id === session?.user?.id);

  const load = useCallback(async () => {
    if (!id) return;
    const [reviewsRes, profileRes] = await Promise.all([
      supabase
        .from("reviews")
        .select("reviewer_id,reviewer_name,rating,text,created_at")
        .eq("seller_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("profiles_public").select("name").eq("id", id).maybeSingle(),
    ]);
    setReviews((reviewsRes.data as Review[]) ?? []);
    setSellerName((profileRes.data as { name: string } | null)?.name ?? "");
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const avg = reviews.length ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length : 0;
  const distribution = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => Math.round(r.rating || 0) === n).length,
  }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  async function submitReview() {
    if (!session?.user || !id) return;
    if (!draftRating) {
      Alert.alert("Please select a star rating");
      return;
    }
    setIsSubmitting(true);
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", session.user.id).maybeSingle();
    const { error } = await supabase.from("reviews").upsert(
      {
        seller_id: id,
        reviewer_id: session.user.id,
        reviewer_name: profile?.name ?? "User",
        rating: draftRating,
        text: draftText || "",
        created_at: new Date().toISOString(),
      },
      { onConflict: "seller_id,reviewer_id" }
    );
    setIsSubmitting(false);
    if (error) {
      Alert.alert("Could not submit review", error.message);
      return;
    }
    setReviewModalVisible(false);
    setDraftRating(0);
    setDraftText("");
    load();
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isOwn ? "My Reviews" : `${sellerName || "Seller"}'s Reviews`}
        </Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.avgBlock}>
            <Text style={styles.avgValue}>{reviews.length ? avg.toFixed(1) : "–"}</Text>
            <StarRow rating={avg} size={16} />
            <Text style={styles.avgCount}>
              {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.distColumn}>
            {distribution.map((d) => (
              <View key={d.n} style={styles.distRow}>
                <Text style={styles.distLabel}>{d.n}</Text>
                <View style={styles.distTrack}>
                  <View style={[styles.distFill, { width: `${(d.count / maxCount) * 100}%` }]} />
                </View>
                <Text style={styles.distCount}>{d.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {!isOwn && session?.user && !alreadyReviewed ? (
          <Pressable style={styles.leaveReviewButton} onPress={() => setReviewModalVisible(true)}>
            <Text style={styles.leaveReviewButtonText}>Leave a Review</Text>
          </Pressable>
        ) : null}
        {!isOwn && session?.user && alreadyReviewed ? (
          <Text style={styles.alreadyReviewedText}>You have already reviewed this seller</Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {reviews.length ? (
          reviews.map((r, i) => (
            <View key={i} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <View>
                  <Text style={styles.reviewerName}>{r.reviewer_name || "Anonymous"}</Text>
                  <StarRow rating={r.rating} size={13} />
                </View>
                <Text style={styles.reviewTime}>{timeAgo(r.created_at)}</Text>
              </View>
              {r.text ? <Text style={styles.reviewText}>{r.text}</Text> : null}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>Reviews from buyers will appear here after transactions</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={reviewModalVisible} transparent animationType="slide" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave a Review</Text>
            <Text style={styles.modalSubtitle}>Tap to rate your experience</Text>
            <StarPicker value={draftRating} onChange={setDraftRating} />
            <TextInput
              style={styles.modalTextArea}
              placeholder="Share your experience with this seller…"
              placeholderTextColor="#8A93A6"
              multiline
              value={draftText}
              onChangeText={setDraftText}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelButton} onPress={() => setReviewModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitButton} onPress={submitReview} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit Review</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F9",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    padding: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
  },
  avgBlock: {
    alignItems: "center",
  },
  avgValue: {
    fontSize: 44,
    fontWeight: "900",
    color: "#111827",
    lineHeight: 48,
  },
  avgCount: {
    fontSize: 12,
    color: "#8A93A6",
    marginTop: 4,
  },
  distColumn: {
    flex: 1,
    gap: 4,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distLabel: {
    fontSize: 11,
    color: "#8A93A6",
    width: 8,
  },
  distTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#E4E7EF",
    borderRadius: 3,
    overflow: "hidden",
  },
  distFill: {
    height: "100%",
    backgroundColor: "#f59e0b",
    borderRadius: 3,
  },
  distCount: {
    fontSize: 11,
    color: "#8A93A6",
    width: 16,
    textAlign: "right",
  },
  leaveReviewButton: {
    marginTop: 16,
    backgroundColor: BRAND_BLUE,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  leaveReviewButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  alreadyReviewedText: {
    textAlign: "center",
    fontSize: 13,
    color: "#8A93A6",
    marginTop: 14,
  },
  listContent: {
    padding: 14,
    paddingBottom: 40,
  },
  reviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  reviewTime: {
    fontSize: 12,
    color: "#8A93A6",
  },
  reviewText: {
    fontSize: 13,
    color: "#3A4258",
    lineHeight: 19,
    marginTop: 8,
  },
  emptyState: {
    alignItems: "center",
    padding: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#8A93A6",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#8A93A6",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  starPickerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#111827",
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8DCE5",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: BRAND_BLUE,
    alignItems: "center",
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
