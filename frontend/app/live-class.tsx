import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { API, getUser, type User } from "@/src/api";
import { colors } from "@/src/theme-tokens";

function toEmbed(url: string) {
  if (!url) return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]+)/);
  const id = m ? m[1] : url;
  return `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1`;
}

export default function LiveClass() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [live, setLive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [poll, setPoll] = useState<any>(null);
  const [voted, setVoted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const u = await getUser();
    setUser(u);
    const [l, chats, p] = await Promise.all([
      API.get("/live/current").catch(() => ({ data: null })),
      API.get("/chat", { params: { live_id: null, limit: 30 } }).catch(() => ({ data: [] })),
      API.get("/polls/current").catch(() => ({ data: null })),
    ]);
    setLive(l.data);
    setMessages(chats.data || []);
    setPoll(p.data);
    setVoted(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const t = setInterval(async () => {
      const [chats, p] = await Promise.all([
        API.get("/chat", { params: { live_id: null, limit: 30 } }).catch(() => ({ data: [] })),
        API.get("/polls/current").catch(() => ({ data: null })),
      ]);
      setMessages(chats.data || []);
      setPoll(p.data);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const send = async () => {
    if (!msg.trim() || !user) return;
    await API.post("/chat", {
      user_id: user.id,
      user_name: user.name,
      message: msg.trim(),
      live_id: live?.id,
    });
    setMsg("");
    const chats = await API.get("/chat", { params: { limit: 30 } });
    setMessages(chats.data || []);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const vote = async (idx: number) => {
    if (!user || !poll || voted) return;
    try {
      const { data } = await API.post(`/polls/${poll.id}/vote`, {
        user_id: user.id,
        option_index: idx,
      });
      setPoll(data);
      setVoted(true);
    } catch {
      setVoted(true);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="live-class-screen">
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} testID="live-back" style={styles.iconBtn}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{live?.title || "No live class"}</Text>
          <Text style={styles.sub}>{live?.subject || "—"}</Text>
        </View>
        {live && (
          <View style={styles.liveBadge}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      <View style={styles.videoBox}>
        {live?.youtube_url ? (
          <WebView
            source={{ uri: toEmbed(live.youtube_url) }}
            style={{ flex: 1, backgroundColor: "#000" }}
            allowsInlineMediaPlayback
            javaScriptEnabled
          />
        ) : (
          <View style={styles.waiting}>
            <Icon name="broadcast-off" size={40} color="#fff" />
            <Text style={{ color: "#fff", marginTop: 8 }}>Stream not started yet</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.chatHeader}>
          <Icon name="chat-outline" size={18} color={colors.onSurface} />
          <Text style={styles.chatTitle}>Live Discussion</Text>
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.chatList}>
          {messages.length === 0 ? (
            <Text style={styles.emptyChat}>Be the first to say hi!</Text>
          ) : (
            messages.map((m) => (
              <View key={m.id} style={styles.msg}>
                <Text style={styles.msgAuthor}>{m.user_name}</Text>
                <Text style={styles.msgText}>{m.message}</Text>
              </View>
            ))
          )}
        </ScrollView>
        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            testID="chat-input"
            value={msg}
            onChangeText={setMsg}
            placeholder="Type your doubt…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable testID="chat-send" onPress={send} style={styles.sendBtn}>
            <Icon name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Poll modal */}
      <Modal visible={!!poll} transparent animationType="slide" testID="poll-modal">
        <View style={styles.pollBackdrop}>
          <View style={styles.pollCard}>
            <Text style={styles.pollLabel}>LIVE POLL</Text>
            <Text style={styles.pollQ}>{poll?.question}</Text>
            {poll?.options.map((opt: string, i: number) => {
              const total = poll.votes.reduce((a: number, b: number) => a + b, 0) || 1;
              const pct = Math.round((poll.votes[i] / total) * 100);
              return (
                <Pressable
                  key={i}
                  testID={`poll-option-${i}`}
                  onPress={() => vote(i)}
                  style={styles.pollOpt}
                >
                  {voted && (
                    <View
                      style={[styles.pollFill, { width: `${pct}%` }]}
                    />
                  )}
                  <Text style={styles.pollOptText}>{opt}</Text>
                  {voted && <Text style={styles.pollPct}>{pct}%</Text>}
                </Pressable>
              );
            })}
            <Pressable testID="poll-close" onPress={() => setPoll(null)} style={styles.pollClose}>
              <Text style={{ color: colors.muted, fontWeight: "700" }}>Hide</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBtn: { padding: 4 },
  title: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  sub: { color: colors.muted, fontSize: 12 },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.brandSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  videoBox: { height: 220, backgroundColor: "#000" },
  waiting: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#111827" },
  chatHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  chatTitle: { fontWeight: "800", color: colors.onSurface },
  chatList: { padding: 12, gap: 8 },
  emptyChat: { textAlign: "center", color: colors.muted, paddingVertical: 20 },
  msg: {
    backgroundColor: colors.surfaceSecondary, padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  msgAuthor: { fontWeight: "800", color: colors.brandPrimary, fontSize: 12 },
  msgText: { color: colors.onSurface, marginTop: 2 },
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
  pollBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  pollCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10,
  },
  pollLabel: { color: colors.brandSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  pollQ: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  pollOpt: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 999, paddingVertical: 14,
    paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  pollFill: {
    position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.brandTertiary,
  },
  pollOptText: { fontWeight: "700", color: colors.onSurface },
  pollPct: { fontWeight: "800", color: colors.brandPrimary },
  pollClose: { alignSelf: "center", padding: 10 },
});
