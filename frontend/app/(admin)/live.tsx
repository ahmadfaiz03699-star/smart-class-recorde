import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function AdminLive() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [url, setUrl] = useState("");
  const [live, setLive] = useState<any>(null);

  const [pollQ, setPollQ] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [currentPoll, setCurrentPoll] = useState<any>(null);

  const load = useCallback(async () => {
    const [l, p] = await Promise.all([
      API.get("/live/current").catch(() => ({ data: null })),
      API.get("/polls/current").catch(() => ({ data: null })),
    ]);
    setLive(l.data);
    setCurrentPoll(p.data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const start = async () => {
    if (!title.trim() || !url.trim()) return Alert.alert("Missing fields");
    try {
      const { data } = await API.post("/live/start", {
        title: title.trim(),
        subject,
        youtube_url: url.trim(),
      });
      setLive(data);
      Alert.alert("Live started", data.title);
    } catch {
      Alert.alert("Error", "Could not start live");
    }
  };

  const end = async () => {
    if (!live) return;
    try {
      await API.post(`/live/${live.id}/end`);
      setLive(null);
      Alert.alert("Ended", "Class saved as recorded.");
    } catch { Alert.alert("Error", "Could not end"); }
  };

  const launchPoll = async () => {
    const options = opts.map((o) => o.trim()).filter(Boolean);
    if (!pollQ.trim() || options.length < 2) return Alert.alert("Add question + 2 options");
    try {
      const { data } = await API.post("/polls", {
        question: pollQ.trim(),
        options,
        live_id: live?.id,
      });
      setCurrentPoll(data);
      setPollQ("");
      setOpts(["", "", "", ""]);
      Alert.alert("Poll launched", "Students can now vote.");
    } catch { Alert.alert("Error", "Could not launch"); }
  };

  const closePoll = async () => {
    if (!currentPoll) return;
    await API.post(`/polls/${currentPoll.id}/close`);
    setCurrentPoll(null);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="admin-live-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Live Class Control</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
          {live ? (
            <View style={styles.liveCard}>
              <View style={styles.liveHeader}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE NOW</Text>
              </View>
              <Text style={styles.liveTitle}>{live.title}</Text>
              <Text style={styles.liveSub}>{live.subject}</Text>
              <Pressable onPress={end} style={styles.endBtn} testID="end-live">
                <Icon name="stop-circle-outline" size={18} color="#fff" />
                <Text style={styles.endText}>End Class & Save Recording</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Start a new live class</Text>
              <Text style={styles.label}>Title</Text>
              <TextInput testID="live-title" style={styles.input} value={title} onChangeText={setTitle} placeholder="Class 12 · Laws of Motion" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {["Physics", "Chemistry", "Maths", "Biology", "English"].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSubject(s)}
                    style={[styles.chip, subject === s && styles.chipActive]}
                    testID={`live-subject-${s}`}
                  >
                    <Text style={[styles.chipText, subject === s && { color: "#fff" }]}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>YouTube URL</Text>
              <TextInput testID="live-url" style={styles.input} value={url} onChangeText={setUrl} placeholder="https://youtube.com/watch?v=…" autoCapitalize="none" placeholderTextColor={colors.muted} />
              <Pressable onPress={start} style={styles.primary} testID="start-live">
                <Icon name="broadcast" size={18} color="#fff" />
                <Text style={styles.primaryText}>Go Live</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Launch a poll</Text>
            {currentPoll ? (
              <View>
                <Text style={styles.pollActive}>Active poll:</Text>
                <Text style={styles.pollQ}>{currentPoll.question}</Text>
                {currentPoll.options.map((o: string, i: number) => (
                  <Text key={i} style={styles.pollOpt}>{o} — {currentPoll.votes[i]} votes</Text>
                ))}
                <Pressable onPress={closePoll} style={[styles.endBtn, { marginTop: 12 }]} testID="close-poll">
                  <Icon name="close-circle-outline" size={18} color="#fff" />
                  <Text style={styles.endText}>Close Poll</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Question</Text>
                <TextInput testID="poll-q" style={styles.input} value={pollQ} onChangeText={setPollQ} placeholder="Which law defines force?" placeholderTextColor={colors.muted} />
                {opts.map((o, i) => (
                  <TextInput
                    key={i}
                    testID={`poll-opt-${i}`}
                    style={styles.input}
                    value={o}
                    onChangeText={(t) => {
                      const c = [...opts]; c[i] = t; setOpts(c);
                    }}
                    placeholder={`Option ${i + 1}`}
                    placeholderTextColor={colors.muted}
                  />
                ))}
                <Pressable onPress={launchPoll} style={styles.primary} testID="launch-poll">
                  <Icon name="poll" size={18} color="#fff" />
                  <Text style={styles.primaryText}>Launch Poll</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  sectionTitle: { fontWeight: "800", fontSize: 16, color: colors.onSurface, marginBottom: 8 },
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
  primary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: 999, marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  liveCard: {
    backgroundColor: colors.brandSecondary, padding: 20, borderRadius: 20,
  },
  liveHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontWeight: "800", letterSpacing: 0.5, fontSize: 12 },
  liveTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 8 },
  liveSub: { color: "#FCE7F3", marginTop: 4 },
  endBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.3)", paddingVertical: 14, borderRadius: 999, marginTop: 16,
  },
  endText: { color: "#fff", fontWeight: "800" },
  pollActive: { color: colors.success, fontWeight: "700", fontSize: 12 },
  pollQ: { color: colors.onSurface, fontWeight: "800", fontSize: 16, marginTop: 4 },
  pollOpt: { color: colors.onSurfaceSecondary, marginTop: 6 },
});
