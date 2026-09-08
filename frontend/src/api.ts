import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

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
