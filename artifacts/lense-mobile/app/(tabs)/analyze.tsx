import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useColors } from "@/hooks/useColors";
import { MOCK_ATHLETE } from "@/lib/athleteData";
import type { VideoAnalysis } from "@/lib/types";

const SPORT_ICONS: Record<string, "activity" | "target" | "zap" | "wind"> = {
  weightlifting: "activity",
  basketball: "target",
  running: "zap",
  golf: "wind",
  default: "activity",
};

function getSportIcon(sport: string) {
  return SPORT_ICONS[sport] ?? SPORT_ICONS.default;
}

function getScoreColor(score: number, colors: ReturnType<typeof useColors>) {
  if (score >= 80) return colors.success;
  if (score >= 65) return colors.primary;
  return colors.warning;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ANALYSIS_STEPS = [
  "Extracting video frames...",
  "Detecting body pose...",
  "Calculating joint angles...",
  "Scoring technique...",
  "Generating report...",
];

export default function AnalyzeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>(MOCK_ATHLETE.analyses);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisDone, setAnalysisDone] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  async function handleUpload() {
    // Ask for permission
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "videos",
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled) return;

    // Start simulated analysis
    setAnalyzing(true);
    setAnalysisStep(0);
    setAnalysisDone(false);

    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setAnalysisStep(i);
      await new Promise((r) => setTimeout(r, 900));
    }

    setAnalysisDone(true);

    // Add a new mock analysis result
    await new Promise((r) => setTimeout(r, 800));

    const newAnalysis: VideoAnalysis = {
      id: `an-new-${Date.now()}`,
      title: "New Upload — Analysis",
      sport: "weightlifting",
      uploadedAt: new Date().toISOString(),
      duration: Math.floor(Math.random() * 15) + 5,
      thumbnailUrl: "",
      scores: {
        overall: 75,
        technique: 70,
        power: 84,
        balance: 72,
        consistency: 68,
        mobility: 66,
        speed: 80,
      },
      strengths: [
        "Good hip drive throughout the movement",
        "Consistent bar path with minimal deviation",
      ],
      improvements: [
        "Improve brace before initiating the pull",
        "Reduce lumbar flexion at lockout",
      ],
      tips: [
        {
          id: "new-t1",
          category: "technique",
          severity: "warning",
          title: "Brace Earlier",
          description: "You're initiating the pull before a full brace is achieved. This reduces spinal stability.",
          drill: "Practice bracing with a belt before each set. 3 deep breaths, big brace, then pull.",
        },
      ],
      injuryRisks: [
        { joint: "Lumbar Spine", risk: 48, description: "Mild flexion under load", prevention: "Reduce load 5%, focus on brace" },
      ],
      frames: [],
    };

    setAnalyses((prev) => [newAnalysis, ...prev]);
    setAnalyzing(false);
    setAnalysisDone(false);

    // Navigate to the new analysis
    router.push(`/analysis/${newAnalysis.id}`);
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    title: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 4,
    },
    uploadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 14,
      paddingHorizontal: 20,
      marginHorizontal: 20,
      marginBottom: 20,
      justifyContent: "center",
    },
    uploadBtnText: {
      color: "#fff",
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      marginHorizontal: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    cardBody: {
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    iconBg: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    cardMeta: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
      textTransform: "capitalize",
    },
    scoreCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    scoreText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    bottomScores: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingBottom: 14,
      gap: 8,
    },
    scorePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.muted,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    scorePillLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    scorePillValue: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    comparedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary + "20",
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    comparedText: {
      fontSize: 10,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(5,5,8,0.94)",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    modalCard: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 32,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalIconBg: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + "22",
      borderWidth: 2,
      borderColor: colors.primary + "66",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 8,
    },
    modalStep: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      marginBottom: 24,
    },
    stepsContainer: { width: "100%", gap: 8 },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    stepDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    stepText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    doneCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.success + "18",
      borderRadius: 12,
      padding: 14,
      marginTop: 8,
      width: "100%",
    },
    doneText: {
      color: colors.success,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
  });

  const renderItem = ({ item }: { item: VideoAnalysis }) => {
    const scoreColor = getScoreColor(item.scores.overall, colors);
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.75}
        onPress={() => router.push(`/analysis/${item.id}`)}
      >
        <View style={s.cardBody}>
          <View style={s.iconBg}>
            <Feather name={getSportIcon(item.sport)} size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardMeta}>{item.sport} · {item.duration}s · {formatDate(item.uploadedAt)}</Text>
          </View>
          <View style={[s.scoreCircle, { borderColor: scoreColor }]}>
            <Text style={[s.scoreText, { color: scoreColor }]}>{item.scores.overall}</Text>
          </View>
        </View>

        <View style={s.bottomScores}>
          {(["technique", "power", "balance"] as const).map((key) => (
            <View key={key} style={s.scorePill}>
              <Text style={s.scorePillLabel}>{key.slice(0, 4).toUpperCase()}</Text>
              <Text style={s.scorePillValue}>{item.scores[key]}</Text>
            </View>
          ))}
          {item.comparedTo && (
            <View style={s.comparedBadge}>
              <Feather name="star" size={9} color={colors.primary} />
              <Text style={s.comparedText}>{item.similarityScore}% match</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Analyses</Text>
        <Text style={s.subtitle}>{analyses.length} recordings analyzed</Text>
      </View>

      <TouchableOpacity style={s.uploadBtn} activeOpacity={0.8} onPress={handleUpload}>
        <Feather name="upload" size={18} color="#fff" />
        <Text style={s.uploadBtnText}>Upload New Video</Text>
      </TouchableOpacity>

      <FlatList
        data={analyses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={!!analyses.length}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      />

      {/* Analysis processing modal */}
      <Modal visible={analyzing} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconBg}>
              {analysisDone
                ? <Feather name="check" size={28} color={colors.success} />
                : <ActivityIndicator size="large" color={colors.primary} />
              }
            </View>

            <Text style={s.modalTitle}>
              {analysisDone ? "Analysis Complete!" : "Analyzing Video"}
            </Text>
            <Text style={s.modalStep}>
              {analysisDone ? "Your results are ready" : ANALYSIS_STEPS[analysisStep]}
            </Text>

            <View style={s.stepsContainer}>
              {ANALYSIS_STEPS.map((step, i) => {
                const done = i < analysisStep || analysisDone;
                const active = i === analysisStep && !analysisDone;
                return (
                  <View key={i} style={s.stepRow}>
                    <View style={[
                      s.stepDot,
                      {
                        backgroundColor: done
                          ? colors.success + "22"
                          : active
                            ? colors.primary + "22"
                            : colors.muted,
                      },
                    ]}>
                      {done
                        ? <Feather name="check" size={11} color={colors.success} />
                        : active
                          ? <ActivityIndicator size="small" color={colors.primary} />
                          : null
                      }
                    </View>
                    <Text style={[
                      s.stepText,
                      {
                        color: done
                          ? colors.success
                          : active
                            ? colors.foreground
                            : colors.mutedForeground,
                        fontFamily: active ? "Inter_500Medium" : "Inter_400Regular",
                      },
                    ]}>
                      {step.replace("...", "")}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
