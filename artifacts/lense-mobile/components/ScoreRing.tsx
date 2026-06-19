import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing } from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  label?: string;
  children?: React.ReactNode;
  animate?: boolean;
}

/**
 * ScoreRing — a reusable SVG ring that fills from 0→score.
 * Usage: <ScoreRing score={82} size={90} color={colors.success} label="Overall" />
 * Pass animate={true} to count-up the number and fill the arc on mount (~800ms).
 */
export function ScoreRing({
  score,
  size = 80,
  strokeWidth = 7,
  color,
  trackColor,
  label,
  children,
  animate = false,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, score));
  const targetOffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  // strokeDashoffset: starts at circumference (empty) when animating, else at target
  const offsetAnim = useRef(
    new Animated.Value(animate ? circumference : targetOffset)
  ).current;

  // Driving value for count-up display
  const scoreAnim = useRef(new Animated.Value(animate ? 0 : clamped)).current;
  const [displayScore, setDisplayScore] = useState(
    animate ? 0 : Math.round(clamped)
  );

  useEffect(() => {
    if (!animate) {
      offsetAnim.setValue(targetOffset);
      scoreAnim.setValue(clamped);
      setDisplayScore(Math.round(clamped));
      return;
    }

    // Reset to empty/zero before animating
    offsetAnim.setValue(circumference);
    scoreAnim.setValue(0);
    setDisplayScore(0);

    // Drive a listener on the score anim to update the displayed integer
    const listenerId = scoreAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    Animated.parallel([
      Animated.timing(offsetAnim, {
        toValue: targetOffset,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(scoreAnim, {
        toValue: clamped,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Snap to exact value after animation completes
      setDisplayScore(Math.round(clamped));
      scoreAnim.removeListener(listenerId);
      // Haptic pulse on animation complete (silently skipped on web)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    });

    return () => {
      scoreAnim.removeListener(listenerId);
    };
  }, [animate, clamped, targetOffset, circumference]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {/* Background track */}
        <Circle
          cx={center} cy={center} r={r}
          stroke={trackColor ?? (color + "25")}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground arc — animated when animate=true */}
        <AnimatedCircle
          cx={center} cy={center} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offsetAnim}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      {children ?? (
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: size * 0.26,
              fontFamily: "Inter_700Bold",
              color,
              lineHeight: size * 0.32,
            }}
          >
            {displayScore}
          </Text>
          {label ? (
            <Text
              style={{
                fontSize: Math.max(9, size * 0.12),
                fontFamily: "Inter_400Regular",
                color: color + "aa",
                marginTop: 1,
              }}
            >
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
