import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  title: string;
  subtitle: string;
  iconName: React.ComponentProps<typeof Feather>["name"];
  testID?: string;
}

export default function GuidanceHeroBlock({ title, subtitle, iconName, testID }: Props) {
  const colors = useColors();

  return (
    <View testID={testID} style={s.block} accessibilityRole="header">
      <View style={[s.iconWrap, { backgroundColor: colors.primary + "22" }]}>
        <Feather name={iconName} size={28} color={colors.primary} />
      </View>
      <Text style={[s.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  block:    { alignItems: "center", marginBottom: 24 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title:    { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
