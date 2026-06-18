import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  worstMetric: string;
  worstScore: number;
  topTipTitle?: string;
}

export function CoachTakeawayCard({ worstMetric, worstScore, topTipTitle }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.primary + "0e", borderColor: colors.primary + "33" }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="message-circle" size={15} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Coach Takeaway</Text>
      </View>

      <Text style={[styles.question, { color: colors.mutedForeground }]}>
        What should I focus on next time?
      </Text>

      <Text style={[styles.answer, { color: colors.foreground }]}>
        Your biggest opportunity is{" "}
        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
          {worstMetric}
        </Text>
        {" "}(scoring {Math.round(worstScore)}/100).
        {topTipTitle
          ? ` The top priority fix: ${topTipTitle}.`
          : " Consistent reps with proper form will unlock the biggest gains."}
      </Text>

      <View style={[styles.tag, { backgroundColor: colors.success + "15" }]}>
        <Feather name="trending-up" size={11} color={colors.success} />
        <Text style={[styles.tagText, { color: colors.success }]}>
          You have a clear next step
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  question: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  answer: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    marginBottom: 12,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
