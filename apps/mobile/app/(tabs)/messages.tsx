import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { messagePreview, otherMember, type ConversationRow, type MessageRow } from "../../lib/messages";
import type { Profile } from "../../lib/profiles";
import { initPresence, isUserOnline } from "../../lib/chat-realtime";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { Avatar, EmptyState, ListSkeleton } from "../../components/ui";

type ListingLite = { id: string; title: string | null; photos: string[] | null };
type BusinessLite = { id: string; name: string | null; logo: string | null };

type ConversationSummary = {
  conversation: ConversationRow;
  otherProfile: Profile | null;
  lastMessage: MessageRow | null;
  unreadCount: number;
  listing: ListingLite | null;
  business: BusinessLite | null;
};

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateString).toLocaleDateString();
}

function SearchIcon({ color }: { color: ColorPalette }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color.textMuted} strokeWidth={2}>
      <Circle cx={11} cy={11} r={7} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  );
}

export default function MessagesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  const themeColor = useThemedStyles((c) => c);
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [, setOnlineTick] = useState(0);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const myId = session.user.id;

    const { data: conversations } = await supabase
      .from("conversations")
      .select("id,members,listing_id,business_id")
      .contains("members", [myId])
      .order("updated_at", { ascending: false })
      .limit(200);

    const rows = (conversations as ConversationRow[]) ?? [];
    if (!rows.length) {
      setSummaries([]);
      return;
    }

    // Batched fetch of other members' profiles (unchanged logic).
    const otherIds = Array.from(
      new Set(rows.map((c) => otherMember(c, myId)).filter((id): id is string => !!id))
    );
    const profilesRes = otherIds.length
      ? await supabase.from("profiles_public").select("id,name,avatar,verified").in("id", otherIds)
      : { data: [] as Profile[] };
    const profilesById = new Map((profilesRes.data as Profile[] | null ?? []).map((p) => [p.id, p]));

    // Batched fetch of attached listing titles/thumbnails, same pattern.
    const listingIds = Array.from(
      new Set(rows.map((c) => c.listing_id).filter((lid): lid is string => !!lid))
    );
    const listingsRes = listingIds.length
      ? await supabase.from("listings").select("id,title,photos").in("id", listingIds)
      : { data: [] as ListingLite[] };
    const listingsById = new Map((listingsRes.data as ListingLite[] | null ?? []).map((l) => [l.id, l]));

    // Business conversations (business_id set) show the shop's identity
    // instead of the owner's personal profile — see
    // supabase/migrations/add_conversation_business_id.sql for why.
    const businessIds = Array.from(
      new Set(rows.map((c) => c.business_id).filter((bid): bid is string => !!bid))
    );
    const businessesRes = businessIds.length
      ? await supabase.from("businesses").select("id,name,logo").in("id", businessIds)
      : { data: [] as BusinessLite[] };
    const businessesById = new Map((businessesRes.data as BusinessLite[] | null ?? []).map((b) => [b.id, b]));

    const summariesList = await Promise.all(
      rows.map(async (conversation): Promise<ConversationSummary> => {
        const otherId = otherMember(conversation, myId);

        const [lastMessageRes, unreadRes] = await Promise.all([
          supabase
            .from("messages")
            .select("id,conversation_id,sender_id,sender_name,text,image,read,created_at,deleted")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conversation.id)
            .eq("read", false)
            .neq("sender_id", myId),
        ]);

        return {
          conversation,
          otherProfile: (otherId ? profilesById.get(otherId) : undefined) ?? null,
          lastMessage: (lastMessageRes.data as MessageRow) ?? null,
          unreadCount: unreadRes.count ?? 0,
          listing: (conversation.listing_id ? listingsById.get(conversation.listing_id) : undefined) ?? null,
          business: (conversation.business_id ? businessesById.get(conversation.business_id) : undefined) ?? null,
        };
      })
    );

    summariesList.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bTime - aTime;
    });

    setSummaries(summariesList.filter((s) => s.lastMessage));
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if (!session?.user) return;
    // Unique topic per call — a fixed topic can collide with a same-named
    // channel from a previous mount still mid-teardown, throwing "cannot add
    // postgres_changes callbacks after subscribe()" on remount.
    const channel = supabase
      .channel(`messages-list-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, load]);

  // Presence — re-render rows as online status changes.
  useEffect(() => {
    if (!session?.user) return;
    return initPresence(session.user.id, () => setOnlineTick((t) => t + 1));
  }, [session]);

  const myId = session?.user?.id;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => {
      const name = (s.business?.name || s.otherProfile?.name || "").toLowerCase();
      const listing = (s.listing?.title || "").toLowerCase();
      return name.includes(q) || listing.includes(q);
    });
  }, [summaries, query]);

  if (!session?.user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <EmptyState
            title="Sign in to view messages"
            subtitle="Your conversations with buyers and sellers appear here."
            buttonLabel="Sign In"
            onPressButton={() => router.push("/(auth)/sign-in")}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <Text style={styles.screenTitle}>Messages</Text>
      </View>
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <SearchIcon color={themeColor} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations"
            placeholderTextColor={themeColor.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: space.lg }}>
          <ListSkeleton count={7} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.conversation.id}
          contentContainerStyle={filtered.length ? { paddingBottom: space.xxxl + space.lg } : styles.emptyContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query.trim() ? (
              <EmptyState title="No matches" subtitle={`No conversations match "${query.trim()}".`} />
            ) : (
              <EmptyState
                title="No messages yet"
                subtitle="When buyers message you about a listing, it will show up here."
              />
            )
          }
          renderItem={({ item }) => {
            const otherId = myId ? otherMember(item.conversation, myId) : undefined;
            const online = isUserOnline(otherId);
            const unread = item.unreadCount > 0;
            const thumb = item.listing?.photos?.[0] ?? null;
            // Business conversations show the shop's identity, not the
            // owner's personal profile — see lib/messages.ts ConversationRow
            // and supabase/migrations/add_conversation_business_id.sql.
            const displayName = item.business?.name || item.otherProfile?.name || "PaMarket User";
            const displayAvatar = item.business?.logo || item.otherProfile?.avatar;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.conversation.id } })}
              >
                <Avatar uri={displayAvatar} name={displayName} size={52} online={!item.business && online} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
                      {displayName}
                      {item.business ? " · Shop" : ""}
                    </Text>
                    {item.lastMessage ? (
                      <Text style={[styles.time, unread && styles.timeUnread]}>
                        {timeAgo(item.lastMessage.created_at)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                      {messagePreview(item.lastMessage ?? undefined)}
                    </Text>
                    {unread ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {item.unreadCount > 99 ? "99+" : item.unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.listing ? (
                    <View style={styles.listingChip}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.listingThumb} contentFit="cover" cachePolicy="memory-disk" />
                      ) : (
                        <View style={[styles.listingThumb, styles.listingThumbEmpty]} />
                      )}
                      <Text style={styles.listingTitle} numberOfLines={1}>
                        {item.listing.title || "Listing"}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.surface,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxxl,
  },
  headerBar: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  screenTitle: {
    ...font.h1,
    color: color.text,
  },
  searchWrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    ...font.body,
    color: color.text,
    padding: 0,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowPressed: {
    backgroundColor: color.surfaceAlt,
  },
  rowBody: {
    flex: 1,
    gap: space.xxs,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    ...font.title,
    color: color.text,
    flex: 1,
    marginRight: space.sm,
  },
  nameUnread: {
    color: color.text,
  },
  time: {
    ...font.caption,
    color: color.textMuted,
  },
  timeUnread: {
    color: color.brand,
  },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  preview: {
    ...font.sub,
    color: color.textSub,
    flex: 1,
    marginRight: space.sm,
  },
  previewUnread: {
    color: color.text,
    fontWeight: "700",
  },
  unreadBadge: {
    backgroundColor: color.brand,
    borderRadius: radius.pill,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xs,
  },
  unreadBadgeText: {
    ...font.micro,
    color: color.textOnBrand,
  },
  listingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    marginTop: space.xxs,
    backgroundColor: color.brandTint,
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingRight: space.sm,
    paddingVertical: 2,
    paddingLeft: 2,
    maxWidth: "100%",
  },
  listingThumb: {
    width: 22,
    height: 22,
    borderRadius: radius.sm - 2,
  },
  listingThumbEmpty: {
    backgroundColor: color.brandTintStrong,
  },
  listingTitle: {
    ...font.caption,
    color: color.brand,
    flexShrink: 1,
  },
  separator: {
    height: 1,
    backgroundColor: color.divider,
    marginLeft: 52 + space.lg + space.md,
  },
  });
}
