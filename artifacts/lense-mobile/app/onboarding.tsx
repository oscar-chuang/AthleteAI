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

import { useAuth } from "@/lib/authContext";
import { Logo } from "@/components/ui/Logo";

const VOLT = "#C6FF3A";
const INK  = "#07090B";
const BG   = "#07090B";
const SURF = "#111316";
const SURF2 = "#1A1D21";
const TXT  = "#F5F5F5";
const MUTED = "#8A8F98";
const BORDER = "rgba(255,255,255,0.10)";

const PRIMARY_SPORTS = [
  { sport: "Running",       sub: "Sprint · distance",  icon: "🏃" },
  { sport: "Weightlifting", sub: "Squat · deadlift",   icon: "🏋️" },
  { sport: "Basketball",    sub: "Shot · jump",        icon: "🏀" },
  { sport: "Golf",          sub: "Swing · putt",       icon: "⛳" },
  { sport: "Fencing",       sub: "Lunge · footwork",   icon: "🤺" },
];

const MORE_SPORTS = [
  "Tennis", "Soccer", "Swimming", "CrossFit", "Boxing",
  "Gymnastics", "Cycling", "Baseball", "Volleyball", "Martial Arts", "Other",
];

const LEVELS = [
  { label: "Beginner",     sub: "Just starting out" },
  { label: "Intermediate", sub: "1–3 years experience" },
  { label: "Advanced",     sub: "3+ years, competing" },
  { label: "Elite",        sub: "Professional / competitive" },
];

const GOALS = [
  "Improve technique", "Prevent injuries", "Increase performance",
  "Learn new movements", "Recovery & rehab", "Competition prep",
];

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updateProfile } = useAuth();

  const [step, setStep]           = useState(1);
  const [sport, setSport]         = useState("");
  const [showMore, setShowMore]   = useState(false);
  const [level, setLevel]         = useState("");
  const [goals, setGoals]         = useState<string[]>([]);

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function canContinue() {
    if (step === 1) return !!sport;
    if (step === 2) return !!level;
    if (step === 3) return goals.length > 0;
    return true;
  }

  async function handleContinue() {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      try {
        await updateProfile({
          sport: sport.toLowerCase(),
          level: (level.toLowerCase() as any) || "beginner",
          goals,
        });
      } catch {
        // non-critical
      }
      router.replace("/(tabs)" as any);
    }
  }

  function toggleGoal(g: string) {
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  return (
    <View style={s.container}>
      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: topPad + 16 }]}>
        <View style={s.topRow}>
          {/* Logo wordmark */}
          <View style={s.wordmark}>
            <Logo size={28} />
            <Text style={s.wordmarkText}>
              <Text style={{ color: TXT }}>Athlete</Text>
              <Text style={{ color: VOLT }}>AI</Text>
            </Text>
          </View>

          {/* Step dots */}
          <View style={s.stepDots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  s.stepDot,
                  i + 1 === step
                    ? s.stepDotActive
                    : i + 1 < step
                    ? s.stepDotDone
                    : s.stepDotInactive,
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scrollContent, { paddingBottom: bottomPad + 120 }]}
      >
        {/* Step label */}
        <Text style={s.stepLabel}>STEP {step} OF {TOTAL_STEPS}</Text>

        {/* ── STEP 1: Sport ── */}
        {step === 1 && (
          <>
            <Text style={s.heading}>What's your{"\n"}main sport?</Text>
            <Text style={s.subheading}>We tune the biomechanics model and drills to how your body should move.</Text>

            <View style={s.sportGrid}>
              {PRIMARY_SPORTS.map((item) => {
                const active = sport === item.sport;
                return (
                  <TouchableOpacity
                    key={item.sport}
                    style={[s.sportCard, active && s.sportCardActive]}
                    onPress={() => setSport(item.sport)}
                    activeOpacity={0.75}
                  >
                    {active && (
                      <View style={s.sportCheck}>
                        <Feather name="check" size={10} color={INK} />
                      </View>
                    )}
                    <Text style={s.sportIcon}>{item.icon}</Text>
                    <Text style={[s.sportName, active && { color: VOLT }]}>{item.sport}</Text>
                    <Text style={s.sportSub}>{item.sub}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* More sports tile */}
              <TouchableOpacity
                style={[s.sportCard, s.moreSportsCard, showMore && { borderColor: VOLT }]}
                onPress={() => setShowMore((v) => !v)}
                activeOpacity={0.75}
              >
                <Text style={[s.sportIcon, { color: VOLT }]}>+</Text>
                <Text style={[s.sportName, { color: TXT }]}>More sports</Text>
                <Text style={s.sportSub}>Tennis, soccer & 20+</Text>
              </TouchableOpacity>
            </View>

            {showMore && (
              <View style={s.chipRow}>
                {MORE_SPORTS.map((sp) => {
                  const active = sport === sp;
                  return (
                    <TouchableOpacity
                      key={sp}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setSport(sp)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipText, active && { color: VOLT }]}>{sp}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── STEP 2: Level ── */}
        {step === 2 && (
          <>
            <Text style={s.heading}>What's your{"\n"}experience level?</Text>
            <Text style={s.subheading}>This helps calibrate how we frame your feedback.</Text>

            {LEVELS.map((item) => {
              const active = level === item.label;
              return (
                <TouchableOpacity
                  key={item.label}
                  style={[s.levelCard, active && s.levelCardActive]}
                  onPress={() => setLevel(item.label)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.levelName, active && { color: VOLT }]}>{item.label}</Text>
                    <Text style={s.levelSub}>{item.sub}</Text>
                  </View>
                  {active && (
                    <View style={s.sportCheck}>
                      <Feather name="check" size={12} color={INK} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* ── STEP 3: Goals ── */}
        {step === 3 && (
          <>
            <Text style={s.heading}>What are{"\n"}your goals?</Text>
            <Text style={s.subheading}>Select all that apply.</Text>

            <View style={s.chipRow}>
              {GOALS.map((g) => {
                const active = goals.includes(g);
                return (
                  <TouchableOpacity
                    key={g}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => toggleGoal(g)}
                    activeOpacity={0.75}
                  >
                    {active && (
                      <Feather name="check" size={12} color={VOLT} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[s.chipText, active && { color: VOLT }]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View style={[s.bottomBar, { paddingBottom: bottomPad + 20 }]}>
        {step > 1 && (
          <TouchableOpacity style={s.backBtn} onPress={() => setStep((s) => s - 1)} activeOpacity={0.7}>
            <Feather name="arrow-left" size={16} color={MUTED} />
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.continueBtn, !canContinue() && s.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue()}
          activeOpacity={0.85}
        >
          <Text style={[s.continueBtnText, !canContinue() && { color: MUTED }]}>
            {step === TOTAL_STEPS ? "Go to Dashboard" : "Continue"}{" →"}
          </Text>
        </TouchableOpacity>
        {step === 1 && (
          <TouchableOpacity onPress={() => router.replace("/auth/login" as any)} activeOpacity={0.7} style={{ alignItems: "center", marginTop: 14 }}>
            <Text style={s.alreadyLink}>I already have an account</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG },
  topBar:        { paddingHorizontal: 20, paddingBottom: 8 },
  topRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark:      { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmarkText:  { fontSize: 18, fontFamily: "Inter_700Bold" },
  stepDots:      { flexDirection: "row", gap: 6 },
  stepDot:       { width: 8, height: 8, borderRadius: 4 },
  stepDotActive: { backgroundColor: VOLT, width: 20 },
  stepDotDone:   { backgroundColor: VOLT + "66" },
  stepDotInactive: { backgroundColor: SURF2 },

  scrollContent:  { paddingHorizontal: 20, paddingTop: 24 },
  stepLabel:      { fontSize: 11, fontFamily: "Inter_600SemiBold", color: VOLT, letterSpacing: 1.5, marginBottom: 14 },
  heading:        { fontSize: 32, fontFamily: "Archivo_800ExtraBold", color: TXT, letterSpacing: -0.5, lineHeight: 38, marginBottom: 12 },
  subheading:     { fontSize: 14, color: MUTED, fontFamily: "Inter_400Regular", marginBottom: 28, lineHeight: 20 },

  sportGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sportCard: {
    width: "47.5%",
    backgroundColor: SURF,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 14,
    minHeight: 90,
    position: "relative",
  },
  sportCardActive: { borderColor: VOLT, backgroundColor: VOLT + "10" },
  moreSportsCard:  { justifyContent: "center" },
  sportCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: VOLT,
    alignItems: "center",
    justifyContent: "center",
  },
  sportIcon: { fontSize: 22, marginBottom: 6 },
  sportName: { fontSize: 14, fontFamily: "Inter_700Bold", color: TXT, marginBottom: 2 },
  sportSub:  { fontSize: 11, color: MUTED, fontFamily: "Inter_400Regular" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURF,
  },
  chipActive: { borderColor: VOLT, backgroundColor: VOLT + "10" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: MUTED },

  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURF,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 10,
  },
  levelCardActive: { borderColor: VOLT, backgroundColor: VOLT + "10" },
  levelName: { fontSize: 15, fontFamily: "Inter_700Bold", color: TXT, marginBottom: 2 },
  levelSub:  { fontSize: 12, color: MUTED, fontFamily: "Inter_400Regular" },

  bottomBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 10,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, alignSelf: "flex-start" },
  backBtnText: { fontSize: 13, color: MUTED, fontFamily: "Inter_400Regular" },
  continueBtn: {
    backgroundColor: VOLT,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnDisabled: { backgroundColor: SURF2, opacity: 0.6 },
  continueBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: INK },
  alreadyLink: { fontSize: 13, color: MUTED, fontFamily: "Inter_400Regular" },
});
