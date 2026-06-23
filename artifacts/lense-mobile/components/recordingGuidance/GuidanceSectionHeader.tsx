import React from "react";
import { Text, StyleSheet } from "react-native";

interface Props {
  label: string;
  color: string;
  testID?: string;
}

export default function GuidanceSectionHeader({ label, color, testID }: Props) {
  return (
    <Text
      testID={testID}
      style={[s.label, { color }]}
      accessibilityRole="header"
    >
      {label}
    </Text>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase",
  },
});
