import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API, saveUser } from "@/src/api";
import { colors } from "@/src/theme-tokens";

type Role = "student" | "admin";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (role === "student") {
        if (!name.trim() || !studentId.trim()) {
          Alert.alert("Missing info", "Please enter your name and student ID");
          return;
        }
        const { data } = await API.post("/auth/student-login", {
          name: name.trim(),
          student_id: studentId.trim(),
        });
        await saveUser(data);
        router.replace("/(student)/home");
      } else {
        const { data } = await API.post("/auth/admin-login", { username, password });
        await saveUser(data);
        router.replace("/(admin)/dashboard");
      }
    } catch (e: any) {
      Alert.alert("Login failed", e?.response?.data?.detail || "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="login-screen">
      <LinearGradient colors={["#065F46", "#059669"]} style={styles.hero}>
        <Text style={styles.logo}>Ahmad Classes</Text>
        <Text style={styles.tagline}>Learn · Practice · Succeed</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.tabs}>
            {(["student", "admin"] as Role[]).map((r) => (
              <Pressable
                key={r}
                testID={`role-tab-${r}`}
                onPress={() => setRole(r)}
                style={[styles.tab, role === r && styles.tabActive]}
              >
                <Text style={[styles.tabText, role === r && styles.tabTextActive]}>
                  {r === "student" ? "Student" : "Admin"}
                </Text>
              </Pressable>
            ))}
          </View>

          {role === "student" ? (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                testID="student-name-input"
                value={name}
                onChangeText={setName}
                placeholder="Ali Ahmad"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Student ID / Roll No.</Text>
              <TextInput
                testID="student-id-input"
                value={studentId}
                onChangeText={setStudentId}
                placeholder="AC-2026-042"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Admin Username</Text>
              <TextInput
                testID="admin-username-input"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="admin-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.hint}>Default: admin / admin123</Text>
            </>
          )}

          <Pressable
            testID="login-submit-button"
            style={[styles.cta, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.ctaText}>{loading ? "Signing in…" : "Enter Classroom →"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hero: { paddingVertical: 40, paddingHorizontal: 24, alignItems: "center" },
  logo: { color: "#fff", fontSize: 28, fontWeight: "800" },
  tagline: { color: "#D1FAE5", marginTop: 4, fontSize: 14 },
  form: { padding: 24, gap: 12 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabText: { color: colors.onSurfaceTertiary, fontWeight: "600" },
  tabTextActive: { color: colors.onBrandPrimary },
  label: { color: colors.muted, fontSize: 12, marginTop: 8, marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.onSurface,
  },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  cta: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
});
