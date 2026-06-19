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
  ScrollView,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/hooks/useColors";
import { chat as chatApi, type ChatRecord, ApiError } from "@/lib/api";
import { useAuth, useCanAccessFeature } from "@/lib/authContext";
import { MarkdownText } from "@/components/MarkdownText";
import { AvatarDisplay } from "@/app/profile-settings";

const PENDING_KEY = "pendingChatMessage";

function TypingIndicator({ color }: { color: string }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 280, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(d, { toValue: 0, duration: 280, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.delay(480 - i * 160),
        ])
      )
    );
    Animated.parallel(anims).start();
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: "row", gap: 5, alignItems: "center", paddingHorizontal: 4, paddingVertical: 2 }}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: d, transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] }) }] }}
        />
      ))}
    </View>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const canChat = useCanAccessFeature("aiChat");
  const { profile, refreshProfile } = useAuth();

  const [messages, setMessages] = useState<ChatRecord[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hasCompletedAnalyses, setHasCompletedAnalyses] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  // Track whether the initial load has completed so profile-change effects
  // don't double-fire on first mount (loadHistory already covers that).
  const initialLoadDone = useRef(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const loadSuggestions = useCallback(async () => {
    if (!canChat) return;
    try {
      const { suggestions: suggs, hasCompletedAnalyses: hasAnalyses } =
        await chatApi.suggestions().catch(() => ({ suggestions: [] as string[], hasCompletedAnalyses: false }));
      setSuggestions(suggs);
      setHasCompletedAnalyses(hasAnalyses);
    } catch {
      // ignore
    }
  }, [canChat]);

  const loadHistory = useCallback(async () => {
    if (!canChat) { setLoading(false); initialLoadDone.current = true; return; }
    try {
      const [{ messages: msgs }, { suggestions: suggs, hasCompletedAnalyses: hasAnalyses }] = await Promise.all([
        chatApi.history(),
        chatApi.suggestions().catch(() => ({ suggestions: [] as string[], hasCompletedAnalyses: false })),
      ]);
      setMessages(msgs);
      setSuggestions(suggs);
      setHasCompletedAnalyses(hasAnalyses);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [canChat]);

  // Refresh the profile from the server whenever this tab gains focus so the
  // context passed to Claude always reflects the latest sport / level.
  useFocusEffect(useCallback(() => {
    refreshProfile();
    loadHistory();
    AsyncStorage.getItem(PENDING_KEY).then(async (pending) => {
      if (!pending || !canChat) return;
      await AsyncStorage.removeItem(PENDING_KEY);
      // Auto-send after history has had time to load
      setTimeout(() => sendMessage(pending), 800);
    });
  }, [canChat, loadHistory, refreshProfile]));

  // When sport or level changes mid-session (e.g. user edits profile and comes
  // back to Coach), reload suggestions so the chips reflect the new sport.
  const profileSport = profile?.sport;
  const profileLevel = profile?.level;
  useEffect(() => {
    if (!initialLoadDone.current) return; // skip initial render; loadHistory covers it
    loadSuggestions();
  }, [profileSport, profileLevel, loadSuggestions]);

  async function sendMessage(content?: string) {
    const text = (content ?? input).trim();
    if (!text || sending) return;
    setInput("");

    const optimistic: ChatRecord = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);

    try {
      const { userMessage, assistantMessage } = await chatApi.send(text);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        userMessage,
        assistantMessage,
      ]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      if (e instanceof ApiError && e.code === "UPGRADE_REQUIRED") {
        router.push("/pricing");
      } else {
        Alert.alert("Message failed", "Couldn't reach your AI coach. Check your connection and try again.");
      }
    } finally {
      setSending(false);
    }
  }

  const s = StyleSheet.create({
    container:        { flex: 1, backgroundColor: colors.background },
    header:           { paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerLeft:       { flexDirection: "row", alignItems: "center", gap: 12 },
    coachAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + "30", alignItems: "center", justifyContent: "center" },
    onlineDot:        { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.success, position: "absolute", bottom: 0, right: 0, borderWidth: 2, borderColor: colors.background },
    headerTitle:      { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    headerSub:        { fontSize: 12, color: colors.success, fontFamily: "Inter_400Regular" },
    clearBtn:         { padding: 6 },
    paywall:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
    paywallIcon:      { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center", marginBottom: 20 },
    paywallTitle:     { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", marginBottom: 10 },
    paywallSub:       { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 28 },
    upgradeBtn:       { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, flexDirection: "row", alignItems: "center", gap: 8 },
    upgradeBtnText:   { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
    msgRow:           { paddingHorizontal: 14, paddingVertical: 4 },
    msgMeta:          { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 },
    userMsgMeta:      { textAlign: "right" },
    bubble:           { maxWidth: "82%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    userBubble:       { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    assistantBubble:  { alignSelf: "flex-start", backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
    userText:         { color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    typingRow:        { paddingHorizontal: 14, paddingVertical: 6 },
    typingBubble:     { alignSelf: "flex-start", backgroundColor: colors.card, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
    emptyState:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 32 },
    emptyIcon:        { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary + "1a", alignItems: "center", justifyContent: "center", marginBottom: 14 },
    emptyTitle:       { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 6, textAlign: "center" },
    emptySub:         { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19, marginBottom: 24 },
    suggestionsWrap:  { width: "100%" },
    suggestionChip:   { backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
    suggestionText:   { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 },
    chipsScroll:      { paddingHorizontal: 14, paddingBottom: 6, paddingTop: 2 },
    inlineChip:       { backgroundColor: colors.card, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 13, marginRight: 8, borderWidth: 1, borderColor: colors.border },
    inlineChipText:   { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    inputRow:         { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    textInput:        { flex: 1, backgroundColor: colors.card, borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, color: colors.foreground, fontSize: 14, fontFamily: "Inter_400Regular", borderWidth: 1, borderColor: colors.border, maxHeight: 100 },
    sendBtn:          { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    sendBtnDisabled:  { backgroundColor: colors.muted },
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
              <Text style={[s.headerSub, { color: colors.mutedForeground }]}>
                {profile?.sport && profile?.level
                  ? `${profile.sport} · ${profile.level}`
                  : "Pro feature"}
              </Text>
            </View>
          </View>
          {profile && (
            <TouchableOpacity onPress={() => router.push("/profile-settings")} activeOpacity={0.75}>
              <AvatarDisplay
                avatarUrl={profile.avatarUrl}
                name={profile.name ?? "Athlete"}
                size={36}
                colors={colors}
              />
            </TouchableOpacity>
          )}
        </View>
        <View style={s.paywall}>
          <View style={s.paywallIcon}>
            <Feather name="lock" size={32} color={colors.primary} />
          </View>
          <Text style={s.paywallTitle}>Unlock Your AI Coach</Text>
          <Text style={s.paywallSub}>
            Get personalized coaching powered by Claude AI. Discuss your form, get drill recommendations, and improve faster.
          </Text>
          <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push("/pricing")} activeOpacity={0.85}>
            <Feather name="zap" size={16} color="#fff" />
            <Text style={s.upgradeBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const canSend = input.trim().length > 0 && !sending;
  const showEmptyState = !loading && messages.length === 0;

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
            <View style={s.onlineDot} />
          </View>
          <View>
            <Text style={s.headerTitle}>AI Coach</Text>
            <Text style={s.headerSub}>
              {profile?.sport && profile?.level
                ? `${profile.sport} · ${profile.level}`
                : "Online · Ready to help"}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {profile && (
            <TouchableOpacity onPress={() => router.push("/profile-settings")} activeOpacity={0.75}>
              <AvatarDisplay
                avatarUrl={profile.avatarUrl}
                name={profile.name ?? "Athlete"}
                size={36}
                colors={colors}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => {
            Alert.alert(
              "Clear conversation",
              "This will permanently delete your entire chat history with the AI coach. This can't be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: async () => {
                    await chatApi.clear();
                    setMessages([]);
                  },
                },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : showEmptyState ? (
        <ScrollView
          contentContainerStyle={[s.emptyState, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.emptyIcon}>
            <Feather name="message-circle" size={28} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>Your AI Coach</Text>
          <Text style={s.emptySub}>
            {hasCompletedAnalyses
              ? "Ask anything about your training, form, or recovery. I have your recent session data ready."
              : "Analyze a training video first, then come back here to discuss your results with your AI coach."}
          </Text>
          {!hasCompletedAnalyses && (
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 8 }}
              onPress={() => router.push("/(tabs)/analyze" as any)}
              activeOpacity={0.85}
            >
              <Feather name="upload" size={15} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Analyze a Video</Text>
            </TouchableOpacity>
          )}
          {suggestions.length > 0 && (
            <View style={s.suggestionsWrap}>
              {suggestions.map((s_text, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.suggestionChip}
                  onPress={() => sendMessage(s_text)}
                  activeOpacity={0.75}
                >
                  <Feather name="message-square" size={14} color={colors.primary} />
                  <Text style={s.suggestionText}>{s_text}</Text>
                  <Feather name="arrow-up-right" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isUser = item.role === "user";
            const isLast = index === messages.length - 1;
            return (
              <View style={s.msgRow}>
                <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
                  <View style={[s.bubble, isUser ? s.userBubble : s.assistantBubble]}>
                    {isUser ? (
                      <Text style={s.userText}>{item.content}</Text>
                    ) : (
                      <MarkdownText text={item.content} baseSize={14} />
                    )}
                  </View>
                  {isLast && (
                    <Text style={[s.msgMeta, isUser && s.userMsgMeta]}>
                      {formatTime(item.createdAt)}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
          ListFooterComponent={sending ? (
            <View style={s.typingRow}>
              <View style={s.typingBubble}>
                <TypingIndicator color={colors.mutedForeground} />
              </View>
            </View>
          ) : null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 8, flexGrow: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Suggestion chips above input when there are some messages */}
      {!showEmptyState && messages.length > 0 && suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsScroll}
          style={{ maxHeight: 44, borderTopWidth: 1, borderTopColor: colors.border + "44" }}
          keyboardShouldPersistTaps="always"
        >
          {suggestions.map((s_text, i) => (
            <TouchableOpacity
              key={i}
              style={s.inlineChip}
              onPress={() => sendMessage(s_text)}
              activeOpacity={0.75}
            >
              <Text style={s.inlineChipText} numberOfLines={1}>{s_text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit={false}
          editable={!sending}
        />
        <TouchableOpacity
          style={[s.sendBtn, !canSend && s.sendBtnDisabled]}
          onPress={() => sendMessage()}
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
