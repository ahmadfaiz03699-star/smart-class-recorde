import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API, getUser } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function BatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [batch, setBatch] = useState<any>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await API.get(`/batches/${id}`);
      setBatch(data);
      const u = await getUser();
      if (u) setEnrolled(u.enrolled_batches?.includes(id as string));
    })();
  }, [id]);

  const buy = async () => {
    const u = await getUser();
    if (!u) return;
    setBusy(true);
    try {
      await API.post(`/batches/${id}/purchase`, { user_id: u.id });
      const fresh = await API.get(`/users/${u.id}`);
      const { saveUser } = await import("@/src/api");
      await saveUser(fresh.data);
      setEnrolled(true);
      Alert.alert("Success", `You are enrolled in ${batch?.title}`);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Purchase failed");
    } finally {
      setBusy(false);
    }
  };

  if (!batch) {
    return <View style={[styles.wrap, { paddingTop: insets.top }]}><Text style={{ padding: 24 }}>Loading…</Text></View>;
  }

  return (
    <View style={[styles.wrap]} testID="batch-detail">
      <ScrollView>
        <View style={{ height: 320 }}>
          <Image source={{ uri: batch.hero_image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent", "rgba(17,24,39,0.95)"]} style={StyleSheet.absoluteFillObject} />
          <Pressable
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            testID="batch-back"
          >
            <Icon name="chevron-left" size={26} color="#fff" />
          </Pressable>
          <View style={styles.heroText}>
            <Text style={styles.heroSubject}>{batch.subject}</Text>
            <Text style={styles.heroTitle}>{batch.title}</Text>
            <View style={styles.heroMeta}>
              <MetaChip icon="account-tie" text={batch.instructor} />
              <MetaChip icon="video-outline" text={`${batch.lessons} lessons`} />
              <MetaChip icon="calendar-range" text={`${batch.duration_weeks} weeks`} />
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          <View>
            <Text style={styles.sectionTitle}>About this batch</Text>
            <Text style={styles.body}>{batch.description}</Text>
          </View>
          <View style={styles.perksCard}>
            <Perk icon="broadcast" text="Weekly live doubt sessions" />
            <Perk icon="clipboard-check-outline" text="Timed quizzes & mock tests" />
            <Perk icon="robot-happy-outline" text="AI Tutor for instant help" />
            <Perk icon="file-pdf-box" text="Downloadable notes & PDFs" />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <Text style={styles.price}>PKR {batch.price}</Text>
          <Text style={styles.priceSub}>one-time</Text>
        </View>
        {enrolled ? (
          <View style={[styles.cta, { backgroundColor: colors.success }]} testID="enrolled-badge">
            <Icon name="check" size={18} color="#fff" />
            <Text style={styles.ctaText}>Enrolled</Text>
          </View>
        ) : (
          <Pressable
            testID="buy-batch-button"
            onPress={buy}
            disabled={busy}
            style={[styles.cta, busy && { opacity: 0.6 }]}
          >
            <Text style={styles.ctaText}>{busy ? "Processing…" : "Buy Batch"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function MetaChip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaChip}>
      <Icon name={icon} size={13} color="#fff" />
      <Text style={styles.metaChipText}>{text}</Text>
    </View>
  );
}

function Perk({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.perkRow}>
      <View style={styles.perkIcon}>
        <Icon name={icon} size={18} color={colors.brandPrimary} />
      </View>
      <Text style={styles.perkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  backBtn: {
    position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
  },
  heroText: { position: "absolute", left: 20, right: 20, bottom: 20 },
  heroSubject: { color: "#D1FAE5", fontWeight: "800", letterSpacing: 0.5 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 },
  heroMeta: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  metaChipText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginBottom: 6 },
  body: { color: colors.onSurfaceSecondary, lineHeight: 22 },
  perksCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  perkIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  perkText: { color: colors.onSurface, fontWeight: "600" },
  footer: {
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 12,
  },
  price: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  priceSub: { color: colors.muted, fontSize: 12 },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.brandPrimary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
