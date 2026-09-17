import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, FlatList } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API, getUser } from "@/src/api";
import { colors } from "@/src/theme-tokens";

const SUBJECTS = ["All", "Physics", "Chemistry", "Maths", "Biology", "English"];
const KINDS = [
  { key: "video", label: "Videos" },
  { key: "pdf", label: "Notes" },
];

export default function Classes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [kind, setKind] = useState<"video" | "pdf">("video");
  const [subject, setSubject] = useState("All");
  const [notes, setNotes] = useState<any[]>([]);
  const [live, setLive] = useState<any>(null);

  const load = useCallback(async () => {
    const u = await getUser();
    const batchIds = (u?.enrolled_batches || []).join(",");
    const params: any = { kind };
    if (subject !== "All") params.subject = subject;
    if (batchIds) params.batch_ids = batchIds;
    const [notesR, liveR] = await Promise.all([
      API.get("/notes", { params }),
      API.get("/live/current").catch(() => ({ data: null })),
    ]);
    setNotes(notesR.data || []);
    const liveData = liveR.data;
    if (liveData && liveData.batch_id && !(u?.enrolled_batches || []).includes(liveData.batch_id)) {
      setLive(null);
    } else {
      setLive(liveData);
    }
  }, [kind, subject]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNote = (n: any) => {
    if (n.kind === "video") {
      Linking.openURL(n.storage_path);
    } else {
      // PDF - open in browser or handle via file URL
      const url = n.storage_path.startsWith("http")
        ? n.storage_path
        : `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/files/${n.storage_path}`;
      Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="classes-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Classes & Notes</Text>
      </View>

      {live && (
        <Pressable
          testID="join-live-banner"
          onPress={() => router.push("/live-class")}
          style={styles.liveBanner}
        >
          <View style={styles.liveDotLarge} />
          <View style={{ flex: 1 }}>
            <Text style={styles.liveBannerTitle}>Live now: {live.title}</Text>
            <Text style={styles.liveBannerSub}>Tap to join · {live.subject}</Text>
          </View>
          <Icon name="chevron-right" size={22} color="#fff" />
        </Pressable>
      )}

      <View style={styles.toggleRow}>
        {KINDS.map((k) => (
          <Pressable
            key={k.key}
            testID={`kind-${k.key}`}
            onPress={() => setKind(k.key as any)}
            style={[styles.toggleBtn, kind === k.key && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, kind === k.key && styles.toggleTextActive]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={{ maxHeight: 56 }}
      >
        {SUBJECTS.map((s) => (
          <Pressable
            key={s}
            testID={`subject-chip-${s}`}
            onPress={() => setSubject(s)}
            style={[styles.chip, subject === s && styles.chipActive]}
          >
            <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="video-off-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>No {kind === "video" ? "recorded classes" : "notes"} available.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`note-${item.id}`}
            onPress={() => openNote(item)}
            style={styles.noteCard}
          >
            <Image
              source={{ uri: item.thumbnail || "https://images.pexels.com/photos/5905902/pexels-photo-5905902.jpeg" }}
              style={styles.noteImg}
              contentFit="cover"
            />
            <View style={styles.badge}>
              <Icon
                name={item.kind === "video" ? "play-circle" : "file-pdf-box"}
                size={14}
                color="#fff"
              />
              <Text style={styles.badgeText}>{item.kind === "video" ? "Video" : "PDF"}</Text>
            </View>
            <View style={{ padding: 10 }}>
              <Text style={styles.noteSubject}>{item.subject}</Text>
              <Text style={styles.noteTitle} numberOfLines={2}>{item.title}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  liveBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, backgroundColor: colors.brandSecondary,
    padding: 14, borderRadius: 14, marginBottom: 4,
  },
  liveDotLarge: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  liveBannerTitle: { color: "#fff", fontWeight: "800" },
  liveBannerSub: { color: "#FCE7F3", fontSize: 12, marginTop: 2 },
  toggleRow: {
    flexDirection: "row", marginHorizontal: 16, backgroundColor: colors.surfaceTertiary,
    borderRadius: 999, padding: 4, marginTop: 12,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 999 },
  toggleBtnActive: { backgroundColor: colors.brandPrimary },
  toggleText: { color: colors.onSurfaceTertiary, fontWeight: "700" },
  toggleTextActive: { color: "#fff" },
  chipsRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 12, alignItems: "center" },
  chip: {
    paddingHorizontal: 14, height: 36, borderRadius: 999,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  noteCard: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border,
  },
  noteImg: { width: "100%", height: 100 },
  badge: {
    position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  noteSubject: { color: colors.brandPrimary, fontSize: 11, fontWeight: "700" },
  noteTitle: { color: colors.onSurface, fontWeight: "700", marginTop: 2 },
  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyText: { color: colors.muted },
});
