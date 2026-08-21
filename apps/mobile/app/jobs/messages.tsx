import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { otherMember, messagePreview, type ConversationRow, type MessageRow } from "../../lib/messages";
import type { Profile } from "../../lib/profiles";
import { color, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { Avatar, EmptyState, GlassBackButton } from "../../components/ui";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";

type RecruitmentContextRow = {
  conversation_id: string;
  employer_id: string;
  candidate_id: string;
  job_id: string | null;
  contact_request_id: string | null;
};

type JobLite = { id: string; title: string | null };

type RecruitmentThread = {
  conversation: ConversationRow;
  context: RecruitmentContextRow | null;
  otherProfile: Profile | null;
  job: JobLite | null;
  lastMessage: MessageRow | null;
  isEmployer: boolean;
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

// Recruitment threads (employer <-> candidate) are deliberately kept out of
// the Personal/Business marketplace inbox (app/(tabs)/messages.tsx) — a
// candidate is often also a buyer/seller/business owner, and mixing
// recruitment identity into that generic inbox would make it look like the
// employer contacted them through a personal listing/account. This screen
// is the dedicated recruitment inbox, reachable from Jobs on both sides.
export default function RecruitmentMessagesScreen() {
  const styles = useThemedStyles(buildStyles);
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<RecruitmentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "Recruitment Messages" });

  const load = useCallback(async () => {
    if (!session?.user) return;
    const myId = session.user.id;

    // recruitment_conversation_context (RLS-scoped to employer_id = me OR
    // candidate_id = me) is the DRIVING query, not `conversations` filtered
    // by id prefix — a `recruit_`-shaped id with no context row is not a
    // recruitment conversation and must never appear here, forged or not.
    const { data: contextData } = await supabase
      .from("recruitment_conversation_context")
      .select("conversation_id,employer_id,candidate_id,job_id,contact_request_id")
      .limit(200);
    const contextRows = (contextData as RecruitmentContextRow[] | null) ?? [];
    if (!contextRows.length) {
      setThreads([]);
      return;
    }
    const contextByConv = new Map(contextRows.map((c) => [c.conversation_id, c]));
    const convIds = contextRows.map((c) => c.conversation_id);

    const [conversationsRes, lastMsgsRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("id,members,listing_id,business_id,created_at,updated_at")
        .in("id", convIds),
      supabase
        .from("messages")
        .select("id,conversation_id,sender_id,sender_name,text,image,read,created_at,deleted")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    const conversationRows = (conversationsRes.data as ConversationRow[] | null) ?? [];

    // Candidate identity (when I'm the employer side) must come from the
    // recruitment-gated, live-revalidated RPC, not the general-purpose
    // profiles_public view — a revoked approval must stop showing the real
    // name/avatar immediately, which a static public-identity snapshot has
    // no notion of. Employer identity (when I'm the candidate side) isn't
    // recruitment-protected and keeps using profiles_public.
    const candidateIdsAsEmployer = Array.from(
      new Set(contextRows.filter((c) => c.employer_id === myId).map((c) => c.candidate_id))
    );
    const employerIdsAsCandidate = Array.from(
      new Set(contextRows.filter((c) => c.candidate_id === myId).map((c) => c.employer_id))
    );

    const [candidateProfilesRes, employerProfilesRes, jobsRes] = await Promise.all([
      Promise.all(
        candidateIdsAsEmployer.map((cid) =>
          supabase.rpc("get_recruitment_candidate", { p_candidate_id: cid }).then((res) => ({
            id: cid,
            row: (res.data as { id: string; name: string | null; avatar: string | null; verified: boolean | null }[] | null)?.[0] ?? null,
          }))
        )
      ),
      employerIdsAsCandidate.length
        ? supabase.from("profiles_public").select("id,name,avatar,verified").in("id", employerIdsAsCandidate)
        : Promise.resolve({ data: [] as Profile[] }),
      (() => {
        const jobIds = Array.from(new Set(contextRows.map((c) => c.job_id).filter((id): id is string => !!id)));
        return jobIds.length
          ? supabase.from("listings").select("id,title").in("id", jobIds)
          : Promise.resolve({ data: [] as JobLite[] });
      })(),
    ]);

    const profilesById = new Map<string, Profile>();
    for (const { id: cid, row } of candidateProfilesRes) {
      if (row) profilesById.set(cid, row as Profile);
    }
    for (const p of (employerProfilesRes.data as Profile[] | null) ?? []) {
      profilesById.set(p.id, p);
    }
    const jobsById = new Map((jobsRes.data as JobLite[] | null ?? []).map((j) => [j.id, j]));
    const lastMessageByConv = new Map<string, MessageRow>();
    for (const m of (lastMsgsRes.data as MessageRow[] | null) ?? []) {
      if (!lastMessageByConv.has(m.conversation_id)) lastMessageByConv.set(m.conversation_id, m);
    }

    const list: RecruitmentThread[] = conversationRows.map((conversation) => {
      const ctx = contextByConv.get(conversation.id) ?? null;
      const otherId = otherMember(conversation, myId);
      return {
        conversation,
        context: ctx,
        otherProfile: (otherId ? profilesById.get(otherId) : undefined) ?? null,
        job: ctx?.job_id ? jobsById.get(ctx.job_id) ?? null : null,
        lastMessage: lastMessageByConv.get(conversation.id) ?? null,
        isEmployer: ctx ? ctx.employer_id === myId : false,
      };
    });

    list.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.conversation.created_at || 0).getTime();
      const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.conversation.created_at || 0).getTime();
      return bTime - aTime;
    });
    setThreads(list);
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>Recruitment Messages</Text>
          <View style={{ width: 20 }} />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.conversation.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <EmptyState
                title="No recruitment messages yet"
                subtitle="Conversations with employers or candidates from an approved contact request or a job application will show up here."
              />
            </View>
          }
          renderItem={({ item }) => {
            // Resolved identity only for the nameHint passed to Chat — a
            // synthetic placeholder here must never look like authoritative
            // route identity to the chat screen.
            const resolvedName = item.otherProfile?.name || "";
            const name = resolvedName || (item.isEmployer ? "Candidate" : "Employer");
            const originLabel = item.job?.title
              ? `Job: ${item.job.title}`
              : item.context?.contact_request_id
                ? "Via contact request"
                : "Recruitment";
            return (
              <Pressable
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: "/chat/[id]",
                    params: { id: item.conversation.id, name: resolvedName, avatar: item.otherProfile?.avatar ?? "" },
                  })
                }
              >
                <Avatar uri={item.otherProfile?.avatar} name={name} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    {item.lastMessage ? (
                      <Text style={styles.time}>{timeAgo(item.lastMessage.created_at)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.originPill}>
                    <Text style={styles.originPillText} numberOfLines={1}>
                      {item.isEmployer ? "Candidate" : "Employer"} · {originLabel}
                    </Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {messagePreview(item.lastMessage ?? undefined) || "No messages yet"}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: color.brand,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: color.textOnBrand },
    listContent: { padding: space.md, paddingBottom: 40, flexGrow: 1 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: color.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: color.border,
    },
    rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    name: { fontSize: 14.5, fontWeight: "800", color: color.text, flexShrink: 1 },
    time: { fontSize: 11, color: color.textMuted, flexShrink: 0 },
    originPill: { alignSelf: "flex-start", marginTop: 3, marginBottom: 2 },
    originPillText: { fontSize: 11, fontWeight: "700", color: color.brand },
    preview: { fontSize: 12.5, color: color.textSub },
  });
}
