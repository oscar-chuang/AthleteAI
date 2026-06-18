import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { DrillRecord } from "@/lib/api";

interface Props {
  focusCue: string;
  drill?: DrillRecord;
  goal: string;
}

export function NextFocusCard({ focusCue, drill, goal }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: "#f59e0b18" }]}>
          <Feather name="target" size={15} color="#f59e0b" />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Next Workout Focus</Text>
      </View>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <Feather name="eye" size={13} color={colors.primary} />
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Focus cue</Text>
          <Text style={[styles.rowValue, { color: colors.foreground }]}>{focusCue}</Text>
        </View>
      </View>

      {drill && (
        <View style={[styles.row, { borderColor: colors.border }]}>
          <Feather name="activity" size={13} color={colors.success} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Drill</Text>
            <Text style={[styles.rowValue, { color: colors.foreground }]}>
              {drill.name} · {drill.sets}, {drill.reps}
            </Text>
            {drill.cue ? (
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{drill.cue}</Text>
            ) : null}
          </View>
        </View>
      )}

      <View style={[styles.row, { borderColor: colors.border, borderBottomWidth: 0 }]}>
        <Feather name="check-circle" size={13} color="#22c55e" />
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Measurable goal</Text>
          <Text style={[styles.rowValue, { color: colors.foreground }]}>{goal}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
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
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  rowSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 15,
  },
});
