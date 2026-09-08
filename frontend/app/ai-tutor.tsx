import { useRef, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API, streamAI } from "@/src/api";
import { colors } from "@/src/theme-tokens";

const SUGGESTED = [
  "Explain Newton's laws",
  "Periodic table trends",
  "Derivatives basics",
  "Exam tips for physics",
];

type Msg = { role: "user" | "ai"; content: string };

export default function AITutor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", content: "Salaam! I'm your Ahmad Classes AI Tutor. Ask me anything about your studies." },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzeMode, setAnalyzeMode] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sessionRef = useRef(`sess-${Date.now()}`);

  useEffect(() => {
    API.get("/notes", { params: { kind: "pdf" } }).then((r) => setNotes(r.data || []));
  }, []);

  const send = async (userMsg: string) => {
    if (!userMsg.trim() || loading) return;
    setText("");
    const newMsgs = [...msgs, { role: "user" as const, content: userMsg }, { role: "ai" as const, content: "" }];
    setMsgs(newMsgs);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    let acc = "";
    try {
      const endpoint = analyzeMode && selectedNote ? "/ai/analyze" : "/ai/chat";
      const body: any = analyzeMode && selectedNote
        ? { session_id: sessionRef.current, note_id: selectedNote.id, question: userMsg }
        : { session_id: sessionRef.current, message: userMsg };

      await streamAI(endpoint, body, (chunk) => {
        acc += chunk;
        setMsgs((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "ai", content: acc };
          return copy;
        });
      });
    } catch (e) {
      setMsgs((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "ai", content: "Sorry, I couldn't respond. Please try again." };
        return copy;
      });
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="ai-tutor-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="ai-back">
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.aiIcon}>
          <Icon name="robot-happy" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI Tutor</Text>
          <Text style={styles.sub}>Online · ready to help</Text>
        </View>
        <Pressable
          testID="analyze-toggle"
          onPress={() => setAnalyzeMode((m) => !m)}
          style={[styles.modeBtn, analyzeMode && styles.modeBtnActive]}
        >
          <Icon name="file-search-outline" size={16} color={analyzeMode ? "#fff" : colors.brandPrimary} />
          <Text style={[styles.modeText, analyzeMode && { color: "#fff" }]}>Analyze</Text>
        </Pressable>
      </View>

      {analyzeMode && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 56 }} contentContainerStyle={styles.notesRow}>
          {notes.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => setSelectedNote(n)}
              testID={`analyze-note-${n.id}`}
              style={[styles.notePill, selectedNote?.id === n.id && styles.notePillActive]}
            >
              <Icon name="file-pdf-box" size={14} color={selectedNote?.id === n.id ? "#fff" : colors.brandPrimary} />
              <Text style={[styles.notePillText, selectedNote?.id === n.id && { color: "#fff" }]} numberOfLines={1}>
                {n.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {msgs.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}
            >
              <Text style={m.role === "user" ? styles.userText : styles.aiText}>
                {m.content || "…"}
              </Text>
            </View>
          ))}
          {loading && (
            <View style={{ flexDirection: "row", padding: 8 }}>
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            </View>
          )}
        </ScrollView>

        {msgs.length <= 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggRow}>
            {SUGGESTED.map((s) => (
              <Pressable key={s} onPress={() => send(s)} style={styles.suggPill} testID={`suggest-${s}`}>
                <Text style={styles.suggText}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            testID="ai-input"
            value={text}
            onChangeText={setText}
            placeholder={analyzeMode && selectedNote ? `Ask about ${selectedNote.title}…` : "Ask me anything…"}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable
            testID="ai-send"
            onPress={() => send(text)}
            style={[styles.sendBtn, (!text.trim() || loading) && { opacity: 0.5 }]}
            disabled={!text.trim() || loading}
          >
            <Icon name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  aiIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  sub: { color: colors.success, fontSize: 12 },
  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.brandTertiary,
  },
  modeBtnActive: { backgroundColor: colors.brandPrimary },
  modeText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 12 },
  notesRow: { paddingHorizontal: 12, gap: 8, alignItems: "center", paddingVertical: 12 },
  notePill: {
    flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 200,
    backgroundColor: colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, flexShrink: 0,
  },
  notePillActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  notePillText: { color: colors.onSurface, fontSize: 12, fontWeight: "600" },
  chatList: { padding: 16, gap: 10 },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 16 },
  userBubble: { backgroundColor: colors.brandPrimary, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubble: {
    backgroundColor: colors.surfaceSecondary, alignSelf: "flex-start", borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  userText: { color: "#fff" },
  aiText: { color: colors.onSurface, lineHeight: 20 },
  suggRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 8, alignItems: "center" },
  suggPill: {
    backgroundColor: colors.brandTertiary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, flexShrink: 0,
  },
  suggText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 12 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 10, color: colors.onSurface,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
});
