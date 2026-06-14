import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  label?: string;
  children?: React.ReactNode;
}

/**
 * ScoreRing — a reusable SVG ring that fills from 0→score.
 * Usage: <ScoreRing score={82} size={90} color={colors.success} label="Overall" />
 */
export function ScoreRing({
  score,
  size = 80,
  strokeWidth = 7,
  color,
  trackColor,
  label,
  children,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, score));
  const dashOffset = circumference * (1 - clamped / 100);
  const center = size / 2;

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
        {/* Foreground arc */}
        <Circle
          cx={center} cy={center} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
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
            {Math.round(clamped)}
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
