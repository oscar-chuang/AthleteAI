import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

interface LogoProps {
  size?: number;
}

export function Logo({ size = 40 }: LogoProps) {
  const VOLT = "#C6FF3A";
  const BG   = "#111316";
  const FG   = "#F5F5F5";
  const r    = size * 0.25;
  const s    = size / 40;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Rect x="0" y="0" width="40" height="40" rx={r} fill={BG} />
        {/* Left leg of A */}
        <Path
          d="M20 7 L8.5 33"
          stroke={FG}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* Right leg of A */}
        <Path
          d="M20 7 L31.5 33"
          stroke={FG}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* Crossbar */}
        <Path
          d="M13 24 L27 24"
          stroke={FG}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* Tracking dots — motion-capture markers at joints of the A */}
        <Circle cx="20" cy="7"  r="3.2" fill={VOLT} />
        <Circle cx="8.5" cy="33" r="3.2" fill={VOLT} />
        <Circle cx="31.5" cy="33" r="3.2" fill={VOLT} />
      </Svg>
    </View>
  );
}
