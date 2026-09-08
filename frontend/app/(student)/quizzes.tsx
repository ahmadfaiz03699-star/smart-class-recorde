import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function Quizzes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      API.get("/quizzes").then((r) => setItems(r.data || []));
    }, []),
  );

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="quizzes-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Quizzes</Text>
        <Text style={styles.subtitle}>Test your understanding · Timed MCQs</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>No quizzes yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            testID={`quiz-${item.id}`}
            onPress={() => router.push(`/quiz/${item.id}`)}
            style={styles.card}
          >
            <View style={styles.iconBox}>
              <Icon name="clipboard-check-outline" size={26} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subject}>{item.subject}</Text>
              <Text style={styles.qTitle}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.questions.length} questions · {Math.round(item.duration_seconds / 60)} min
              </Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.muted} />
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
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  iconBox: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  subject: { color: colors.brandPrimary, fontWeight: "700", fontSize: 11 },
  qTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 15, marginTop: 2 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
