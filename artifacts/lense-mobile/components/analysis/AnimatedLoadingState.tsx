import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const MESSAGES = [
  "Analyzing movement…",
  "Measuring joint angles…",
  "Finding performance patterns…",
  "Building your coaching plan…",
];

export function AnimatedLoadingState() {
  const colors = useColors();
  const [msgIndex, setMsgIndex] = useState(0);
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setMsgIndex((i) => (i + 1) % MESSAGES.length);
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.glowRing,
          {
            borderColor: colors.primary + "55",
            backgroundColor: colors.primary + "12",
            opacity: pulseAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Feather name="activity" size={32} color={colors.primary} />
      </Animated.View>

      <Animated.Text style={[styles.msg, { color: colors.foreground, opacity: textOpacity }]}>
        {MESSAGES[msgIndex]}
      </Animated.Text>

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
    gap: 20,
    paddingHorizontal: 32,
  },
  glowRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  msg: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
