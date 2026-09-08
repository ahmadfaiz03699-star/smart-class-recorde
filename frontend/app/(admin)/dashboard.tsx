import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API, clearUser } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      API.get("/admin/analytics").then((r) => setStats(r.data));
    }, []),
  );

  const logout = async () => {
    await clearUser();
    router.replace("/login");
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="admin-dashboard">
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Admin Console</Text>
          <Text style={styles.name}>Ahmad Classes</Text>
        </View>
        <Pressable onPress={logout} style={styles.logout} testID="admin-logout">
          <Icon name="logout" size={18} color={colors.brandSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.section}>Analytics</Text>
        <View style={styles.statGrid}>
          <StatCard label="Students" value={stats?.students ?? "—"} icon="account-group-outline" />
          <StatCard label="Batches" value={stats?.batches ?? "—"} icon="bookshelf" />
          <StatCard label="Quizzes" value={stats?.quizzes ?? "—"} icon="clipboard-check-outline" />
          <StatCard label="Attempts" value={stats?.submissions ?? "—"} icon="checkbox-multiple-marked-outline" />
          <StatCard label="Live now" value={stats?.live_active ?? "—"} icon="broadcast" tint />
          <StatCard label="Notes" value={stats?.notes ?? "—"} icon="file-document-multiple-outline" />
        </View>

        <Text style={styles.section}>Quick Actions</Text>
        <View style={styles.actions}>
          <ActionTile
            icon="broadcast"
            label="Start Live Class"
            onPress={() => router.push("/(admin)/live")}
            testID="qa-start-live"
          />
          <ActionTile
            icon="upload-outline"
            label="Upload Notes"
            onPress={() => router.push("/(admin)/content")}
            testID="qa-upload"
          />
          <ActionTile
            icon="clipboard-plus-outline"
            label="Create Quiz"
            onPress={() => router.push("/(admin)/content?tab=quiz")}
            testID="qa-create-quiz"
          />
          <ActionTile
            icon="plus-box-outline"
            label="Add Batch"
            onPress={() => router.push("/(admin)/batches")}
            testID="qa-add-batch"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, tint }: any) {
  return (
    <View style={[styles.stat, tint && { backgroundColor: colors.brandTertiary }]}>
      <Icon name={icon} size={22} color={tint ? colors.onBrandTertiary : colors.brandPrimary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionTile({ icon, label, onPress, testID }: any) {
  return (
    <Pressable onPress={onPress} testID={testID} style={styles.action}>
      <View style={styles.actionIcon}>
        <Icon name={icon} size={26} color="#fff" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingBottom: 8,
  },
  hi: { color: colors.muted, fontSize: 12 },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  logout: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginVertical: 12 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: {
    width: "31%", flexGrow: 1,
    backgroundColor: colors.surfaceSecondary, padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: {
    width: "47%", flexGrow: 1,
    backgroundColor: colors.surfaceSecondary, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, gap: 10, alignItems: "flex-start",
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  actionLabel: { color: colors.onSurface, fontWeight: "700" },
});
