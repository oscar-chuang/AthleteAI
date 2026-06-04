import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

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

export default function AnalyzeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const analyses = MOCK_ATHLETE.analyses;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

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

      <TouchableOpacity style={s.uploadBtn} activeOpacity={0.8}>
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
    </View>
  );
}
