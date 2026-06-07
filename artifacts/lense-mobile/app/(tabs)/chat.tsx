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

import { useColors } from "@/hooks/useColors";
import { chat as chatApi, type ChatRecord, ApiError } from "@/lib/api";
import { useCanAccessFeature } from "@/lib/authContext";

export default function ChatScreen() {
  const colors = useColors();
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

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    coachAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    headerSub: { fontSize: 12, color: colors.success, fontFamily: "Inter_400Regular" },
    clearBtn: { padding: 4 },
    paywall: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    paywallIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    paywallTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", marginBottom: 10 },
    paywallSub: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 28 },
    upgradeBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 32,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    upgradeBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
    msgRow: { paddingHorizontal: 16, paddingVertical: 6 },
    bubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    userBubble: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    assistantBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userText: { color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    assistantText: { color: colors.foreground, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    typingBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    textInput: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      color: colors.foreground,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 100,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: { backgroundColor: colors.muted },
  });

  if (!canChat) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.coachAvatar}>
              <Feather name="cpu" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={s.headerTitle}>AI Coach</Text>
              <Text style={[s.headerSub, { color: colors.mutedForeground }]}>Pro feature</Text>
            </View>
          </View>
        </View>
        <View style={s.paywall}>
          <View style={s.paywallIcon}>
            <Feather name="lock" size={32} color={colors.primary} />
          </View>
          <Text style={s.paywallTitle}>Unlock Your AI Coach</Text>
          <Text style={s.paywallSub}>
            Get personalized coaching powered by Claude AI. Discuss your form, get drill recommendations, and improve faster.
          </Text>
          <TouchableOpacity
            style={s.upgradeBtn}
            onPress={() => router.push("/pricing")}
            activeOpacity={0.85}
          >
            <Feather name="zap" size={16} color="#fff" />
            <Text style={s.upgradeBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const canSend = input.trim().length > 0 && !sending;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.coachAvatar}>
            <Feather name="cpu" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={s.headerTitle}>AI Coach</Text>
            <Text style={s.headerSub}>● Online</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.clearBtn}
          onPress={async () => { await chatApi.clear(); setMessages([]); }}
        >
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
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
            <View style={{ padding: 32, alignItems: "center" }}>
              <Feather name="message-circle" size={32} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
                Ask your AI coach anything about your training, form, or recovery.
              </Text>
            </View>
          }
          ListFooterComponent={sending ? (
            <View style={[s.msgRow]}>
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

      <View style={[s.inputRow, { paddingBottom: 10 + (Platform.OS === "web" ? 84 + 34 : insets.bottom + 4) }]}>
        <TextInput
          style={s.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your AI coach..."
          placeholderTextColor={colors.mutedForeground}
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
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Feather name="send" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
