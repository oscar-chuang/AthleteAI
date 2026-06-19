import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ScoreRing } from "@/components/ScoreRing";

const SCORE_BANDS = [
  { min: 80, label: "Strong",     color: "#22c55e", note: "You're doing this well" },
  { min: 65, label: "On Track",   color: "#6c63ff", note: "Solid foundation, room to grow" },
  { min: 0,  label: "Focus Here", color: "#f59e0b", note: "Prioritise improving this area" },
];

export function getScoreBand(score: number) {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[2];
}

interface Props {
  label: string;
  score: number;
  icon: React.ComponentProps<typeof Feather>["name"];
  desc: string;
  delay?: number;
  animate?: boolean;
}

export function ScoreCard({ label, score, icon, desc, delay = 0, animate = false }: Props) {
  const colors = useColors();
  const band = getScoreBand(score);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: band.color + "33",
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: band.color + "18" }]}>
          <Feather name={icon} size={14} color={band.color} />
        </View>
        <View style={[styles.bandPill, { backgroundColor: band.color + "18" }]}>
          <Text style={[styles.bandLabel, { color: band.color }]}>{band.label}</Text>
        </View>
      </View>

      <View style={styles.ringRow}>
        <ScoreRing
          score={score}
          size={60}
          strokeWidth={6}
          color={band.color}
          animate={animate}
        />
        <View style={styles.ringMeta}>
          <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={3}>
            {desc}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 130,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bandPill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bandLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  ringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ringMeta: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
    textTransform: "capitalize",
  },
  desc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
});
