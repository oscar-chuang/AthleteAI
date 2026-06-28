import React from "react";
import { View } from "react-native";
import Svg, { Line, Circle, Rect } from "react-native-svg";

export interface LogoProps {
  size?: number;
  variant?: "dark" | "volt" | "transparent";
}

const VOLT = "#C6FF3A";
const INK = "#07090B";

export function Logo({ size = 40, variant = "dark" }: LogoProps) {
  const bg = variant === "volt" ? VOLT : INK;
  const fg = variant === "volt" ? INK : VOLT;
  const showBg = variant !== "transparent";

  // Joint-A: apex at top, two feet at bottom, two crossbar junctions
  const AX = 20, AY = 8;
  const BLX = 7,  BLY = 34;
  const BRX = 33, BRY = 34;
  const t   = 0.60;
  const ILX = AX + t * (BLX - AX);
  const ILY = AY + t * (BLY - AY);
  const IRX = AX + t * (BRX - AX);
  const IRY = ILY;
  const sw  = 2.8;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {showBg && <Rect x="0" y="0" width="40" height="40" rx="9" fill={bg} />}
        <Line x1={AX}  y1={AY}  x2={BLX} y2={BLY} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={AX}  y1={AY}  x2={BRX} y2={BRY} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={ILX} y1={ILY} x2={IRX} y2={IRY} stroke={fg} strokeWidth={sw} strokeLinecap="round" />
        <Circle cx={AX}  cy={AY}  r={3.7} fill={fg} />
        <Circle cx={ILX} cy={ILY} r={2.7} fill={fg} />
        <Circle cx={IRX} cy={IRY} r={2.7} fill={fg} />
        <Circle cx={BLX} cy={BLY} r={3.7} fill={fg} />
        <Circle cx={BRX} cy={BRY} r={3.7} fill={fg} />
      </Svg>
    </View>
  );
}
