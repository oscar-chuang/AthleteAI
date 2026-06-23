import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
  testID?: string;
}

export default function AcknowledgeCheckbox({ checked, onToggle, label, testID }: Props) {
  const colors = useColors();

  return (
    <TouchableOpacity
      testID={testID}
      style={s.row}
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint="Toggle to acknowledge the recording guidelines"
    >
      <View
        style={[
          s.box,
          {
            borderColor: checked ? colors.primary : colors.border,
            backgroundColor: checked ? colors.primary : "transparent",
          },
        ]}
      >
        {checked && <Feather name="check" size={14} color={colors.primaryForeground} />}
      </View>
      <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 12 },
  box:   { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
});
