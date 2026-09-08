import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
export const API = axios.create({ baseURL: `${BASE}/api`, timeout: 30000 });

export type User = {
  id: string;
  name: string;
  student_id?: string;
  role: "student" | "admin";
  enrolled_batches: string[];
};

const USER_KEY = "ahmad_user";

export async function saveUser(u: User) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
}
export async function getUser(): Promise<User | null> {
  const s = await AsyncStorage.getItem(USER_KEY);
  return s ? (JSON.parse(s) as User) : null;
}
export async function clearUser() {
  await AsyncStorage.removeItem(USER_KEY);
}

export const streamAI = async (
  endpoint: "/ai/chat" | "/ai/analyze",
  body: any,
  onToken: (t: string) => void,
) => {
  const res = await fetch(`${BASE}/api${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) {
    const text = await res.text();
    onToken(text);
    return;
  }
  const reader = (res.body as any).getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    onToken(chunk);
  }
};

export const streamPhoto = async (
  imageUri: string,
  question: string,
  sessionId: string,
  onToken: (t: string) => void,
) => {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(imageUri)).blob();
    form.append("file", blob, "photo.jpg");
  } else {
    form.append("file", { uri: imageUri, name: "photo.jpg", type: "image/jpeg" } as any);
  }
  form.append("session_id", sessionId);
  form.append("question", question);
  const res = await fetch(`${BASE}/api/ai/photo`, { method: "POST", body: form });
  if (!res.body) {
    const text = await res.text();
    onToken(text);
    return;
  }
  const reader = (res.body as any).getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onToken(decoder.decode(value, { stream: true }));
  }
};

export async function registerForPush(userId: string) {
  if (Platform.OS === "web") return;
  try {
    const perms = await Notifications.requestPermissionsAsync();
    if (perms.status !== "granted") return;
    const token = await Notifications.getDevicePushTokenAsync();
    await API.post("/register-push", {
      user_id: userId,
      platform: Platform.OS,
      device_token: token.data,
    });
  } catch (e) {
    // best-effort
  }
}
