import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { ExampleCardData } from "./config";

interface Props {
  card: ExampleCardData;
  testID?: string;
}

export default function ExampleCard({ card, testID }: Props) {
  const colors = useColors();
  const accent = card.good ? colors.success : colors.destructive;

  return (
    <View
      testID={testID}
      style={[
        s.card,
        {
          backgroundColor: colors.card,
          borderColor: card.good ? colors.success + "66" : colors.destructive + "44",
        },
      ]}
    >
      <Image
        source={card.image}
        style={s.image}
        resizeMode="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={card.label}
      />
      <Text style={[s.label, { color: colors.foreground }]}>{card.label}</Text>
      <Text style={[s.desc, { color: colors.mutedForeground }]}>{card.description}</Text>
      <View
        style={[s.badge, { backgroundColor: accent + "22" }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={card.good ? "Do this" : "Avoid"}
      >
        <Feather name={card.good ? "check" : "x"} size={10} color={accent} />
        <Text style={[s.badgeText, { color: accent }]}>
          {card.good ? "Do this" : "Avoid"}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:      { width: "47%", borderRadius: 14, borderWidth: 1.5, padding: 14, alignItems: "center", gap: 8 },
  image:     { width: "100%", height: 90, borderRadius: 10, marginBottom: 2 },
  label:     { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  desc:      { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 15 },
  badge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
