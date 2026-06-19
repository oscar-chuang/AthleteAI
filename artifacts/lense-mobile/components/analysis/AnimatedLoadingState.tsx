import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const STEPS = [
  { label: "Scanning your video",        icon: "film"        as const, color: "#6366f1" },
  { label: "Finding the athlete",        icon: "user"        as const, color: "#a855f7" },
  { label: "Tracking movement",          icon: "activity"    as const, color: "#3b82f6" },
  { label: "Measuring key positions",    icon: "target"      as const, color: "#10b981" },
  { label: "Building your coaching plan",icon: "cpu"         as const, color: "#f59e0b" },
];

export function AnimatedLoadingState() {
  const colors = useColors();
  const [stepIdx, setStepIdx] = useState(0);
  const textOpacity = useRef(new Animated.Value(1)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    let idx = 0;
    animateBar(idx);

    const interval = setInterval(() => {
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        idx = (idx + 1) % STEPS.length;
        setStepIdx(idx);
        animateBar(idx);
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  function animateBar(idx: number) {
    const pct = ((idx + 1) / STEPS.length) * 100;
    Animated.timing(barWidth, {
      toValue: pct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }

  const step = STEPS[stepIdx] ?? STEPS[0]!;

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.iconRing,
          {
            backgroundColor: step.color + "18",
            borderColor: step.color + "55",
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Feather name={step.icon} size={32} color={step.color} />
      </Animated.View>

      <Animated.Text
        style={[styles.stepLabel, { color: colors.foreground, opacity: textOpacity }]}
      >
        {step.label}
      </Animated.Text>

      <View style={[styles.barBg, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: step.color,
              width: barWidth.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
            },
          ]}
        />
      </View>

      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i <= stepIdx ? s.color : colors.border,
                opacity: i <= stepIdx ? 1 : 0.4,
                width: i === stepIdx ? 20 : 7,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Our AI is reviewing your movement.{"\n"}This usually takes 10–30 seconds.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 36,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginBottom: 2,
  },
  barBg: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
  },
});
