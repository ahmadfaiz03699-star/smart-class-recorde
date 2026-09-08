import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, FlatList,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function AdminBatches() {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    title: "", subject: "Physics", description: "", price: "1999",
    duration_weeks: "12", lessons: "30", instructor: "Ahmad Sir", hero_image: "",
  });
  const [batches, setBatches] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data } = await API.get("/batches");
    setBatches(data || []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!form.title.trim() || !form.description.trim()) return Alert.alert("Missing fields");
    try {
      await API.post("/batches", {
        ...form,
        price: parseInt(form.price) || 0,
        duration_weeks: parseInt(form.duration_weeks) || 12,
        lessons: parseInt(form.lessons) || 30,
      });
      Alert.alert("Batch added", form.title);
      setForm({ ...form, title: "", description: "", hero_image: "" });
      load();
    } catch { Alert.alert("Error", "Could not create batch"); }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="admin-batches-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Manage Batches</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
          <View style={styles.card}>
            <Text style={styles.section}>Create new batch</Text>
            <Field label="Title" value={form.title} onChange={(t) => setForm({ ...form, title: t })} testID="batch-title" />
            <Text style={styles.label}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {["Physics", "Chemistry", "Maths", "Biology", "English"].map((s) => (
                <Pressable key={s} onPress={() => setForm({ ...form, subject: s })} style={[styles.chip, form.subject === s && styles.chipActive]}>
                  <Text style={[styles.chipText, form.subject === s && { color: "#fff" }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field label="Description" value={form.description} onChange={(t) => setForm({ ...form, description: t })} multiline testID="batch-desc" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Price (PKR)" value={form.price} onChange={(t) => setForm({ ...form, price: t })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Weeks" value={form.duration_weeks} onChange={(t) => setForm({ ...form, duration_weeks: t })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Lessons" value={form.lessons} onChange={(t) => setForm({ ...form, lessons: t })} keyboardType="number-pad" /></View>
            </View>
            <Field label="Instructor" value={form.instructor} onChange={(t) => setForm({ ...form, instructor: t })} />
            <Field label="Hero image URL (optional)" value={form.hero_image} onChange={(t) => setForm({ ...form, hero_image: t })} />
            <Pressable onPress={create} style={styles.primary} testID="create-batch-submit">
              <Icon name="plus" size={18} color="#fff" />
              <Text style={styles.primaryText}>Create Batch</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Existing batches ({batches.length})</Text>
          {batches.map((b) => (
            <View key={b.id} style={styles.batchRow}>
              <Image source={{ uri: b.hero_image }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.bTitle}>{b.title}</Text>
                <Text style={styles.bSub}>{b.subject} · PKR {b.price}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, value, onChange, multiline, keyboardType, testID }: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginBottom: 8 },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 12, marginTop: 10, fontWeight: "700" },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: 12, padding: 12, marginTop: 4, color: colors.onSurface,
  },
  chipRow: { gap: 8, paddingVertical: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 12, height: 36, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontWeight: "700", fontSize: 12 },
  primary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: 999, marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  batchRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceSecondary, padding: 10, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  thumb: { width: 60, height: 60, borderRadius: 10 },
  bTitle: { fontWeight: "700", color: colors.onSurface },
  bSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
