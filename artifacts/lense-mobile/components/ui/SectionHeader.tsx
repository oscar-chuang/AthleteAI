import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SPACING } from "@/constants/spacing";

interface SectionHeaderProps {
  title:        string;
  actionLabel?: string;
  onAction?:    () => void;
  count?:       number;
}

export function SectionHeader({ title, actionLabel, onAction, count }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {count != null ? (
          <View style={[styles.countBadge, { backgroundColor: colors.surface3 }]}>
            <Text style={[styles.countText, { color: colors.textTertiary }]}>{count}</Text>
          </View>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.action, { color: colors.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   SPACING.md,
  },
  left: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.sm,
  },
  title: {
    fontSize:   15,
    fontFamily: "Inter_600SemiBold",
  },
  countBadge: {
    borderRadius:     SPACING.sm,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  countText: {
    fontSize:   11,
    fontFamily: "Inter_500Medium",
  },
  action: {
    fontSize:   13,
    fontFamily: "Inter_500Medium",
  },
});
