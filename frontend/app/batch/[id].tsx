import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, Linking, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import QRCode from "react-native-qrcode-svg";
import { API, getUser, saveUser } from "@/src/api";
import { colors } from "@/src/theme-tokens";

export default function BatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [batch, setBatch] = useState<any>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await API.get(`/batches/${id}`);
      setBatch(data);
      const u = await getUser();
      if (u) setEnrolled(u.enrolled_batches?.includes(id as string));
    })();
  }, [id]);

  const startCheckout = async () => {
    const u = await getUser();
    if (!u) return;
    setBusy(true);
    try {
      const { data } = await API.post(`/batches/${id}/checkout`, { user_id: u.id });
      setCheckout(data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const openUpiApp = async () => {
    if (!checkout) return;
    try {
      const supported = await Linking.canOpenURL(checkout.upi_url);
      if (supported) {
        Linking.openURL(checkout.upi_url);
      } else {
        Alert.alert("UPI app not found", "Copy the VPA and pay manually via any UPI app.");
      }
    } catch {
      Alert.alert("Could not open UPI app");
    }
  };

  const confirmPayment = async () => {
    if (!checkout) return;
    setVerifying(true);
    try {
      await API.post(`/payments/${checkout.payment_id}/confirm`);
      // Refresh user
      const u = await getUser();
      if (u) {
        const fresh = await API.get(`/users/${u.id}`);
        await saveUser(fresh.data);
      }
      setEnrolled(true);
      setCheckout(null);
      Alert.alert("Enrolled!", `You now have access to ${batch?.title}`);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Confirmation failed");
    } finally {
      setVerifying(false);
    }
  };

  if (!batch) {
    return <View style={[styles.wrap, { paddingTop: insets.top }]}><Text style={{ padding: 24 }}>Loading…</Text></View>;
  }

  return (
    <View style={styles.wrap} testID="batch-detail">
      <ScrollView>
        <View style={{ height: 320 }}>
          <Image source={{ uri: batch.hero_image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent", "rgba(17,24,39,0.95)"]} style={StyleSheet.absoluteFillObject} />
          <Pressable
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            testID="batch-back"
          >
            <Icon name="chevron-left" size={26} color="#fff" />
          </Pressable>
          <View style={styles.heroText}>
            <Text style={styles.heroSubject}>{batch.subject}</Text>
            <Text style={styles.heroTitle}>{batch.title}</Text>
            <View style={styles.heroMeta}>
              <MetaChip icon="account-tie" text={batch.instructor} />
              <MetaChip icon="video-outline" text={`${batch.lessons} lessons`} />
              <MetaChip icon="calendar-range" text={`${batch.duration_weeks} weeks`} />
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          <View>
            <Text style={styles.sectionTitle}>About this batch</Text>
            <Text style={styles.body}>{batch.description}</Text>
          </View>
          <View style={styles.perksCard}>
            <Perk icon="broadcast" text="Weekly live doubt sessions" />
            <Perk icon="clipboard-check-outline" text="Timed quizzes & mock tests" />
            <Perk icon="robot-happy-outline" text="AI Tutor for instant help" />
            <Perk icon="file-pdf-box" text="Downloadable notes & PDFs" />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <Text style={styles.price}>₹ {batch.price}</Text>
          <Text style={styles.priceSub}>one-time · UPI</Text>
        </View>
        {enrolled ? (
          <View style={[styles.cta, { backgroundColor: colors.success }]} testID="enrolled-badge">
            <Icon name="check" size={18} color="#fff" />
            <Text style={styles.ctaText}>Enrolled</Text>
          </View>
        ) : (
          <Pressable
            testID="buy-batch-button"
            onPress={startCheckout}
            disabled={busy}
            style={[styles.cta, busy && { opacity: 0.6 }]}
          >
            <Icon name="cellphone-nfc" size={18} color="#fff" />
            <Text style={styles.ctaText}>{busy ? "Loading…" : "Pay via UPI"}</Text>
          </Pressable>
        )}
      </View>

      <Modal
        visible={!!checkout}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckout(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Pay ₹ {checkout?.amount} via UPI</Text>
            <Text style={styles.modalSub}>Scan or tap any UPI app</Text>

            {checkout?.upi_url && (
              <View style={styles.qrWrap}>
                <QRCode value={checkout.upi_url} size={180} backgroundColor="#FFFFFF" color="#111827" />
              </View>
            )}

            <View style={styles.vpaBox}>
              <Text style={styles.vpaLabel}>UPI ID</Text>
              <Text style={styles.vpaValue}>{checkout?.vpa}</Text>
            </View>

            <Pressable testID="open-upi-app" onPress={openUpiApp} style={styles.upiBtn}>
              <Icon name="cellphone-arrow-down" size={18} color="#fff" />
              <Text style={styles.upiBtnText}>Open UPI App</Text>
            </Pressable>

            <Pressable
              testID="confirm-payment"
              onPress={confirmPayment}
              disabled={verifying}
              style={[styles.confirmBtn, verifying && { opacity: 0.6 }]}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="check-circle-outline" size={18} color="#fff" />
                  <Text style={styles.confirmText}>I have paid — Verify</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={() => setCheckout(null)} style={styles.cancelBtn}>
              <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetaChip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaChip}>
      <Icon name={icon} size={13} color="#fff" />
      <Text style={styles.metaChipText}>{text}</Text>
    </View>
  );
}

function Perk({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.perkRow}>
      <View style={styles.perkIcon}>
        <Icon name={icon} size={18} color={colors.brandPrimary} />
      </View>
      <Text style={styles.perkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  backBtn: {
    position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
  },
  heroText: { position: "absolute", left: 20, right: 20, bottom: 20 },
  heroSubject: { color: "#D1FAE5", fontWeight: "800", letterSpacing: 0.5 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 },
  heroMeta: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  metaChipText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginBottom: 6 },
  body: { color: colors.onSurfaceSecondary, lineHeight: 22 },
  perksCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  perkIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  perkText: { color: colors.onSurface, fontWeight: "600" },
  footer: {
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 12,
  },
  price: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  priceSub: { color: colors.muted, fontSize: 12 },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface, padding: 20, paddingBottom: 34,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, alignItems: "center", gap: 12,
  },
  modalHandle: { width: 44, height: 5, backgroundColor: colors.borderStrong, borderRadius: 3 },
  modalTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface, marginTop: 6 },
  modalSub: { color: colors.muted },
  qrWrap: {
    padding: 12, borderRadius: 20, backgroundColor: "#fff",
    borderWidth: 1, borderColor: colors.border,
  },
  vpaBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceTertiary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  vpaLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  vpaValue: { color: colors.onSurface, fontWeight: "800", fontSize: 15 },
  upiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: 999,
    alignSelf: "stretch",
  },
  upiBtnText: { color: "#fff", fontWeight: "800" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brandSecondary, paddingVertical: 14, borderRadius: 999,
    alignSelf: "stretch",
  },
  confirmText: { color: "#fff", fontWeight: "800" },
  cancelBtn: { paddingVertical: 8 },
});
