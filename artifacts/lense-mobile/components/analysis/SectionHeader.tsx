import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
  accentColor?: string;
}

export function SectionHeader({ title, subtitle, icon, accentColor }: Props) {
  const colors = useColors();
  const accent = accentColor ?? colors.primary;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: accent + "18" }]}>
            <Feather name={icon} size={13} color={accent} />
          </View>
        )}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
    lineHeight: 17,
    marginLeft: 34,
  },
});
