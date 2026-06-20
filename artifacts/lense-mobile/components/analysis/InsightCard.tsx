import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  text: string;
  variant: "strength" | "weakness" | "highlight";
  reinforcement?: string;
}

export function InsightCard({ text, variant, reinforcement }: Props) {
  const colors = useColors();

  const CFG = {
    strength:  { icon: "check-circle" as const, color: colors.success },
    weakness:  { icon: "alert-circle"  as const, color: colors.energy },
    highlight: { icon: "zap"           as const, color: colors.primary },
  };

  const cfg = CFG[variant];

  return (
    <View style={[styles.card, { backgroundColor: cfg.color + "12", borderColor: cfg.color + "30" }]}>
      <View style={styles.row}>
        <Feather name={cfg.icon} size={15} color={cfg.color} style={styles.icon} />
        <Text style={[styles.text, { color: colors.foreground }]}>{text}</Text>
      </View>
      {reinforcement ? (
        <Text style={[styles.reinforcement, { color: cfg.color }]}>{reinforcement}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    flex: 1,
  },
  reinforcement: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginTop: 6,
    marginLeft: 25,
  },
});
