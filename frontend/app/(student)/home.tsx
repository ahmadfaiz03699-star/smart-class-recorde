import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API, getUser, clearUser, type User } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [live, setLive] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const u = await getUser();
    setUser(u);
    if (!u) return router.replace("/login");
    const [liveR, batchR, scoreR, leaderR] = await Promise.all([
      API.get("/live/current").catch(() => ({ data: null })),
      API.get(`/users/${u.id}/batches`).catch(() => ({ data: [] })),
      API.get(`/users/${u.id}/quiz-scores`).catch(() => ({ data: [] })),
      API.get("/leaderboard", { params: { limit: 5 } }).catch(() => ({ data: [] })),
    ]);
    setLive(liveR.data);
    setBatches(batchR.data || []);
    setScores(scoreR.data || []);
    setLeaders(leaderR.data || []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const logout = async () => {
    await clearUser();
    router.replace("/login");
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="student-home">
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Hello,</Text>
          <Text style={styles.name}>{user?.name || "Student"}</Text>
        </View>
        <Pressable onPress={logout} testID="logout-button" style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || "S")[0]?.toUpperCase()}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Live class hero */}
        <Pressable
          testID="live-class-card"
          onPress={() => live && router.push("/live-class")}
          style={styles.hero}
        >
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?q=85&w=1400" }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(17,24,39,0.85)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroContent}>
            {live ? (
              <>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE NOW</Text>
                </View>
                <Text style={styles.heroTitle}>{live.title}</Text>
                <Text style={styles.heroSub}>{live.subject} · Tap to join</Text>
              </>
            ) : (
              <>
                <Text style={styles.heroTitle}>No live class right now</Text>
                <Text style={styles.heroSub}>Check recorded classes below</Text>
              </>
            )}
          </View>
        </Pressable>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <QuickTile icon="video-outline" label="Recorded" onPress={() => router.push("/(student)/classes")} testID="qa-recorded" />
          <QuickTile icon="clipboard-check-outline" label="Quizzes" onPress={() => router.push("/(student)/quizzes")} testID="qa-quiz" />
          <QuickTile icon="robot-happy-outline" label="AI Tutor" onPress={() => router.push("/ai-tutor")} testID="qa-ai" />
        </View>

        <Text style={styles.section}>My Batches</Text>
        {batches.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No batches yet.</Text>
            <Pressable onPress={() => router.push("/(student)/batches")}>
              <Text style={styles.link}>Browse marketplace →</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {batches.map((b) => (
              <Pressable
                key={b.id}
                testID={`my-batch-${b.id}`}
                style={styles.batchCard}
                onPress={() => router.push(`/batch/${b.id}`)}
              >
                <Image source={{ uri: b.hero_image }} style={styles.batchImg} contentFit="cover" />
                <View style={{ padding: 12 }}>
                  <Text style={styles.batchSubject}>{b.subject}</Text>
                  <Text style={styles.batchTitle} numberOfLines={2}>{b.title}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={styles.section}>Recent Quiz Scores</Text>
        {scores.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Attempt your first quiz to see scores.</Text>
          </View>
        ) : (
          scores.slice(0, 5).map((s: any) => (
            <View key={s.id} style={styles.scoreRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.scoreTitle}>Quiz</Text>
                <Text style={styles.scoreMeta}>{s.correct}/{s.total} correct</Text>
              </View>
              <Text style={styles.scoreVal}>{s.score}%</Text>
            </View>
          ))
        )}

        <View style={styles.leaderHeader}>
          <Text style={styles.section}>Leaderboard</Text>
          <View style={styles.leaderBadge}>
            <Icon name="trophy" size={12} color={colors.onBrandTertiary} />
            <Text style={styles.leaderBadgeText}>Top 5</Text>
          </View>
        </View>
        {leaders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Be the first to attempt a quiz.</Text>
          </View>
        ) : (
          <View style={{ gap: 8, marginBottom: 20 }}>
            {leaders.map((l, i) => (
              <View
                key={l.user_id}
                testID={`leader-${i}`}
                style={[styles.leaderRow, user?.id === l.user_id && styles.leaderRowMe]}
              >
                <View style={[styles.rankBox, i === 0 && { backgroundColor: colors.warning }]}>
                  <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaderName}>{l.name}{user?.id === l.user_id ? " (You)" : ""}</Text>
                  <Text style={styles.leaderMeta}>{l.attempts} attempts · avg {l.avg_score}%</Text>
                </View>
                <Text style={styles.leaderScore}>{l.total_score}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        testID="ai-fab"
        onPress={() => router.push("/ai-tutor")}
        style={[styles.fab, { bottom: 16 + insets.bottom / 2 }]}
      >
        <Icon name="robot-happy" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

function QuickTile({ icon, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.qt}>
      <View style={styles.qtIcon}>
        <Icon name={icon} size={22} color={colors.brandPrimary} />
      </View>
      <Text style={styles.qtLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hi: { color: colors.muted, fontSize: 13 },
  name: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  hero: {
    height: 170, borderRadius: 20, overflow: "hidden", backgroundColor: colors.surfaceInverse,
    marginBottom: 16,
  },
  heroContent: { position: "absolute", left: 16, right: 16, bottom: 16 },
  liveBadge: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    backgroundColor: colors.brandSecondary, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, marginBottom: 8, gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  liveBadgeText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  heroSub: { color: "#F3F4F6", marginTop: 4, fontSize: 13 },
  quickRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  qt: {
    flex: 1, backgroundColor: colors.surfaceSecondary, padding: 14, borderRadius: 16,
    alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border,
  },
  qtIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  qtLabel: { color: colors.onSurface, fontWeight: "600", fontSize: 12 },
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginBottom: 12, marginTop: 4 },
  empty: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 20, alignItems: "center",
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  emptyText: { color: colors.muted, marginBottom: 6 },
  link: { color: colors.brandPrimary, fontWeight: "700" },
  batchCard: {
    width: 220, backgroundColor: colors.surfaceSecondary, borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  batchImg: { width: "100%", height: 100 },
  batchSubject: { color: colors.brandPrimary, fontWeight: "700", fontSize: 11 },
  batchTitle: { color: colors.onSurface, fontWeight: "700", marginTop: 2 },
  scoreRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  scoreTitle: { fontWeight: "700", color: colors.onSurface },
  scoreMeta: { color: colors.muted, fontSize: 12 },
  scoreVal: { color: colors.brandPrimary, fontWeight: "800", fontSize: 18 },
  leaderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  leaderBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  leaderBadgeText: { color: colors.onBrandTertiary, fontWeight: "800", fontSize: 11 },
  leaderRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  leaderRowMe: { borderColor: colors.brandPrimary, borderWidth: 2 },
  rankBox: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  rankText: { color: "#fff", fontWeight: "800" },
  leaderName: { color: colors.onSurface, fontWeight: "700" },
  leaderMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  leaderScore: { color: colors.brandPrimary, fontWeight: "800", fontSize: 16 },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
