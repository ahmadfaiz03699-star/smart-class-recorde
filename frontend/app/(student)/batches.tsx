import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function Batches() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      API.get("/batches").then((r) => setItems(r.data || []));
    }, []),
  );

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="batches-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Batch Marketplace</Text>
        <Text style={styles.subtitle}>Learn from the best · Buy a batch to enroll</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>No batches available.</Text>}
        renderItem={({ item }) => (
          <Pressable
            testID={`batch-${item.id}`}
            onPress={() => router.push(`/batch/${item.id}`)}
            style={styles.card}
          >
            <Image source={{ uri: item.hero_image }} style={styles.img} contentFit="cover" />
            <LinearGradient
              colors={["transparent", "rgba(17,24,39,0.9)"]}
              style={styles.scrim}
            />
            <View style={styles.content}>
              <Text style={styles.subject}>{item.subject}</Text>
              <Text style={styles.batchTitle}>{item.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{item.lessons} lessons</Text>
                <Text style={styles.meta}>·</Text>
                <Text style={styles.meta}>{item.duration_weeks} weeks</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.price}>PKR {item.price}</Text>
              </View>
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
  subtitle: { color: colors.muted, marginTop: 4 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  card: {
    borderRadius: 20, overflow: "hidden", backgroundColor: colors.surfaceInverse, height: 200,
  },
  img: { ...StyleSheet.absoluteFillObject },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  content: { position: "absolute", left: 16, right: 16, bottom: 14 },
  subject: { color: "#D1FAE5", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  batchTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  meta: { color: "#F3F4F6", fontSize: 12 },
  price: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
