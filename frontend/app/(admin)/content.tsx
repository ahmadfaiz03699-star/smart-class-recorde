import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API } from "@/src/api";
import { colors } from "@/src/theme-tokens";
import { notify, confirm } from "@/src/utils/notify";

type Tab = "upload" | "quiz";

const formatSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

export default function AdminContent() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "quiz" ? "quiz" : "upload");
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (params.tab === "quiz" || params.tab === "upload") setTab(params.tab);
  }, [params.tab]);

  const showBanner = (type: "ok" | "err", text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 4000);
  };

  // Upload
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [file, setFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await API.get("/notes");
      setNotes(data || []);
    } catch {
      // list is informational; keep silent
    }
  }, []);

  useFocusEffect(useCallback(() => { loadNotes(); }, [loadNotes]));

  // Quiz
  const [qTitle, setQTitle] = useState("");
  const [qSubject, setQSubject] = useState("Physics");
  const [qDuration, setQDuration] = useState("300");
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [questions, setQuestions] = useState<any[]>([
    { q: "", options: ["", "", "", ""], correct_index: 0 },
  ]);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "video/*", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.[0]) setFile(res.assets[0]);
    } catch {
      notify("Error", "Could not open file picker");
    }
  };

  const upload = async () => {
    if (!title.trim()) return notify("Missing title", "Please enter a title for this file.");
    if (!file) return notify("No file selected", "Tap 'Pick a PDF or video file' first.");
    setUploading(true);
    setProgress(0);
    try {
      const form = new FormData();
      const mime = file.mimeType || "";
      const kind = mime.includes("pdf") || (file.name || "").toLowerCase().endsWith(".pdf") ? "pdf" : "video";
      const fallbackType = kind === "pdf" ? "application/pdf" : "video/mp4";
      if (Platform.OS === "web") {
        const blob = file.file instanceof Blob ? file.file : await (await fetch(file.uri)).blob();
        form.append("file", blob, file.name || `file.${kind === "pdf" ? "pdf" : "mp4"}`);
      } else {
        form.append("file", { uri: file.uri, name: file.name || `file.${kind === "pdf" ? "pdf" : "mp4"}`, type: mime || fallbackType } as any);
      }
      form.append("title", title.trim());
      form.append("subject", subject);
      form.append("kind", kind);
      await API.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10 * 60 * 1000,
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });
      showBanner("ok", `"${title.trim()}" uploaded to library`);
      setTitle(""); setFile(null);
      loadNotes();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      showBanner("err", detail || (e?.code === "ECONNABORTED" ? "Upload timed out. Try a smaller file." : "Upload failed. Please try again."));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const removeNote = async (n: any) => {
    const ok = await confirm("Delete file?", `"${n.title}" will be removed from the student library.`);
    if (!ok) return;
    try {
      await API.delete(`/notes/${n.id}`);
      setNotes((prev) => prev.filter((x) => x.id !== n.id));
      showBanner("ok", "File deleted");
    } catch {
      showBanner("err", "Could not delete file");
    }
  };

  const addQuestion = () => setQuestions([...questions, { q: "", options: ["", "", "", ""], correct_index: 0 }]);
  const updateQ = (idx: number, patch: any) => {
    const copy = [...questions];
    copy[idx] = { ...copy[idx], ...patch };
    setQuestions(copy);
  };

  const generateWithAI = async () => {
    if (!aiTopic.trim()) return notify("Enter a topic", "e.g., Laws of Motion");
    setAiBusy(true);
    try {
      const { data } = await API.post("/ai/generate-quiz", {
        topic: aiTopic.trim(),
        subject: qSubject,
        num_questions: 5,
      });
      if (data.questions?.length) {
        setQuestions(data.questions);
        if (!qTitle.trim()) setQTitle(`${qSubject} — ${aiTopic.trim()}`);
        showBanner("ok", `${data.questions.length} questions generated — review & save`);
      } else {
        notify("Try a different topic");
      }
    } catch {
      notify("Error", "AI generation failed. Try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const createQuiz = async () => {
    if (!qTitle.trim()) return notify("Add quiz title");
    const clean = questions.filter((q) => q.q.trim() && q.options.every((o: string) => o.trim()));
    if (!clean.length) return notify("Incomplete quiz", "Add at least 1 question with all 4 options filled.");
    setSavingQuiz(true);
    try {
      await API.post("/quizzes", {
        title: qTitle.trim(),
        subject: qSubject,
        duration_seconds: parseInt(qDuration) || 300,
        questions: clean,
      });
      showBanner("ok", `Quiz "${qTitle.trim()}" created`);
      setQTitle("");
      setQuestions([{ q: "", options: ["", "", "", ""], correct_index: 0 }]);
    } catch (e: any) {
      showBanner("err", e?.response?.data?.detail || "Could not create quiz");
    } finally {
      setSavingQuiz(false);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="admin-content-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Content Manager</Text>
      </View>
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("upload")} style={[styles.tab, tab === "upload" && styles.tabActive]} testID="tab-upload">
          <Text style={[styles.tabText, tab === "upload" && styles.tabTextActive]}>Upload Notes</Text>
        </Pressable>
        <Pressable onPress={() => setTab("quiz")} style={[styles.tab, tab === "quiz" && styles.tabActive]} testID="tab-quiz">
          <Text style={[styles.tabText, tab === "quiz" && styles.tabTextActive]}>Create Quiz</Text>
        </Pressable>
      </View>
      {banner && (
        <View style={[styles.banner, banner.type === "ok" ? styles.bannerOk : styles.bannerErr]} testID="content-banner">
          <Icon name={banner.type === "ok" ? "check-circle" : "alert-circle"} size={18} color="#fff" />
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">
          {tab === "upload" ? (
            <>
            <View style={styles.card}>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Chemistry - Periodic Table" placeholderTextColor={colors.muted} testID="upload-title" />
              <Text style={styles.label}>Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {["Physics", "Chemistry", "Maths", "Biology", "English"].map((s) => (
                  <Pressable key={s} onPress={() => setSubject(s)} style={[styles.chip, subject === s && styles.chipActive]}>
                    <Text style={[styles.chipText, subject === s && { color: "#fff" }]}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={pickFile} style={[styles.filePicker, file && styles.filePickerActive]} testID="pick-file">
                <Icon name={file ? "file-check-outline" : "file-plus-outline"} size={22} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.filePickerText} numberOfLines={1}>
                    {file ? file.name : "Pick a PDF or video file"}
                  </Text>
                  {file ? <Text style={styles.fileMeta}>{formatSize(file.size)} · tap to change</Text> : null}
                </View>
              </Pressable>
              {uploading && (
                <View style={styles.progressWrap} testID="upload-progress">
                  <View style={[styles.progressBar, { width: `${Math.max(progress, 3)}%` }]} />
                  <Text style={styles.progressText}>{progress < 100 ? `Uploading… ${progress}%` : "Saving to library…"}</Text>
                </View>
              )}
              <Pressable onPress={upload} style={[styles.primary, uploading && { opacity: 0.6 }]} disabled={uploading} testID="upload-submit">
                {uploading ? <ActivityIndicator color="#fff" /> : <Icon name="cloud-upload-outline" size={18} color="#fff" />}
                <Text style={styles.primaryText}>{uploading ? "Uploading…" : "Upload & Save"}</Text>
              </Pressable>
            </View>

            <Text style={styles.section}>Library ({notes.length})</Text>
            {notes.length === 0 ? (
              <Text style={styles.empty}>No files uploaded yet.</Text>
            ) : notes.map((n) => (
              <View key={n.id} style={styles.noteRow} testID={`note-row-${n.id}`}>
                <View style={styles.noteIcon}>
                  <Icon name={n.kind === "video" ? "play-circle-outline" : "file-pdf-box"} size={22} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteTitle} numberOfLines={1}>{n.title}</Text>
                  <Text style={styles.noteSub}>{n.subject} · {n.kind === "video" ? "Video" : "PDF"}</Text>
                </View>
                <Pressable onPress={() => removeNote(n)} style={styles.deleteBtn} hitSlop={8} testID={`delete-note-${n.id}`}>
                  <Icon name="trash-can-outline" size={20} color={colors.brandSecondary} />
                </Pressable>
              </View>
            ))}
            </>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.card}>
                <Text style={styles.label}>Quiz Title</Text>
                <TextInput style={styles.input} value={qTitle} onChangeText={setQTitle} placeholder="Weekly Physics Test" placeholderTextColor={colors.muted} testID="quiz-title" />
                <Text style={styles.label}>Subject</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {["Physics", "Chemistry", "Maths", "Biology", "English"].map((s) => (
                    <Pressable key={s} onPress={() => setQSubject(s)} style={[styles.chip, qSubject === s && styles.chipActive]}>
                      <Text style={[styles.chipText, qSubject === s && { color: "#fff" }]}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.label}>Duration (seconds)</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={qDuration} onChangeText={setQDuration} />
              </View>

              <View style={[styles.card, { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon name="robot-happy-outline" size={20} color={colors.brandPrimary} />
                  <Text style={{ color: colors.onBrandTertiary, fontWeight: "800", fontSize: 15 }}>Generate with AI</Text>
                </View>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 12, marginBottom: 8 }}>
                  Enter a topic — AI creates 5 MCQs. You can edit before saving.
                </Text>
                <TextInput
                  testID="ai-topic"
                  style={styles.input}
                  value={aiTopic}
                  onChangeText={setAiTopic}
                  placeholder="e.g., Laws of Motion"
                  placeholderTextColor={colors.muted}
                />
                <Pressable
                  onPress={generateWithAI}
                  disabled={aiBusy}
                  style={[styles.primary, { backgroundColor: colors.brandSecondary, marginTop: 12 }, aiBusy && { opacity: 0.6 }]}
                  testID="ai-generate"
                >
                  <Icon name="magic-staff" size={18} color="#fff" />
                  <Text style={styles.primaryText}>{aiBusy ? "Generating…" : "Generate Questions"}</Text>
                </Pressable>
              </View>

              {questions.map((q, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.qNum}>Question {i + 1}</Text>
                  <TextInput
                    style={styles.input}
                    value={q.q}
                    onChangeText={(t) => updateQ(i, { q: t })}
                    placeholder="Question text"
                    placeholderTextColor={colors.muted}
                    testID={`q-text-${i}`}
                  />
                  {q.options.map((o: string, j: number) => (
                    <View key={j} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Pressable
                        onPress={() => updateQ(i, { correct_index: j })}
                        style={[styles.radio, q.correct_index === j && styles.radioActive]}
                        testID={`q-${i}-correct-${j}`}
                      />
                      <TextInput
                        style={[styles.input, { flex: 1, marginTop: 0 }]}
                        value={o}
                        onChangeText={(t) => {
                          const options = [...q.options]; options[j] = t; updateQ(i, { options });
                        }}
                        placeholder={`Option ${j + 1}${q.correct_index === j ? " (correct)" : ""}`}
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  ))}
                </View>
              ))}
              <Pressable onPress={addQuestion} style={styles.addBtn} testID="add-question">
                <Icon name="plus" size={18} color={colors.brandPrimary} />
                <Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>Add Question</Text>
              </Pressable>
              <Pressable onPress={createQuiz} disabled={savingQuiz} style={[styles.primary, savingQuiz && { opacity: 0.6 }]} testID="create-quiz-submit">
                {savingQuiz ? <ActivityIndicator color="#fff" /> : null}
                <Text style={styles.primaryText}>{savingQuiz ? "Saving…" : "Create Quiz"}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  tabs: {
    flexDirection: "row", marginHorizontal: 16,
    backgroundColor: colors.surfaceTertiary, borderRadius: 999, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabText: { fontWeight: "700", color: colors.onSurfaceTertiary },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 12, marginTop: 8, fontWeight: "700" },
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
  filePicker: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderStyle: "dashed", borderWidth: 2, borderColor: colors.borderStrong,
    borderRadius: 12, padding: 14, marginTop: 12,
  },
  filePickerText: { color: colors.onSurface, fontWeight: "600" },
  filePickerActive: { borderColor: colors.brandPrimary, borderStyle: "solid", backgroundColor: colors.brandTertiary },
  fileMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  progressWrap: {
    marginTop: 12, height: 28, borderRadius: 999, backgroundColor: colors.surfaceTertiary,
    overflow: "hidden", justifyContent: "center",
  },
  progressBar: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.brandTertiary },
  progressText: { textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.onBrandTertiary },
  section: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 8 },
  empty: { color: colors.muted, fontSize: 13 },
  noteRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceSecondary, padding: 10, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  noteIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  noteTitle: { fontWeight: "700", color: colors.onSurface },
  noteSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  deleteBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12,
  },
  bannerOk: { backgroundColor: colors.brandPrimary },
  bannerErr: { backgroundColor: colors.brandSecondary },
  bannerText: { color: "#fff", fontWeight: "700", flex: 1 },
  primary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: 999, marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  qNum: { fontWeight: "800", color: colors.brandPrimary, fontSize: 12, letterSpacing: 0.5 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong,
  },
  radioActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    padding: 12, borderRadius: 12, borderWidth: 2, borderStyle: "dashed",
    borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary,
  },
});
