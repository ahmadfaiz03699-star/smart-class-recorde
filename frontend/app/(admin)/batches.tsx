import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API } from "@/src/api";
import { colors } from "@/src/theme-tokens";
import { notify, confirm } from "@/src/utils/notify";

const EMPTY_FORM = {
  title: "", subject: "Physics", description: "", price: "1999",
  duration_weeks: "12", lessons: "30", instructor: "Ahmad Sir", hero_image: "",
};

export default function AdminBatches() {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [batches, setBatches] = useState<any[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const showBanner = (type: "ok" | "err", text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 4000);
  };

  const generateDesc = async () => {
    if (!form.title.trim()) return notify("Add a title first");
    setAiBusy(true);
    try {
      const { data } = await API.post("/ai/write-batch", {
        title: form.title.trim(),
        subject: form.subject,
      });
      if (data.description) setForm({ ...form, description: data.description });
    } catch {
      notify("Error", "AI generation failed");
    } finally {
      setAiBusy(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const { data } = await API.get("/batches");
      setBatches(data || []);
    } catch {
      showBanner("err", "Could not load batches");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  };

  const startEdit = (b: any) => {
    setEditingId(b.id);
    setForm({
      title: b.title || "",
      subject: b.subject || "Physics",
      description: b.description || "",
      price: String(b.price ?? ""),
      duration_weeks: String(b.duration_weeks ?? "12"),
      lessons: String(b.lessons ?? "30"),
      instructor: b.instructor || "Ahmad Sir",
      hero_image: b.hero_image || "",
    });
  };

  const save = async () => {
    if (!form.title.trim()) return notify("Missing title", "Please enter a batch title.");
    if (!form.description.trim()) return notify("Missing description", "Please add a description or use Write with AI.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        price: parseInt(form.price) || 0,
        duration_weeks: parseInt(form.duration_weeks) || 12,
        lessons: parseInt(form.lessons) || 30,
      };
      if (editingId) {
        await API.put(`/batches/${editingId}`, payload);
        showBanner("ok", `Batch "${form.title.trim()}" updated`);
      } else {
        await API.post("/batches", payload);
        showBanner("ok", `Batch "${form.title.trim()}" created`);
      }
      resetForm();
      load();
    } catch (e: any) {
      showBanner("err", e?.response?.data?.detail || "Could not save batch");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: any) => {
    const ok = await confirm("Delete batch?", `"${b.title}" will be removed for all students.`);
    if (!ok) return;
    try {
      await API.delete(`/batches/${b.id}`);
      setBatches((prev) => prev.filter((x) => x.id !== b.id));
      if (editingId === b.id) resetForm();
      showBanner("ok", "Batch deleted");
    } catch {
      showBanner("err", "Could not delete batch");
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="admin-batches-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Manage Batches</Text>
      </View>
      {banner && (
        <View style={[styles.banner, banner.type === "ok" ? styles.bannerOk : styles.bannerErr]} testID="batch-banner">
          <Icon name={banner.type === "ok" ? "check-circle" : "alert-circle"} size={18} color="#fff" />
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.formHeader}>
              <Text style={styles.section}>{editingId ? "Edit batch" : "Create new batch"}</Text>
              {editingId && (
                <Pressable onPress={resetForm} style={styles.cancelEdit} testID="cancel-edit">
                  <Icon name="close" size={16} color={colors.muted} />
                  <Text style={styles.cancelEditText}>Cancel edit</Text>
                </Pressable>
              )}
            </View>
            <Field label="Title" value={form.title} onChange={(t: string) => setForm({ ...form, title: t })} testID="batch-title" />
            <Text style={styles.label}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {["Physics", "Chemistry", "Maths", "Biology", "English"].map((s) => (
                <Pressable key={s} onPress={() => setForm({ ...form, subject: s })} style={[styles.chip, form.subject === s && styles.chipActive]} testID={`batch-subject-${s}`}>
                  <Text style={[styles.chipText, form.subject === s && { color: "#fff" }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field label="Description" value={form.description} onChange={(t: string) => setForm({ ...form, description: t })} multiline testID="batch-desc" />
            <Pressable onPress={generateDesc} disabled={aiBusy} style={[styles.aiBtn, aiBusy && { opacity: 0.6 }]} testID="ai-write-desc">
              <Icon name="magic-staff" size={16} color={colors.brandPrimary} />
              <Text style={styles.aiBtnText}>{aiBusy ? "Writing…" : "Write with AI"}</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Price (PKR)" value={form.price} onChange={(t: string) => setForm({ ...form, price: t })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Weeks" value={form.duration_weeks} onChange={(t: string) => setForm({ ...form, duration_weeks: t })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Lessons" value={form.lessons} onChange={(t: string) => setForm({ ...form, lessons: t })} keyboardType="number-pad" /></View>
            </View>
            <Field label="Instructor" value={form.instructor} onChange={(t: string) => setForm({ ...form, instructor: t })} testID="batch-instructor" />
            <Field label="Hero image URL (optional)" value={form.hero_image} onChange={(t: string) => setForm({ ...form, hero_image: t })} testID="batch-hero-image" />
            <Pressable onPress={save} disabled={saving} style={[styles.primary, saving && { opacity: 0.6 }]} testID="create-batch-submit">
              {saving ? <ActivityIndicator color="#fff" /> : <Icon name={editingId ? "check" : "plus"} size={18} color="#fff" />}
              <Text style={styles.primaryText}>{saving ? "Saving…" : editingId ? "Update Batch" : "Create Batch"}</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Existing batches ({batches.length})</Text>
          {batches.length === 0 && (
            <Text style={styles.emptyText}>No batches yet. Create one above.</Text>
          )}
          {batches.map((b) => (
            <View key={b.id} style={styles.batchRow} testID={`batch-row-${b.id}`}>
              <Image source={{ uri: b.hero_image }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.bTitle}>{b.title}</Text>
                <Text style={styles.bSub}>{b.subject} · PKR {b.price} · {b.instructor}</Text>
              </View>
              <Pressable onPress={() => startEdit(b)} style={styles.editBtn} hitSlop={8} testID={`edit-batch-${b.id}`}>
                <Icon name="pencil-outline" size={20} color={colors.brandPrimary} />
              </Pressable>
              <Pressable onPress={() => remove(b)} style={styles.deleteBtn} hitSlop={8} testID={`delete-batch-${b.id}`}>
                <Icon name="trash-can-outline" size={20} color={colors.brandSecondary} />
              </Pressable>
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
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  cancelEdit: { flexDirection: "row", alignItems: "center", gap: 4 },
  cancelEditText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
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
  aiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, marginTop: 8, borderRadius: 999,
    backgroundColor: colors.brandTertiary,
  },
  aiBtnText: { color: colors.brandPrimary, fontWeight: "700" },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, padding: 12, borderRadius: 12,
  },
  bannerOk: { backgroundColor: colors.brandPrimary },
  bannerErr: { backgroundColor: colors.brandSecondary },
  bannerText: { color: "#fff", fontWeight: "700", flex: 1 },
  editBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 20 },
});
