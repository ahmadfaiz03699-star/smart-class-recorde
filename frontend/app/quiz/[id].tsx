import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import { API, getUser } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function QuizTake() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [quiz, setQuiz] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [submitted, setSubmitted] = useState<any>(null);

  useEffect(() => {
    API.get(`/quizzes/${id}`).then((r) => {
      setQuiz(r.data);
      setAnswers(new Array(r.data.questions.length).fill(-1));
      setRemaining(r.data.duration_seconds);
    });
  }, [id]);

  useEffect(() => {
    if (!quiz || submitted) return;
    const t = setInterval(() => setRemaining((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(t);
  }, [quiz, submitted]);

  useEffect(() => {
    if (remaining === 0 && quiz && !submitted) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  useEffect(() => {
    setSelected(answers[idx] === -1 ? null : answers[idx]);
  }, [idx, answers]);

  const pick = (i: number) => {
    Haptics.selectionAsync?.();
    setSelected(i);
    const copy = [...answers];
    copy[idx] = i;
    setAnswers(copy);
  };

  const submit = async () => {
    const u = await getUser();
    if (!u) return;
    try {
      const { data } = await API.post(`/quizzes/${id}/submit`, {
        user_id: u.id,
        answers,
      });
      setSubmitted(data);
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not submit quiz");
    }
  };

  if (!quiz) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top }]}>
        <Text style={{ padding: 24, color: colors.muted }}>Loading quiz…</Text>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top }]} testID="quiz-result">
        <View style={styles.resultBox}>
          <View style={styles.trophy}>
            <Icon name="trophy-outline" size={40} color="#fff" />
          </View>
          <Text style={styles.resultTitle}>Great job!</Text>
          <Text style={styles.resultScore}>{submitted.score}%</Text>
          <Text style={styles.resultSub}>
            {submitted.correct} / {submitted.total} correct
          </Text>
          <Pressable
            testID="quiz-done"
            onPress={() => router.back()}
            style={styles.doneBtn}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const q = quiz.questions[idx];
  const total = quiz.questions.length;
  const min = Math.floor(remaining / 60);
  const sec = String(remaining % 60).padStart(2, "0");

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} testID="quiz-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="quiz-back">
          <Icon name="close" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.timerBox}>
          <Icon name="clock-outline" size={16} color={colors.brandPrimary} />
          <Text style={styles.timer}>{min}:{sec}</Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={[styles.progressBar, { width: `${((idx + 1) / total) * 100}%` }]} />
      </View>
      <Text style={styles.qCount}>Question {idx + 1} of {total}</Text>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={styles.question}>{q.q}</Text>
        <View style={{ marginTop: 20, gap: 12 }}>
          {q.options.map((opt: string, i: number) => (
            <Pressable
              key={i}
              testID={`quiz-option-${i}`}
              onPress={() => pick(i)}
              style={[styles.option, selected === i && styles.optionActive]}
            >
              <Text style={[styles.optionText, selected === i && styles.optionTextActive]}>
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {idx > 0 && (
          <Pressable
            testID="quiz-prev"
            onPress={() => setIdx((i) => i - 1)}
            style={[styles.navBtn, styles.navBtnSecondary]}
          >
            <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Previous</Text>
          </Pressable>
        )}
        {idx < total - 1 ? (
          <Pressable
            testID="quiz-next"
            onPress={() => setIdx((i) => i + 1)}
            style={styles.navBtn}
          >
            <Text style={styles.navText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable testID="quiz-submit" onPress={submit} style={styles.navBtn}>
            <Text style={styles.navText}>Submit Quiz</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  timerBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  timer: { color: colors.onBrandTertiary, fontWeight: "800" },
  progressWrap: { height: 6, backgroundColor: colors.surfaceTertiary, marginHorizontal: 16, borderRadius: 3 },
  progressBar: { height: 6, backgroundColor: colors.brandPrimary, borderRadius: 3 },
  qCount: { color: colors.muted, paddingHorizontal: 16, paddingTop: 8, fontSize: 12, fontWeight: "600" },
  question: { fontSize: 22, fontWeight: "800", color: colors.onSurface, lineHeight: 30 },
  option: {
    borderWidth: 2, borderColor: colors.border, borderRadius: 999,
    paddingVertical: 16, paddingHorizontal: 20, backgroundColor: colors.surfaceSecondary,
  },
  optionActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary },
  optionText: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  optionTextActive: { color: "#fff" },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: 16, flexDirection: "row", gap: 12,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  navBtn: {
    flex: 1, backgroundColor: colors.brandPrimary, paddingVertical: 16,
    borderRadius: 999, alignItems: "center",
  },
  navBtnSecondary: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  navText: { color: "#fff", fontWeight: "800" },
  resultBox: {
    margin: 24, marginTop: 60, alignItems: "center",
    backgroundColor: colors.surfaceSecondary, padding: 32, borderRadius: 24,
    borderWidth: 1, borderColor: colors.border,
  },
  trophy: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  resultTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  resultScore: { fontSize: 60, fontWeight: "900", color: colors.brandPrimary, marginTop: 12 },
  resultSub: { color: colors.muted, marginTop: 4 },
  doneBtn: {
    marginTop: 24, backgroundColor: colors.brandPrimary, paddingHorizontal: 32,
    paddingVertical: 14, borderRadius: 999,
  },
  doneText: { color: "#fff", fontWeight: "800" },
});
