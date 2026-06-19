import React from "react";
import { View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SPACING } from "@/constants/spacing";

interface DividerProps {
  margin?: number;
}

export function Divider({ margin = SPACING.md }: DividerProps) {
  const colors = useColors();
  return (
    <View
      style={{
        height:            1,
        backgroundColor:   colors.border,
        marginVertical:    margin,
      }}
    />
  );
}
