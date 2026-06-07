import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
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

const TOTAL_STEPS = 5;

interface OnboardingState {
  sport: string;
  level: string;
  goals: string[];
  injuries: string[];
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({
    sport: "",
    level: "",
    goals: [],
    injuries: [],
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function canContinue() {
    if (step === 1) return !!state.sport;
    if (step === 2) return !!state.level;
    if (step === 3) return state.goals.length > 0;
    if (step === 4) return state.injuries.length > 0;
    return true;
  }

  async function handleContinue() {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      try {
        await updateProfile({
          sport: state.sport.toLowerCase(),
          level: (state.level.toLowerCase() as any) || "beginner",
          goals: state.goals,
          injuryConcerns: state.injuries,
        });
      } catch {
        // non-critical — continue anyway
      }
      router.replace("/(tabs)" as any);
    }
  }

  function toggleMulti(key: "goals" | "injuries", val: string) {
    setState((prev) => ({
      ...prev,
      [key]: prev[key].includes(val)
        ? prev[key].filter((v) => v !== val)
        : [...prev[key], val],
    }));
  }

  const progressPct = (step / TOTAL_STEPS) * 100;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      paddingTop: topPad + 12,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    stepLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    progressBg: {
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    progressFill: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 120,
    },
    stepTitle: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    stepSub: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 24,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      borderWidth: 1.5,
    },
    chipText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    levelCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderRadius: 14,
      borderWidth: 1.5,
      marginBottom: 10,
    },
    levelLabel: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    levelSub: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    checkCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    summaryKey: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    summaryVal: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      textAlign: "right",
      flex: 1,
      marginLeft: 16,
    },
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
    },
    continueBtn: {
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    continueBtnText: {
      color: "#fff",
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
  });

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <View style={s.backRow}>
          {step > 1 ? (
            <TouchableOpacity style={s.backBtn} onPress={() => setStep((s) => s - 1)} activeOpacity={0.7}>
              <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <Text style={s.stepLabel}>{step} of {TOTAL_STEPS}</Text>
        </View>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {step === 1 && (
          <>
            <Text style={s.stepTitle}>What's your sport?</Text>
            <Text style={s.stepSub}>We'll tailor feedback to your discipline.</Text>
            <View style={s.chipRow}>
              {SPORTS.map((sport) => {
                const active = state.sport === sport;
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[
                      s.chip,
                      {
                        backgroundColor: active ? colors.primary + "20" : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setState((p) => ({ ...p, sport }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                      {sport}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={s.stepTitle}>What's your level?</Text>
            <Text style={s.stepSub}>This helps calibrate how we frame your feedback.</Text>
            {LEVELS.map((level) => {
              const active = state.level === level.label;
              return (
                <TouchableOpacity
                  key={level.label}
                  style={[
                    s.levelCard,
                    {
                      backgroundColor: active ? colors.primary + "12" : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setState((p) => ({ ...p, level: level.label }))}
                  activeOpacity={0.75}
                >
                  <View>
                    <Text style={[s.levelLabel, { color: colors.foreground }]}>{level.label}</Text>
                    <Text style={[s.levelSub, { color: colors.mutedForeground }]}>{level.sub}</Text>
                  </View>
                  {active && (
                    <View style={[s.checkCircle, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={s.stepTitle}>What are your goals?</Text>
            <Text style={s.stepSub}>Select all that apply.</Text>
            <View style={s.chipRow}>
              {GOALS.map((goal) => {
                const active = state.goals.includes(goal);
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
                    onPress={() => toggleMulti("goals", goal)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                      {goal}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={s.stepTitle}>Any injury concerns?</Text>
            <Text style={s.stepSub}>We'll factor these into feedback and drill recommendations.</Text>
            {INJURIES.map((inj) => {
              const active = state.injuries.includes(inj);
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
                  onPress={() => toggleMulti("injuries", inj)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.levelLabel, { color: colors.foreground }]}>{inj}</Text>
                  {active && (
                    <View style={[s.checkCircle, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 5 && (
          <>
            <Text style={s.stepTitle}>You're all set!</Text>
            <Text style={s.stepSub}>Your personalized coaching profile is ready.</Text>
            {[
              { label: "Sport", value: state.sport || "—" },
              { label: "Level", value: state.level || "—" },
              { label: "Goals", value: state.goals.join(", ") || "—" },
              { label: "Injury concerns", value: state.injuries.join(", ") || "—" },
            ].map((row) => (
              <View key={row.label} style={s.summaryRow}>
                <Text style={s.summaryKey}>{row.label}</Text>
                <Text style={s.summaryVal}>{row.value}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[
            s.continueBtn,
            { backgroundColor: canContinue() ? colors.primary : colors.muted },
          ]}
          onPress={handleContinue}
          disabled={!canContinue()}
          activeOpacity={0.85}
        >
          <Text style={[s.continueBtnText, { color: canContinue() ? "#fff" : colors.mutedForeground }]}>
            {step === TOTAL_STEPS ? "Go to Dashboard →" : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
