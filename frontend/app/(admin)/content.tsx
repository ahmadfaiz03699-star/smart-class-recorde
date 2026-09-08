import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API } from "@/src/api";
import { colors } from "@/src/theme-tokens";

type Tab = "upload" | "quiz";

export default function AdminContent() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("upload");

  // Upload
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [file, setFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // Quiz
  const [qTitle, setQTitle] = useState("");
  const [qSubject, setQSubject] = useState("Physics");
  const [qDuration, setQDuration] = useState("300");
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [questions, setQuestions] = useState<any[]>([
    { q: "", options: ["", "", "", ""], correct_index: 0 },
  ]);

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "video/*", "image/*"],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets?.[0]) setFile(res.assets[0]);
  };

  const upload = async () => {
    if (!file || !title.trim()) return Alert.alert("Missing", "Pick a file and add title");
    setUploading(true);
    try {
      const form = new FormData();
      const kind = (file.mimeType || "").includes("pdf") ? "pdf" : "video";
      if (Platform.OS === "web") {
        const blob = await (await fetch(file.uri)).blob();
        form.append("file", blob, file.name || "file.pdf");
      } else {
        form.append("file", { uri: file.uri, name: file.name || "file.pdf", type: file.mimeType || "application/pdf" } as any);
      }
      form.append("title", title.trim());
      form.append("subject", subject);
      form.append("kind", kind);
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/upload`, {
        method: "POST",
        body: form,
      }).then((r) => {
        if (!r.ok) throw new Error("upload failed");
      });
      Alert.alert("Uploaded", `${title} added to library`);
      setTitle(""); setFile(null);
    } catch (e) {
      Alert.alert("Error", "Upload failed. Try smaller file.");
    } finally {
      setUploading(false);
    }
  };

  const addQuestion = () => setQuestions([...questions, { q: "", options: ["", "", "", ""], correct_index: 0 }]);
  const updateQ = (idx: number, patch: any) => {
    const copy = [...questions];
    copy[idx] = { ...copy[idx], ...patch };
    setQuestions(copy);
  };

  const generateWithAI = async () => {
    if (!aiTopic.trim()) return Alert.alert("Enter a topic", "e.g., Laws of Motion");
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
        Alert.alert("Quiz generated", `${data.questions.length} questions ready — review & save.`);
      } else {
        Alert.alert("Try a different topic");
      }
    } catch {
      Alert.alert("Error", "AI generation failed. Try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const createQuiz = async () => {
    if (!qTitle.trim()) return Alert.alert("Add quiz title");
    const clean = questions.filter((q) => q.q.trim() && q.options.every((o: string) => o.trim()));
    if (!clean.length) return Alert.alert("Add at least 1 complete question");
    try {
      await API.post("/quizzes", {
        title: qTitle.trim(),
        subject: qSubject,
        duration_seconds: parseInt(qDuration) || 300,
        questions: clean,
      });
      Alert.alert("Quiz created", qTitle);
      setQTitle("");
      setQuestions([{ q: "", options: ["", "", "", ""], correct_index: 0 }]);
    } catch { Alert.alert("Error", "Could not create quiz"); }
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
          {tab === "upload" ? (
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
              <Pressable onPress={pickFile} style={styles.filePicker} testID="pick-file">
                <Icon name="file-plus-outline" size={22} color={colors.brandPrimary} />
                <Text style={styles.filePickerText} numberOfLines={1}>
                  {file ? file.name : "Pick a PDF or video file"}
                </Text>
              </Pressable>
              <Pressable onPress={upload} style={[styles.primary, uploading && { opacity: 0.6 }]} disabled={uploading} testID="upload-submit">
                <Icon name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.primaryText}>{uploading ? "Uploading…" : "Upload & Save"}</Text>
              </Pressable>
            </View>
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
              <Pressable onPress={createQuiz} style={styles.primary} testID="create-quiz-submit">
                <Text style={styles.primaryText}>Create Quiz</Text>
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
  filePickerText: { color: colors.onSurface, fontWeight: "600", flex: 1 },
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
