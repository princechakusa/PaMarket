import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import {
  clearAllNotifs,
  dayLabel,
  deleteNotif,
  fetchNotifications,
  markAllNotifsRead,
  markNotifRead,
  notifDotColor,
  resolveNotifRoute,
  subscribeToNotifications,
  type NotificationRow,
} from "../lib/notifications";
import { toast } from "../components/ui/Toast";
import { EmptyState } from "../components/ui/EmptyState";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Mirrors www/js/notifications.js pages.Notifications — grouped-by-day list
// with mark-read/delete/clear-all and realtime updates.
export default function NotificationsScreen() {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const { session } = useAuth();
  const router = useRouter();

  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const rows = await fetchNotifications(session.user.id);
    setNotifs(rows);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if (!session?.user) return;
    return subscribeToNotifications(session.user.id, load);
  }, [session, load]);

  const sections = useMemo(() => {
    const groups: Record<string, NotificationRow[]> = {};
    const order: string[] = [];
    notifs.forEach((n) => {
      const label = dayLabel(n.created_at);
      if (!groups[label]) {
        groups[label] = [];
        order.push(label);
      }
      groups[label].push(n);
    });
    return order.map((label) => ({ title: label, data: groups[label] }));
  }, [notifs]);

  async function onPress(n: NotificationRow) {
    if (!n.read) {
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markNotifRead(n.id);
    }
    try {
      const route = resolveNotifRoute(n);
      router.push(route.params ? { pathname: route.pathname as any, params: route.params } : (route.pathname as any));
    } catch (e) {
      console.warn("notification tap navigation failed:", e);
      toast("Could not open this notification.", 4000, true);
    }
  }

  function onLongPress(n: NotificationRow) {
    Alert.alert("Delete notification", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setNotifs((prev) => prev.filter((x) => x.id !== n.id));
          deleteNotif(n.id);
        },
      },
    ]);
  }

  async function markAllRead() {
    if (!session?.user) return;
    if (!notifs.some((n) => !n.read)) {
      toast("No unread notifications");
      return;
    }
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotifsRead(session.user.id);
    toast("Marked all as read");
  }

  function clearAll() {
    if (!session?.user) return;
    if (!notifs.length) {
      toast("No notifications to clear");
      return;
    }
    Alert.alert("Clear all notifications", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          setNotifs([]);
          await clearAllNotifs(session.user.id);
          toast("Cleared all notifications");
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tones.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notifs.length ? (
        <View style={styles.actionsRow}>
          <Pressable onPress={markAllRead}>
            <Text style={styles.actionLink}>Mark all read</Text>
          </Pressable>
          <Pressable onPress={clearAll}>
            <Text style={[styles.actionLink, styles.actionLinkDanger]}>Clear all</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        ListEmptyComponent={<EmptyState title="No notifications yet" subtitle="We'll let you know when something happens." />}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, !item.read && styles.rowUnread]}
            onPress={() => onPress(item)}
            onLongPress={() => onLongPress(item)}
          >
            <View style={[styles.dot, { backgroundColor: notifDotColor(item.type) }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.body} numberOfLines={3}>
                {item.body}
              </Text>
              <Text style={styles.time}>{timeOfDay(item.created_at)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return { brand: color.brand };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    actionLink: { fontSize: 13, fontWeight: "700", color: color.brand },
    actionLinkDanger: { color: color.danger },
    sectionHeader: {
      fontSize: 12,
      fontWeight: "700",
      color: color.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 14,
      marginBottom: 8,
    },
    row: {
      flexDirection: "row",
      gap: 10,
      backgroundColor: color.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    rowUnread: { borderLeftWidth: 3, borderLeftColor: color.brand },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    title: { fontSize: 14, fontWeight: "700", color: color.text },
    body: { fontSize: 13, color: color.textSub, marginTop: 3, lineHeight: 18 },
    time: { fontSize: 11, color: color.textMuted, marginTop: 6 },
  });
}
