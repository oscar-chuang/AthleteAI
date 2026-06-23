import React from "react";
import { Text, StyleSheet } from "react-native";

interface Props {
  label: string;
  color: string;
}

export default function GuidanceSectionHeader({ label, color }: Props) {
  return (
    <Text
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
