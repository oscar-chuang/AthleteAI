import React from "react";
import { View, Text } from "react-native";
import { Logo } from "./Logo";

interface Props {
  size?: number;
  textSize?: number;
  variant?: "dark" | "volt" | "transparent";
}

export function LogoWordmark({ size = 32, textSize = 20, variant = "dark" }: Props) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Logo size={size} variant={variant} />
      <Text style={{ fontSize: textSize, fontFamily: "Inter_700Bold" }}>
        <Text style={{ color: "#FFFFFF" }}>Athlete</Text>
        <Text style={{ color: "#C6FF3A" }}>AI</Text>
      </Text>
    </View>
  );
}
