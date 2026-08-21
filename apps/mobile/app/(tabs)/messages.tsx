import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { isBusinessConversation, isRecruitmentConversation, messagePreview, otherMember, type ConversationRow, type MessageRow } from "../../lib/messages";
import type { Profile } from "../../lib/profiles";
import { initPresence, isUserOnline } from "../../lib/chat-realtime";
import { font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { Avatar, EmptyState, ListSkeleton } from "../../components/ui";
import { loadCache, saveCache } from "../../lib/offlineCache";

const MESSAGES_CACHE_KEY = "messages-list";

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
  // Authoritative set of conversation ids the CURRENT user actually has a
  // recruitment_conversation_context row for — never inferred from the
  // `recruit_` id prefix alone (that's just a namespace hint, not proof).
  const [recruitmentContextIds, setRecruitmentContextIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [, setOnlineTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showingCached, setShowingCached] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Personal vs Business inbox split, matching the legacy Capacitor app
  // (www/js/messages.js pages.Messages) — a business conversation is any
  // conversation with business_id set, whether you're the shop owner
  // receiving a customer's message or a customer messaging a shop.
  const [msgTab, setMsgTab] = useState<"personal" | "business">("personal");
  const summariesRef = useRef<ConversationSummary[]>([]);
  useEffect(() => {
    summariesRef.current = summaries;
  }, [summaries]);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const myId = session.user.id;

    const [{ data: conversations, error: convError }, contextRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("id,members,listing_id,business_id")
        .contains("members", [myId])
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase.from("recruitment_conversation_context").select("conversation_id").limit(400),
    ]);
    setRecruitmentContextIds(
      new Set(((contextRes.data as { conversation_id: string }[] | null) ?? []).map((r) => r.conversation_id))
    );

    if (convError) {
      // A failed fetch must never wipe out whatever's already on screen
      // (cached or from a previous successful load) — just surface the
      // error banner and leave `summaries` alone.
      setError(convError.message);
      return;
    }
    setError(null);

    const rows = (conversations as ConversationRow[]) ?? [];
    if (!rows.length) {
      setSummaries([]);
      saveCache<ConversationSummary[]>(MESSAGES_CACHE_KEY, []);
      return;
    }

    // Batched fetch of other members' profiles.
    const otherIds = Array.from(
      new Set(rows.map((c) => otherMember(c, myId)).filter((id): id is string => !!id))
    );
    const profilesRes = otherIds.length
      ? await supabase.from("profiles_public").select("id,name,avatar,verified").in("id", otherIds)
      : { data: [] as Profile[], error: null };
    if (profilesRes.error) {
      // A failed profile batch must never silently render every thread as
      // "PaMarket User" — same principle as the conversations-fetch
      // failure above: surface the error, leave whatever was already on
      // screen untouched, and stop before building degraded summaries.
      setError(profilesRes.error.message);
      return;
    }
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
      ? await supabase.from("businesses").select("id,name,logo,owner_user_id").in("id", businessIds)
      : { data: [] as (BusinessLite & { owner_user_id: string | null })[] };
    const businessesById = new Map(
      (businessesRes.data as (BusinessLite & { owner_user_id: string | null })[] | null ?? []).map((b) => [b.id, b])
    );

    // Batched last-message + unread-count across ALL conversations at once —
    // this used to fire 2 queries per conversation (up to 400 round trips
    // for a heavy inbox), which was the main reason this screen felt slow.
    const conversationIds = rows.map((c) => c.id);
    const [lastMsgsRes, unreadRes] = await Promise.all([
      supabase
        .from("messages")
        .select("id,conversation_id,sender_id,sender_name,text,image,read,created_at,deleted")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .eq("read", false)
        .neq("sender_id", myId)
        .limit(5000),
    ]);

    const lastMessageByConv = new Map<string, MessageRow>();
    for (const m of (lastMsgsRes.data as MessageRow[] | null) ?? []) {
      if (!lastMessageByConv.has(m.conversation_id)) lastMessageByConv.set(m.conversation_id, m);
    }
    const unreadCountByConv = new Map<string, number>();
    for (const m of (unreadRes.data as { conversation_id: string }[] | null) ?? []) {
      unreadCountByConv.set(m.conversation_id, (unreadCountByConv.get(m.conversation_id) ?? 0) + 1);
    }

    const summariesList = rows.map((conversation): ConversationSummary => {
      const otherId = otherMember(conversation, myId);
      // The business identity is only shown to the OTHER side of the
      // conversation — the customer. Without this check, a business owner's
      // own inbox row for their own shop's conversations showed their own
      // business's name/logo instead of the actual customer they're talking
      // to (same bug already fixed in chat/[id].tsx's header).
      const business = conversation.business_id ? businessesById.get(conversation.business_id) : undefined;
      return {
        conversation,
        otherProfile: (otherId ? profilesById.get(otherId) : undefined) ?? null,
        lastMessage: lastMessageByConv.get(conversation.id) ?? null,
        unreadCount: unreadCountByConv.get(conversation.id) ?? 0,
        listing: (conversation.listing_id ? listingsById.get(conversation.listing_id) : undefined) ?? null,
        business: business && business.owner_user_id !== myId ? business : null,
      };
    });

    summariesList.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bTime - aTime;
    });

    const finalSummaries = summariesList.filter((s) => s.lastMessage);
    setSummaries(finalSummaries);
    setShowingCached(false);
    saveCache<ConversationSummary[]>(MESSAGES_CACHE_KEY, finalSummaries);
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    // Hydrate from the last successful load immediately — if the network
    // call below fails (no connection), this stays on screen instead of an
    // empty inbox, matching the home feed's behavior. The actual network
    // load is left to the useFocusEffect below (which also covers initial
    // mount, since focus fires immediately) — calling load() from both
    // this effect AND that one fired it twice, back to back, every time
    // this screen first opened.
    loadCache<ConversationSummary[]>(MESSAGES_CACHE_KEY).then((cached) => {
      if (cancelled || !cached || !cached.length) return;
      setSummaries((current) => (current.length ? current : cached));
      setShowingCached(true);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Scoped to just this user's own conversations, not the whole `messages`
  // table — an unfiltered `table: "messages"` subscription means every
  // message sent by ANY user on the platform gets pushed to EVERY client
  // with this screen mounted, each of which then re-runs the full load()
  // below (profiles + listings + businesses + up to 1,000 messages + 5,000
  // unread rows). At real scale that's a fan-out multiplier that gets worse
  // with both more users AND more messages — this is the single biggest
  // scalability fix in this screen. Capped to the most recent 300
  // conversation ids so the filter string itself can't grow unbounded for
  // a power/business account with a huge conversation history; anything
  // older still gets picked up by the focus-based refresh below.
  const conversationIdsKey = useMemo(
    () =>
      summaries
        .map((s) => s.conversation.id)
        .slice(0, 300)
        .join(","),
    [summaries]
  );

  useEffect(() => {
    if (!session?.user || !conversationIdsKey) return;
    // Unique topic per call — a fixed topic can collide with a same-named
    // channel from a previous mount still mid-teardown, throwing "cannot add
    // postgres_changes callbacks after subscribe()" on remount.
    const channel = supabase
      .channel(`messages-list-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=in.(${conversationIdsKey})` },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, load, conversationIdsKey]);

  // Lightweight focus refresh — re-checks just the unread flag for
  // conversations already on screen, instead of re-running the full `load()`
  // (which re-fetches every profile/listing/business plus up to 1,000
  // messages and 5,000 unread rows). Opening a chat and marking its messages
  // read there never reached this screen without SOME refresh on focus (the
  // realtime subscription below only listens for INSERT, not the UPDATE that
  // marks a message read) — but doing that with a full reload burned data on
  // every single tab visit, which matters a lot on Zimbabwean mobile data.
  const refreshUnreadCounts = useCallback(async () => {
    if (!session?.user) return;
    const ids = summariesRef.current.map((s) => s.conversation.id);
    if (!ids.length) return;
    // Called fire-and-forget from useFocusEffect below — must never throw
    // out to an unhandled rejection on a dropped connection.
    try {
      const { data } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", ids)
        .eq("read", false)
        .neq("sender_id", session.user.id)
        .limit(5000);
      const counts = new Map<string, number>();
      for (const m of (data as { conversation_id: string }[] | null) ?? []) {
        counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1);
      }
      setSummaries((current) =>
        current.map((s) => ({ ...s, unreadCount: counts.get(s.conversation.id) ?? 0 }))
      );
    } catch (e) {
      console.warn("[messages] failed to refresh unread counts:", e instanceof Error ? e.message : e);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      if (summariesRef.current.length) {
        refreshUnreadCounts();
        return;
      }
      setIsLoading(true);
      // On a dead/flaky connection this query can hang rather than fail
      // fast, leaving the tab behind its loading skeleton indefinitely —
      // which reads as "Messages never opens". Falling through to the
      // normal empty/offline state after a few seconds is strictly better;
      // the screen already handles having no data.
      let settled = false;
      const stopLoading = () => {
        if (settled) return;
        settled = true;
        setIsLoading(false);
      };
      const timeout = setTimeout(stopLoading, 8000);
      load().finally(() => {
        clearTimeout(timeout);
        stopLoading();
      });
      return () => clearTimeout(timeout);
    }, [refreshUnreadCounts, load])
  );

  // Presence — re-render rows as online status changes.
  useEffect(() => {
    if (!session?.user) return;
    return initPresence(session.user.id, () => setOnlineTick((t) => t + 1));
  }, [session]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const myId = session?.user?.id;

  // Strict complements over the one shared classifier (lib/messages.ts) — a
  // conversation lands in exactly one inbox, never both, never neither.
  // Recruitment threads are excluded from both: they live in Jobs >
  // Recruitment Messages, never in Personal (a candidate is also often a
  // buyer/seller and must not see an employer thread mixed with those).
  const personalSummaries = useMemo(
    () =>
      summaries.filter(
        (s) => !isBusinessConversation(s.conversation) && !isRecruitmentConversation(s.conversation, recruitmentContextIds)
      ),
    [summaries, recruitmentContextIds]
  );
  const businessSummaries = useMemo(
    () => summaries.filter((s) => isBusinessConversation(s.conversation)),
    [summaries]
  );
  const personalUnread = useMemo(() => personalSummaries.reduce((sum, s) => sum + s.unreadCount, 0), [personalSummaries]);
  const businessUnread = useMemo(() => businessSummaries.reduce((sum, s) => sum + s.unreadCount, 0), [businessSummaries]);
  const hasBizTab = businessSummaries.length > 0;
  const activeTabSummaries = hasBizTab && msgTab === "business" ? businessSummaries : personalSummaries;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeTabSummaries;
    return activeTabSummaries.filter((s) => {
      const name = (s.business?.name || s.otherProfile?.name || "").toLowerCase();
      const listing = (s.listing?.title || "").toLowerCase();
      return name.includes(q) || listing.includes(q);
    });
  }, [activeTabSummaries, query]);

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
      {hasBizTab ? (
        <View style={styles.tabBar}>
          <Pressable style={styles.tabButton} onPress={() => setMsgTab("personal")}>
            <Text style={[styles.tabButtonText, msgTab === "personal" && styles.tabButtonTextActive]}>
              Personal{personalUnread > 0 ? ` (${personalUnread})` : ""}
            </Text>
            {msgTab === "personal" ? <View style={styles.tabButtonIndicator} /> : null}
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => setMsgTab("business")}>
            <Text style={[styles.tabButtonText, msgTab === "business" && styles.tabButtonTextActive]}>
              Business{businessUnread > 0 ? ` (${businessUnread})` : ""}
            </Text>
            {msgTab === "business" ? <View style={styles.tabButtonIndicator} /> : null}
          </Pressable>
        </View>
      ) : null}
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
          // BottomNav is an absolute overlay (58pt bar + insets.bottom, with
          // the Post button floating 30pt above the bar's top edge), so this
          // list scrolls underneath it. The previous value (48 + inset) left
          // the last conversation row ~10pt behind the bar and up to 40pt
          // behind the floating button. Same formula as Home/Account/Search.
          contentContainerStyle={
            filtered.length ? { paddingBottom: 58 + insets.bottom + space.xxxl } : styles.emptyContent
          }
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={themeColor.brand} />
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineBannerText}>
                  {showingCached ? "You're offline — showing your last saved conversations." : "Couldn't refresh — showing what we last loaded."}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            query.trim() ? (
              <EmptyState title="No matches" subtitle={`No conversations match "${query.trim()}".`} />
            ) : (
              <EmptyState
                title={hasBizTab && msgTab === "business" ? "No business messages yet" : "No messages yet"}
                subtitle={
                  hasBizTab && msgTab === "business"
                    ? "Conversations about your shops and their listings show up here."
                    : "When buyers message you about a listing, it will show up here."
                }
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
            // Falls back to the last message's stored sender_name when the
            // profile lookup has no name (e.g. profiles_public row missing a
            // name, or the account was deleted) — same opportunistic fallback
            // the legacy Capacitor app uses (H._resolveOtherName), so a real
            // person's name still shows instead of "PaMarket User" whenever
            // we have ANY record of what they're called.
            const otherSenderName =
              item.lastMessage && otherId && item.lastMessage.sender_id === otherId
                ? item.lastMessage.sender_name
                : null;
            // Resolved identity only — never the literal "PaMarket User"
            // placeholder itself, which would otherwise be passed to Chat
            // as though it were a real, authoritative nameHint and could
            // get rendered before Chat's own authoritative fetch resolves.
            const resolvedName = item.business?.name || item.otherProfile?.name || otherSenderName || "";
            const displayName = resolvedName || "PaMarket User";
            const displayAvatar = item.business?.logo || item.otherProfile?.avatar;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() =>
                  router.push({
                    pathname: "/chat/[id]",
                    params: { id: item.conversation.id, name: resolvedName, avatar: displayAvatar ?? "" },
                  })
                }
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
  offlineBanner: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    marginBottom: space.sm,
    backgroundColor: color.goldTint,
    borderRadius: radius.md,
    padding: space.md,
  },
  offlineBannerText: { ...font.sub, color: color.text, fontWeight: "600" },
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
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: color.border,
    marginBottom: space.xs,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.sm + 2,
  },
  tabButtonText: {
    ...font.sub,
    fontWeight: "600",
    color: color.textMuted,
  },
  tabButtonTextActive: {
    color: color.brand,
    fontWeight: "700",
  },
  tabButtonIndicator: {
    position: "absolute",
    bottom: -2,
    height: 3,
    width: "60%",
    borderRadius: radius.pill,
    backgroundColor: color.brand,
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
