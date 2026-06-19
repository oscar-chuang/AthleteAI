import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SPACING, RADIUS } from "@/constants/spacing";

interface SkeletonBoxProps {
  width?:        number | string;
  height:        number;
  radius?:       number;
  style?:        object;
}

export function SkeletonBox({ width = "100%", height, radius = RADIUS.sm, style }: SkeletonBoxProps) {
  const colors  = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: colors.surface3, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBox width={44} height={44} radius={RADIUS.md} />
      <View style={styles.lines}>
        <SkeletonBox height={14} width="60%" radius={RADIUS.sm} />
        <SkeletonBox height={11} width="40%" radius={RADIUS.sm} style={{ marginTop: SPACING.sm }} />
      </View>
      <SkeletonBox width={46} height={46} radius={RADIUS.pill} />
    </View>
  );
}

export function SkeletonStatRow() {
  return (
    <View style={styles.statRow}>
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.statItem}>
          <SkeletonBox height={28} width="70%" radius={RADIUS.sm} />
          <SkeletonBox height={10} width="50%" radius={RADIUS.sm} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            SPACING.md,
    padding:        SPACING.md,
  },
  lines: { flex: 1 },
  statRow: {
    flexDirection: "row",
    gap:           SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom:  SPACING.lg,
  },
  statItem: {
    flex:        1,
    alignItems:  "center",
    padding:     SPACING.md,
  },
});
