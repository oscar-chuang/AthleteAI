import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { MOCK_CHAT } from "@/lib/athleteData";
import type { ChatMessage } from "@/lib/types";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([...MOCK_CHAT]);
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  function sendMessage() {
    if (!input.trim()) return;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    const reply: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: "Great question! I'm analyzing your performance data to give you a personalized recommendation. Upload your latest training video for a more detailed breakdown.",
      timestamp: new Date(Date.now() + 500).toISOString(),
    };
    setMessages((prev) => [...prev, newMsg, reply]);
    setInput("");
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
      gap: 12,
    },
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
    msgRow: {
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    bubble: {
      maxWidth: "80%",
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    assistantBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userText: { color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    assistantText: { color: colors.foreground, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    refBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
    },
    refText: { fontSize: 10, color: colors.primary, fontFamily: "Inter_400Regular" },
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
    dateLabel: {
      alignSelf: "center",
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginVertical: 8,
    },
  });

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={s.msgRow}>
        <View style={[s.bubble, isUser ? s.userBubble : s.assistantBubble]}>
          <Text style={isUser ? s.userText : s.assistantText}>{item.content}</Text>
          {item.referencedAnalysis && (
            <View style={s.refBadge}>
              <Feather name="link" size={9} color={colors.primary} />
              <Text style={s.refText}>ref: {item.referencedAnalysis}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const canSend = input.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={s.header}>
        <View style={s.coachAvatar}>
          <Feather name="cpu" size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={s.headerTitle}>AI Coach</Text>
          <Text style={s.headerSub}>● Online</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 12 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[s.inputRow, { paddingBottom: 10 + (Platform.OS === "web" ? 84 + 34 : insets.bottom + 60 > 120 ? insets.bottom : insets.bottom + 4) }]}>
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
        />
        <TouchableOpacity
          style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <Feather name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
