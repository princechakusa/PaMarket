import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { BRAND_BLUE } from "../../lib/constants";
import type { Business } from "../../lib/businesses";
import { formatPrice, type Listing } from "../../lib/listings";
import { planEntitlements } from "../../lib/plan-entitlements";
import { toast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";

const LISTING_COLUMNS =
  "id,seller_id,seller_name,title,description,price,currency,category,province,city,suburb,photos,status,views,business_id,created_at";

const STATUS_STYLES: Record<string, { fg: string; bg: string; label: string }> = {
  draft: { fg: "#475569", bg: "#E2E8F0", label: "Draft" },
  pending: { fg: "#92400E", bg: "#FEF3C7", label: "Pending" },
  active: { fg: "#166534", bg: "#DCFCE7", label: "Active" },
  sold: { fg: "#1E3A8A", bg: "#DBEAFE", label: "Sold" },
  archived: { fg: "#6B7280", bg: "#F3F4F6", label: "Archived" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

// Mirrors www/js/business-listings.js pages.BusinessListings — the owner's
// product catalog management panel (status control, plan listing limit,
// import-from-personal-marketplace, create-new via the Post flow).
export default function BusinessListingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [limit, setLimit] = useState(3);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [bizRes, listingsRes] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", id).maybeSingle(),
      supabase.from("listings").select(LISTING_COLUMNS).eq("business_id", id).order("created_at", { ascending: false }),
    ]);
    if (bizRes.data) {
      const biz = bizRes.data as Business;
      setBusiness(biz);
      setLimit(planEntitlements((biz as any).plan_id).listingLimit);
    }
    setListings((listingsRes.data as Listing[]) ?? []);
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const isOwner = session?.user?.id === business?.owner_user_id;
  const atLimit = limit >= 0 && listings.length >= limit;
  const limitLabel = limit < 0 ? "∞" : String(limit);

  async function setStatus(listingId: string, status: string) {
    await supabase.from("listings").update({ status }).eq("id", listingId);
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status } : l)));
  }

  async function unassign(listingId: string) {
    await supabase.from("listings").update({ business_id: null }).eq("id", listingId);
    setListings((prev) => prev.filter((l) => l.id !== listingId));
    toast("Removed from business");
  }

  function confirmUnassign(listingId: string) {
    Alert.alert("Remove listing", "Remove this listing from your business? It stays in your personal listings.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => unassign(listingId) },
    ]);
  }

  function addProduct() {
    if (atLimit) {
      toast("Listing limit reached for your plan", 3000, true);
      return;
    }
    if (!id) return;
    router.push({ pathname: "/business-listings/add/[id]", params: { id } });
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND_BLUE} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Business not found" />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <EmptyState title="Owner only" subtitle="Only the owner manages listings." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.usageBar}>
        <Text style={styles.usageLabel}>Listings used</Text>
        <Text style={styles.usageValue}>
          {listings.length} / {limitLabel}
        </Text>
      </View>

      <Pressable style={[styles.addButton, atLimit && styles.buttonDisabled]} onPress={addProduct}>
        <Text style={styles.addButtonText}>+ Add Product</Text>
      </Pressable>
      {atLimit ? <Text style={styles.limitWarning}>Listing limit reached. Upgrade your plan for more.</Text> : null}

      {listings.length ? (
        listings.map((l) => (
          <View key={l.id} style={styles.card}>
            <Pressable
              style={styles.cardTop}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: l.id } })}
            >
              <View style={styles.thumbWrap}>
                {l.photos?.[0] ? <Image source={{ uri: l.photos[0] }} style={styles.thumb} /> : <View style={styles.thumb} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {l.title || "Untitled"}
                </Text>
                <View style={styles.metaRow}>
                  <StatusPill status={l.status} />
                  <Text style={styles.price}>{formatPrice(l)}</Text>
                </View>
                <Text style={styles.viewsText}>{l.views ?? 0} views</Text>
              </View>
            </Pressable>
            <View style={styles.actionsRow}>
              {l.status === "active" ? (
                <Pressable style={styles.actionButton} onPress={() => setStatus(l.id, "sold")}>
                  <Text style={styles.actionButtonText}>Mark sold</Text>
                </Pressable>
              ) : null}
              {l.status !== "archived" ? (
                <Pressable style={styles.actionButton} onPress={() => setStatus(l.id, "archived")}>
                  <Text style={styles.actionButtonText}>Archive</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.actionButton} onPress={() => setStatus(l.id, "active")}>
                  <Text style={styles.actionButtonText}>Reactivate</Text>
                </Pressable>
              )}
              <Pressable style={styles.removeButton} onPress={() => confirmUnassign(l.id)}>
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No products in this store yet. Tap Add Product to get started.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  usageBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EEF2FB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  usageLabel: { fontSize: 13, color: "#5A6478" },
  usageValue: { fontSize: 14, fontWeight: "800", color: BRAND_BLUE },
  addButton: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  addButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  limitWarning: { fontSize: 11.5, color: "#B45309", marginBottom: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", gap: 12 },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#EEF2FB",
  },
  thumb: { width: "100%", height: "100%" },
  title: { fontSize: 14, fontWeight: "700", color: "#111827" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  pill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: "800" },
  price: { fontSize: 12, fontWeight: "700", color: BRAND_BLUE },
  viewsText: { fontSize: 11, color: "#8A93A6", marginTop: 4 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    alignItems: "center",
  },
  actionButtonText: { fontSize: 12, fontWeight: "700", color: "#111827" },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF1F0",
    alignItems: "center",
  },
  removeButtonText: { fontSize: 12, fontWeight: "700", color: "#EF4444" },
  emptyText: { textAlign: "center", color: "#8A93A6", fontSize: 13, paddingVertical: 24 },
});
