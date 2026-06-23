import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { GuidanceTip } from "./config";

interface Props {
  tip: GuidanceTip;
  variant: "good" | "bad";
}

export default function GuidanceTipRow({ tip, variant }: Props) {
  const colors = useColors();
  const color = variant === "good" ? colors.success : colors.destructive;

  return (
    <View
      style={s.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={tip.text}
    >
      <View style={[s.iconWrap, { backgroundColor: color + "18" }]}>
        <Feather name={tip.icon} size={16} color={color} />
      </View>
      <Text style={[s.text, { color: colors.foreground }]}>{tip.text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  text:     { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, paddingTop: 6 },
});
