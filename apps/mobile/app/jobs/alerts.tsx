import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import { Button, Card, EmptyState, SelectField } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import {
  deleteJobAlert,
  fetchJobTaxonomy,
  fetchMyJobAlerts,
  saveJobAlert,
  updateJobAlert,
  type JobAlert,
  type JobTaxonomyOption,
} from "../../lib/jobs";

const REMOTE_TYPE_OPTIONS: Array<[string, string]> = [
  ["on_site", "On-site"],
  ["hybrid", "Hybrid"],
  ["remote", "Remote"],
];

const ANY = "Any";

function labelFor(options: JobTaxonomyOption[], id: string | null): string {
  return (id && options.find((o) => o.id === id)?.label) || "";
}

function idFor(options: JobTaxonomyOption[], label: string): string | null {
  return options.find((o) => o.label === label)?.id ?? null;
}

export default function JobAlertsScreen() {
  const { session } = useAuth();
  const styles = useThemedStyles(buildStyles);
  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Job Alerts", androidNative: true });

  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [taxonomy, setTaxonomy] = useState<{ jobTypes: JobTaxonomyOption[]; industries: JobTaxonomyOption[] }>({
    jobTypes: [],
    industries: [],
  });

  // Alert form, shared by create and edit. editingId is null while
  // creating a new alert; set to an existing alert's id while editing it,
  // which switches the submit handler to update that row in place instead
  // of inserting a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [jobTypeId, setJobTypeId] = useState<string | null>(null);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [remoteType, setRemoteType] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setKeywords("");
    setJobTypeId(null);
    setIndustryId(null);
    setRemoteType(null);
  }

  function startEdit(alert: JobAlert) {
    setEditingId(alert.id);
    setName(alert.name);
    setKeywords(alert.keywords || "");
    setJobTypeId(alert.job_type_id);
    setIndustryId(alert.industry_id);
    setRemoteType(alert.remote_type);
  }

  const load = useCallback(async () => {
    if (!session?.user) return;
    const rows = await fetchMyJobAlerts();
    setAlerts(rows);
  }, [session?.user]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
    fetchJobTaxonomy().then(setTaxonomy).catch(() => {});
  }, [load]);

  async function submitAlert() {
    const trimmedName = name.trim();
    if (!trimmedName || isSaving) return;
    setIsSaving(true);
    const fields = {
      name: trimmedName,
      keywords: keywords.trim() || null,
      job_type_id: jobTypeId,
      industry_id: industryId,
      remote_type: remoteType,
    };
    const result = editingId ? await updateJobAlert(editingId, fields) : await saveJobAlert(fields);
    setIsSaving(false);
    if (result.ok) {
      resetForm();
      toast(editingId ? "Alert updated" : "Alert saved");
      load();
    } else {
      toast(result.error || "Could not save alert", 3500, true);
    }
  }

  function removeAlert(alert: JobAlert) {
    Alert.alert("Delete this alert?", `"${alert.name}" will stop matching new jobs.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const result = await deleteJobAlert(alert.id);
          if (result.ok) {
            setAlerts((rows) => rows.filter((r) => r.id !== alert.id));
            if (editingId === alert.id) resetForm();
          } else {
            toast(result.error || "Could not delete alert", 3500, true);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          ListHeaderComponent={
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>{editingId ? "Edit alert" : "New alert"}</Text>
              <Text style={styles.sectionHint}>We'll surface new jobs that match your alert.</Text>
              <Text style={styles.sectionTitle}>Alert details</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Alert name (e.g. Remote driver jobs)"
                placeholderTextColor={color.textMuted}
              />
              <TextInput
                style={[styles.input, { marginTop: space.sm }]}
                value={keywords}
                onChangeText={setKeywords}
                placeholder="Keywords (optional)"
                placeholderTextColor={color.textMuted}
              />
              <Text style={styles.sectionTitle}>Filters</Text>
              <Text style={styles.sectionHint}>Leave a filter on "Any" to match all jobs.</Text>
              <View style={styles.fieldGap}>
                <SelectField
                  label="Job type"
                  value={labelFor(taxonomy.jobTypes, jobTypeId)}
                  placeholder="Any job type"
                  options={[ANY, ...taxonomy.jobTypes.map((t) => t.label)]}
                  onSelect={(v) => setJobTypeId(idFor(taxonomy.jobTypes, v))}
                />
              </View>
              <View style={styles.fieldGap}>
                <SelectField
                  label="Industry"
                  value={labelFor(taxonomy.industries, industryId)}
                  placeholder="Any industry"
                  options={[ANY, ...taxonomy.industries.map((t) => t.label)]}
                  onSelect={(v) => setIndustryId(idFor(taxonomy.industries, v))}
                />
              </View>
              <View style={styles.fieldGap}>
                <SelectField
                  label="Work mode"
                  value={REMOTE_TYPE_OPTIONS.find(([k]) => k === remoteType)?.[1] ?? ""}
                  placeholder="Any work mode"
                  options={[ANY, ...REMOTE_TYPE_OPTIONS.map(([, l]) => l)]}
                  onSelect={(v) => setRemoteType(REMOTE_TYPE_OPTIONS.find(([, l]) => l === v)?.[0] ?? null)}
                />
              </View>
              <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={isSaving ? "Saving…" : editingId ? "Save changes" : "Create alert"}
                    onPress={submitAlert}
                    loading={isSaving}
                    disabled={!name.trim()}
                  />
                </View>
                {editingId ? (
                  <Button label="Cancel" variant="secondary" onPress={resetForm} />
                ) : null}
              </View>
            </Card>
          }
          ListEmptyComponent={
            <EmptyState title="No alerts yet" subtitle="Create an alert above to get matching jobs surfaced automatically." />
          }
          renderItem={({ item }) => (
            <Card style={[styles.alertCard, editingId === item.id && styles.alertCardEditing]}>
              <View style={styles.alertRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.alertName}>{item.name}</Text>
                  {item.keywords ? <Text style={styles.alertMeta}>{item.keywords}</Text> : null}
                  <Text style={styles.alertMeta} numberOfLines={1}>
                    {[
                      labelFor(taxonomy.jobTypes, item.job_type_id),
                      labelFor(taxonomy.industries, item.industry_id),
                      REMOTE_TYPE_OPTIONS.find(([k]) => k === item.remote_type)?.[1],
                    ]
                      .filter(Boolean)
                      .join(" · ") || "All jobs"}
                  </Text>
                </View>
                <Pressable onPress={() => startEdit(item)} hitSlop={8}>
                  <Text style={styles.editLink}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => removeAlert(item)} hitSlop={8}>
                  <Text style={styles.deleteLink}>Delete</Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    listContent: { padding: space.lg },
    formCard: { marginBottom: space.md },
    formTitle: { ...font.title, color: color.text, marginBottom: space.sm },
    input: {
      borderWidth: 1.5,
      borderColor: color.border,
      borderRadius: radius.md,
      paddingHorizontal: 13,
      paddingVertical: 12,
      ...font.body,
      color: color.text,
      backgroundColor: color.surface,
    },
    sectionTitle: { ...font.bodyStrong, color: color.text, marginTop: space.lg, marginBottom: space.sm },
    sectionHint: { ...font.caption, color: color.textMuted },
    fieldGap: { marginTop: space.sm },
    alertCard: {},
    alertCardEditing: { borderWidth: 1.5, borderColor: color.brand },
    alertRow: { flexDirection: "row", alignItems: "center", gap: space.md },
    alertName: { ...font.bodyStrong, color: color.text },
    alertMeta: { ...font.caption, color: color.textMuted, marginTop: 2 },
    editLink: { ...font.caption, color: color.brand, fontWeight: "700" },
    deleteLink: { ...font.caption, color: color.danger },
  });
}
