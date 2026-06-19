import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { SPACING, RADIUS } from "@/constants/spacing";
import { Button } from "./Button";

interface EmptyStateProps {
  icon:       React.ComponentProps<typeof Feather>["name"];
  headline:   string;
  body?:      string;
  ctaLabel?:  string;
  onCta?:     () => void;
  compact?:   boolean;
}

export function EmptyState({ icon, headline, body, ctaLabel, onCta, compact }: EmptyStateProps) {
  const colors = useColors();
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.iconRing, { backgroundColor: colors.primary + "18" }]}>
        <Feather name={icon} size={compact ? 22 : 28} color={colors.primary} />
      </View>
      <Text style={[styles.headline, { color: colors.textPrimary }]}>{headline}</Text>
      {body ? (
        <Text style={[styles.body, { color: colors.textTertiary }]}>{body}</Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Button label={ctaLabel} onPress={onCta} size="md" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems:      "center",
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  wrapCompact: {
    paddingVertical: SPACING.xl,
  },
  iconRing: {
    width:           64,
    height:          64,
    borderRadius:    RADIUS.xl,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    SPACING.sm,
  },
  headline: {
    fontSize:    19,
    fontFamily:  "Inter_700Bold",
    textAlign:   "center",
  },
  body: {
    fontSize:    14,
    fontFamily:  "Inter_400Regular",
    textAlign:   "center",
    lineHeight:  21,
    maxWidth:    280,
  },
});
