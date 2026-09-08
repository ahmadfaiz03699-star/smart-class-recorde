import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getUser } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const u = await getUser();
      if (u?.role === "admin") router.replace("/(admin)/dashboard");
      else if (u?.role === "student") router.replace("/(student)/home");
      else router.replace("/login");
    })();
  }, []);

  return (
    <View style={styles.wrap} testID="splash-screen">
      <Text style={styles.brand}>Ahmad Classes</Text>
      <ActivityIndicator color="#059669" style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 26, fontWeight: "800", color: "#059669" },
});
