import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { chat as chatApi, type ChatRecord, ApiError } from "@/lib/api";
import { useCanAccessFeature } from "@/lib/authContext";
import colors from "@/constants/colors";

const C = colors.light;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const canChat = useCanAccessFeature("aiChat");

  const [messages, setMessages] = useState<ChatRecord[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const loadHistory = useCallback(async () => {
    if (!canChat) { setLoading(false); return; }
    try {
      const { messages: msgs } = await chatApi.history();
      setMessages(msgs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [canChat]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");

    const optimistic: ChatRecord = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);

    try {
      const { userMessage, assistantMessage } = await chatApi.send(content);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        userMessage,
        assistantMessage,
      ]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      if (e instanceof ApiError && e.code === "UPGRADE_REQUIRED") {
        router.push("/pricing");
      }
    } finally {
      setSending(false);
    }
  }

  if (!canChat) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: topPad + 16 }]}>
          <View style={s.headerLeft}>
            <View style={s.coachAvatar}>
              <Feather name="cpu" size={20} color={C.volt} />
            </View>
            <View>
              <Text style={s.headerTitle}>Atlas AI Coach</Text>
              <Text style={[s.headerSub, { color: C.textSecondary }]}>Pro feature</Text>
            </View>
          </View>
        </View>
        <View style={s.paywall}>
          <View style={s.paywallIcon}>
            <Feather name="lock" size={32} color={C.volt} />
          </View>
          <Text style={s.paywallTitle}>Unlock Your AI Coach</Text>
          <Text style={s.paywallSub}>
            Get personalized coaching powered by Claude AI. Discuss your form, get drill recommendations, and improve faster.
          </Text>
          <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push("/pricing")} activeOpacity={0.85}>
            <Feather name="zap" size={16} color={C.ink} />
            <Text style={s.upgradeBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const canSend = input.trim().length > 0 && !sending;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <View style={s.headerLeft}>
          <View style={s.coachAvatar}>
            <Feather name="cpu" size={20} color={C.volt} />
          </View>
          <View>
            <Text style={s.headerTitle}>Atlas AI Coach</Text>
            <Text style={s.headerSub}>● Online</Text>
          </View>
        </View>
        <TouchableOpacity style={s.clearBtn} onPress={async () => { await chatApi.clear(); setMessages([]); }}>
          <Feather name="trash-2" size={18} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.volt} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isUser = item.role === "user";
            return (
              <View style={s.msgRow}>
                <View style={[s.bubble, isUser ? s.userBubble : s.assistantBubble]}>
                  <Text style={isUser ? s.userText : s.assistantText}>{item.content}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center", gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(198,255,58,0.1)", alignItems: "center", justifyContent: "center" }}>
                <Feather name="message-circle" size={28} color={C.volt} />
              </View>
              <Text style={{ fontFamily: "Archivo_800ExtraBold", fontSize: 20, color: C.textPrimary, textAlign: "center" }}>Ask Atlas anything</Text>
              <Text style={{ color: C.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                Form feedback, drill recommendations, recovery tips — your AI coach is here.
              </Text>
            </View>
          }
          ListFooterComponent={sending ? (
            <View style={s.msgRow}>
              <View style={s.typingBubble}>
                <View style={s.typingDot} />
                <View style={s.typingDot} />
                <View style={s.typingDot} />
              </View>
            </View>
          ) : null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 12, flexGrow: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={[s.inputRow, { paddingBottom: 10 + (Platform.OS === "web" ? 84 + 34 : insets.bottom + 84 + 4) }]}>
        <TextInput
          style={s.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your AI coach..."
          placeholderTextColor={C.textTertiary}
          multiline
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
          editable={!sending}
        />
        <TouchableOpacity
          style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color={C.ink} size="small" />
          ) : (
            <Feather name="send" size={16} color={C.ink} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  coachAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(198,255,58,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.textPrimary },
  headerSub: { fontSize: 12, color: C.success, fontFamily: "Inter_400Regular" },
  clearBtn: { padding: 4 },
  paywall: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  paywallIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(198,255,58,0.12)",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  paywallTitle: { fontSize: 22, fontFamily: "Archivo_800ExtraBold", color: C.textPrimary, textAlign: "center", marginBottom: 10 },
  paywallSub: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 28 },
  upgradeBtn: {
    backgroundColor: C.volt, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  upgradeBtnText: { color: C.ink, fontSize: 15, fontFamily: "Inter_700Bold" },
  msgRow: { paddingHorizontal: 16, paddingVertical: 6 },
  bubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { alignSelf: "flex-end", backgroundColor: C.volt, borderBottomRightRadius: 4 },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: C.surface2,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  userText: { color: C.ink, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  assistantText: { color: C.textPrimary, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  typingBubble: {
    alignSelf: "flex-start", backgroundColor: C.surface2,
    borderRadius: 18, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textSecondary },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.background,
  },
  textInput: {
    flex: 1, backgroundColor: C.surface2,
    borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10,
    color: C.textPrimary, fontSize: 14, fontFamily: "Inter_400Regular",
    borderWidth: 1, borderColor: C.border, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.volt, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.surface3 },
});
