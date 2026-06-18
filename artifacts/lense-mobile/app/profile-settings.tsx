import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/authContext";

const SPORTS = [
  "Powerlifting", "Olympic Weightlifting", "Running", "Swimming",
  "Basketball", "Soccer", "Tennis", "Golf", "CrossFit",
  "Gymnastics", "Boxing", "Cycling", "Football", "Baseball",
  "Volleyball", "Martial Arts", "Other",
];

const LEVELS = [
  { label: "Beginner", sub: "Just starting out" },
  { label: "Intermediate", sub: "1–3 years experience" },
  { label: "Advanced", sub: "3+ years, competing" },
  { label: "Elite", sub: "Professional / competitive athlete" },
];

const GOALS = [
  "Improve technique", "Prevent injuries", "Increase performance",
  "Learn new movements", "Recovery & rehab", "Competition prep",
];

const INJURIES = [
  "No current injuries", "Lower back", "Knee", "Shoulder",
  "Hip", "Ankle", "Elbow", "Neck",
];

const WEEKLY_GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export default function ProfileSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, updateProfile, logout } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [name, setName] = useState(profile?.name ?? user?.name ?? "");
  const [sport, setSport] = useState(() => {
    if (!profile?.sport) return "";
    const raw = profile.sport;
    const match = SPORTS.find((s) => s.toLowerCase() === raw.toLowerCase());
    return match ?? raw;
  });
  const [level, setLevel] = useState(() => {
    if (!profile?.level) return "";
    const raw = profile.level;
    const match = LEVELS.find((l) => l.label.toLowerCase() === raw.toLowerCase());
    return match?.label ?? "";
  });
  const [goals, setGoals] = useState<string[]>(profile?.goals ?? []);
  const [injuries, setInjuries] = useState<string[]>(profile?.injuryConcerns ?? []);
  const [weeklyGoal, setWeeklyGoal] = useState(profile?.weeklyGoal ?? 3);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleGoal(val: string) {
    setGoals((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  function toggleInjury(val: string) {
    setInjuries((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        sport: sport ? sport.toLowerCase() : undefined,
        level: level ? (level.toLowerCase() as any) : undefined,
        goals,
        injuryConcerns: injuries,
        weeklyGoal,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/");
          },
        },
      ]
    );
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 12,
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: bottomPad + 120,
    },

    section: { marginBottom: 28 },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.9,
      marginBottom: 10,
    },

    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },

    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 22,
      borderWidth: 1.5,
    },
    chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

    levelCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      marginBottom: 9,
    },
    levelLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    levelSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    weeklyRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    weeklyBtn: {
      width: 66,
      height: 66,
      borderRadius: 14,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    weeklyNum: { fontSize: 24, fontFamily: "Inter_700Bold" },
    weeklyLabel: { fontSize: 9, fontFamily: "Inter_400Regular", marginTop: 1 },

    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: bottomPad + 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    saveBtn: {
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

    logoutBtn: {
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.destructive + "14",
      borderWidth: 1,
      borderColor: colors.destructive + "44",
    },
    logoutBtnText: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.destructive,
    },

    errorBanner: {
      backgroundColor: colors.destructive + "14",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.destructive + "33",
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    savedBanner: {
      backgroundColor: colors.success + "14",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.success + "33",
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
  });

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Status banners ── */}
        {error && (
          <View style={s.errorBanner}>
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
              {error}
            </Text>
          </View>
        )}
        {saved && (
          <View style={s.savedBanner}>
            <Feather name="check-circle" size={15} color={colors.success} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
              Changes saved!
            </Text>
          </View>
        )}

        {/* ── Name ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Alex Johnson"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* ── Sport ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Sport</Text>
          <View style={s.chipRow}>
            {SPORTS.map((sp) => {
              const active = sport === sp;
              return (
                <TouchableOpacity
                  key={sp}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? colors.primary + "20" : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSport(sp)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {sp}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Level ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Experience Level</Text>
          {LEVELS.map((lv) => {
            const active = level === lv.label;
            return (
              <TouchableOpacity
                key={lv.label}
                style={[
                  s.levelCard,
                  {
                    backgroundColor: active ? colors.primary + "12" : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setLevel(lv.label)}
                activeOpacity={0.75}
              >
                <View>
                  <Text style={[s.levelLabel, { color: colors.foreground }]}>{lv.label}</Text>
                  <Text style={[s.levelSub, { color: colors.mutedForeground }]}>{lv.sub}</Text>
                </View>
                {active && (
                  <View style={[s.checkCircle, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={13} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Goals ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Training Goals</Text>
          <View style={s.chipRow}>
            {GOALS.map((goal) => {
              const active = goals.includes(goal);
              return (
                <TouchableOpacity
                  key={goal}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? colors.primary + "20" : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => toggleGoal(goal)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {goal}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Injury Concerns ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Injury Concerns</Text>
          {INJURIES.map((inj) => {
            const active = injuries.includes(inj);
            return (
              <TouchableOpacity
                key={inj}
                style={[
                  s.levelCard,
                  {
                    backgroundColor: active ? colors.primary + "12" : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => toggleInjury(inj)}
                activeOpacity={0.75}
              >
                <Text style={[s.levelLabel, { color: colors.foreground }]}>{inj}</Text>
                {active && (
                  <View style={[s.checkCircle, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={13} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Weekly Goal ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Weekly Training Goal</Text>
          <View style={s.weeklyRow}>
            {WEEKLY_GOAL_OPTIONS.map((n) => {
              const active = weeklyGoal === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[
                    s.weeklyBtn,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary + "18" : colors.card,
                    },
                  ]}
                  onPress={() => setWeeklyGoal(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.weeklyNum, { color: active ? colors.primary : colors.foreground }]}>
                    {n}
                  </Text>
                  <Text style={[s.weeklyLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {n === 1 ? "session" : "sessions"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom actions ── */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: saving ? colors.primary + "88" : colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="check" size={16} color="#fff" />
          )}
          <Text style={s.saveBtnText}>{saving ? "Saving…" : "Save Changes"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={s.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
