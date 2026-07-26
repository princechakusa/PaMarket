import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { toast } from "../../components/ui/Toast";
import type { Business } from "../../lib/businesses";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Staff seats per plan — mirrors www/js/business-profile.js STAFF_LIMIT.
// Full plan entitlements (H.planEntitlements) are out of scope here since
// paid plans/billing are deferred; free-plan businesses simply see 0 seats.
const STAFF_LIMIT: Record<string, number> = { free: 0, starter: 2, pro: 10, premium: Infinity };

type StaffRow = {
  id: string;
  business_id: string;
  user_id: string;
  role: string;
  status: string;
  name?: string | null;
};

export default function BusinessStaffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const [business, setBusiness] = useState<Business | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [contact, setContact] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [bizRes, staffRes] = await Promise.all([
      supabase.from("businesses").select("id,owner_user_id,name,status").eq("id", id).maybeSingle(),
      supabase.from("business_staff").select("id,business_id,user_id,role,status").eq("business_id", id).limit(50),
    ]);
    if (bizRes.data) setBusiness(bizRes.data as Business);
    const rows = (staffRes.data ?? []) as StaffRow[];
    const withNames = await Promise.all(
      rows.map(async (r) => {
        const { data: profile } = await supabase.from("profiles_public").select("name,phone").eq("id", r.user_id).maybeSingle();
        return { ...r, name: profile?.name ?? profile?.phone ?? "User" };
      })
    );
    setStaff(withNames.filter((s) => s.status !== "removed"));
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const isOwner = session?.user?.id === business?.owner_user_id;
  const limit = STAFF_LIMIT["free"] ?? 0; // plan_id not yet tracked on businesses table in mobile schema
  const full = staff.length >= limit;

  async function invite() {
    if (!id || !business) return;
    if (full) { toast("Seat limit reached for your plan"); return; }
    const q = contact.trim();
    if (!q) { toast("Enter a phone or email"); return; }
    setIsInviting(true);
    const { data: found } = await supabase
      .from("profiles_public")
      .select("id,name,phone,email")
      .or(`phone.eq.${q},email.eq.${q}`)
      .limit(1)
      .maybeSingle();
    setIsInviting(false);
    if (!found) { toast("No PaMarket user found with that phone/email"); return; }
    if (found.id === business.owner_user_id) { toast("You are the owner"); return; }
    if (staff.some((s) => s.user_id === found.id)) { toast("Already invited"); return; }

    const { error } = await supabase.from("business_staff").insert({
      business_id: id,
      user_id: found.id,
      role: "staff",
      status: "invited",
      invited_by: session?.user?.id,
    });
    if (error) { toast("Could not send invite", 4000, true); return; }
    toast("Invite sent");
    setContact("");
    load();
  }

  async function toggleRole(row: StaffRow) {
    const nextRole = row.role === "manager" ? "staff" : "manager";
    const { error } = await supabase.from("business_staff").update({ role: nextRole }).eq("id", row.id);
    if (error) { toast("Could not update role", 4000, true); return; }
    load();
  }

  async function removeStaff(row: StaffRow) {
    const { error } = await supabase.from("business_staff").delete().eq("id", row.id);
    if (error) { toast("Could not remove staff", 4000, true); return; }
    toast("Staff removed");
    load();
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>Business not found</Text>
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundTitle}>Owner only</Text>
        <Text style={styles.notFoundSub}>Only the business owner can manage staff.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.seatsRow}>
        <Text style={styles.seatsLabel}>Seats used</Text>
        <Text style={styles.seatsValue}>
          {staff.length} / {limit === Infinity ? "Unlimited" : limit} <Text style={styles.seatsPlan}>· Free</Text>
        </Text>
      </View>

      {limit === 0 ? (
        <View style={styles.upgradeNotice}>
          <Text style={styles.upgradeNoticeText}>Your current plan doesn't include staff seats. Upgrade to add team members.</Text>
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Invite by phone or email</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={[styles.input, styles.inviteInput]}
              value={contact}
              onChangeText={setContact}
              placeholder="0771234567 or name@email.com"
              placeholderTextColor={tones.textMuted}
              editable={!full}
            />
            <Pressable style={[styles.inviteButton, full && styles.inviteButtonDisabled]} onPress={invite} disabled={full || isInviting}>
              {isInviting ? <ActivityIndicator color={tones.textOnBrand} /> : <Text style={styles.inviteButtonText}>Invite</Text>}
            </Pressable>
          </View>
          {full ? <Text style={styles.limitWarning}>Seat limit reached — upgrade your plan for more.</Text> : null}
        </View>
      )}

      {staff.length ? (
        staff.map((s) => (
          <View key={s.id} style={styles.staffRow}>
            <View style={styles.staffAvatar}>
              <Text style={styles.staffAvatarText}>{(s.name ?? "U").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.staffName}>{s.name}</Text>
              <View style={styles.staffMetaRow}>
                <View style={[styles.statusPill, s.status === "active" ? styles.statusPillActive : styles.statusPillInvited]}>
                  <Text style={s.status === "active" ? styles.statusPillActiveText : styles.statusPillInvitedText}>
                    {s.status === "active" ? "Active" : "Invited"}
                  </Text>
                </View>
                <Text style={styles.staffRole}>{s.role}</Text>
              </View>
            </View>
            <Pressable style={styles.roleButton} onPress={() => toggleRole(s)}>
              <Text style={styles.roleButtonText}>{s.role === "manager" ? "Make staff" : "Make manager"}</Text>
            </Pressable>
            <Pressable style={styles.removeButton} onPress={() => removeStaff(s)}>
              <Text style={styles.removeButtonText}>Remove</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No staff yet.</Text>
      )}
    </ScrollView>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand, textMuted: color.textMuted, textOnBrand: color.textOnBrand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.surface },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    notFoundTitle: { fontSize: 16, fontWeight: "700", color: color.text, marginBottom: 8, textAlign: "center" },
    notFoundSub: { fontSize: 13, color: color.textMuted, textAlign: "center" },
    scrollContent: { padding: 16, paddingBottom: 40 },
    seatsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: color.brandTint, borderRadius: 12, padding: 14, marginBottom: 16 },
    seatsLabel: { fontSize: 13, color: color.textMuted },
    seatsValue: { fontSize: 14, fontWeight: "800", color: color.brand },
    seatsPlan: { fontWeight: "600", color: color.textMuted },
    upgradeNotice: { backgroundColor: color.goldTint, borderRadius: 14, padding: 16 },
    upgradeNoticeText: { fontSize: 13, color: color.textMuted, lineHeight: 19 },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 13, fontWeight: "700", color: color.text, marginBottom: 8 },
    inviteRow: { flexDirection: "row", gap: 8 },
    input: { borderWidth: 1, borderColor: color.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: color.text },
    inviteInput: { flex: 1 },
    inviteButton: { backgroundColor: color.brand, borderRadius: 10, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
    inviteButtonDisabled: { opacity: 0.5 },
    inviteButtonText: { color: color.textOnBrand, fontSize: 14, fontWeight: "700" },
    limitWarning: { fontSize: 11.5, color: color.warning, marginTop: 5 },
    staffRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color.border, flexWrap: "wrap" },
    staffAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: color.brandTint, alignItems: "center", justifyContent: "center" },
    staffAvatarText: { fontWeight: "800", color: color.brand },
    staffName: { fontSize: 14, fontWeight: "700", color: color.text },
    staffMetaRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 3 },
    statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    statusPillActive: { backgroundColor: color.successTint },
    statusPillActiveText: { fontSize: 10, fontWeight: "800", color: color.success },
    statusPillInvited: { backgroundColor: color.warningTint },
    statusPillInvitedText: { fontSize: 10, fontWeight: "800", color: color.warning },
    staffRole: { fontSize: 11, color: color.textMuted, textTransform: "capitalize" },
    roleButton: { backgroundColor: color.brandTint, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
    roleButtonText: { color: color.brand, fontSize: 11.5, fontWeight: "700" },
    removeButton: { backgroundColor: color.dangerTint, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
    removeButtonText: { color: color.danger, fontSize: 11.5, fontWeight: "700" },
    emptyText: { textAlign: "center", color: color.textMuted, fontSize: 13, paddingVertical: 24 },
  });
}
