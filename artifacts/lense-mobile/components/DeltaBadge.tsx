import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { DeltaBadgeInfo } from "@/lib/sessionDelta";

interface DeltaBadgeProps {
  info: DeltaBadgeInfo;
  /**
   * When provided the badge is rendered as a TouchableOpacity.
   * The handler is called after stopPropagation so tapping the badge
   * does not also trigger the parent session-card press.
   */
  onPress?: () => void;
  testID?: string;
}

/**
 * Colour pill shown on session cards indicating the most-significant joint
 * delta since the previous session. Green = improved risk, red = worsened,
 * amber = risk unchanged but angle moved.
 *
 * Extracted from the inline render block in app/(tabs)/index.tsx so it can
 * be independently rendered and tested.
 */
export function DeltaBadge({ info, onPress, testID = "delta-badge" }: DeltaBadgeProps) {
  const containerStyle = {
    alignSelf:        "flex-start" as const,
    marginTop:        4,
    paddingHorizontal: 5,
    paddingVertical:  2,
    borderRadius:     5,
    borderWidth:      1,
    overflow:         "hidden" as const,
    borderColor:      info.color + "88",
    backgroundColor:  info.color + "18",
  };

  const label = `${info.delta > 0 ? "↑" : "↓"}${Math.abs(info.delta)}° ${info.jointLabel}`;

  const badgeText = (
    <Text
      testID={`${testID}-text`}
      style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: info.color }}
    >
      {label}
    </Text>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        style={containerStyle}
        onPress={(e) => { (e as any)?.stopPropagation?.(); onPress(); }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {badgeText}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={containerStyle}>
      {badgeText}
    </View>
  );
}
