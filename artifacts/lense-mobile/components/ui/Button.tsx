import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  Animated,
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { SPACING, RADIUS } from "@/constants/spacing";

type Variant = "primary" | "ghost" | "destructive" | "outline";
type Size    = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?:   Variant;
  size?:      Size;
  icon?:      React.ComponentProps<typeof Feather>["name"];
  iconRight?: React.ComponentProps<typeof Feather>["name"];
  loading?:   boolean;
  disabled?:  boolean;
  fullWidth?: boolean;
}

const SIZE_MAP = {
  sm: { paddingVertical: SPACING.sm,  paddingHorizontal: SPACING.md, fontSize: 13, iconSize: 14, minHeight: 36 },
  md: { paddingVertical: 13,          paddingHorizontal: SPACING.lg, fontSize: 15, iconSize: 16, minHeight: 48 },
  lg: { paddingVertical: SPACING.md,  paddingHorizontal: SPACING.xl, fontSize: 16, iconSize: 18, minHeight: 56 },
};

export function Button({
  label,
  onPress,
  variant  = "primary",
  size     = "md",
  icon,
  iconRight,
  loading  = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const colors = useColors();
  const scale  = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 32, bounciness: 2 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 32, bounciness: 4 }).start();

  const sizeConfig = SIZE_MAP[size];
  const isDisabled = disabled || loading;

  const variantStyles = (() => {
    switch (variant) {
      case "ghost":
        return {
          bg:        "transparent",
          border:    "transparent",
          textColor: colors.primary,
          opacity:   isDisabled ? 0.4 : 1,
        };
      case "destructive":
        return {
          bg:        colors.destructive,
          border:    colors.destructive,
          textColor: "#fff",
          opacity:   isDisabled ? 0.5 : 1,
        };
      case "outline":
        return {
          bg:        "transparent",
          border:    colors.borderStrong,
          textColor: colors.foreground,
          opacity:   isDisabled ? 0.4 : 1,
        };
      default:
        return {
          bg:        colors.primary,
          border:    colors.primary,
          textColor: "#fff",
          opacity:   isDisabled ? 0.5 : 1,
        };
    }
  })();

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: variantStyles.opacity, alignSelf: fullWidth ? "stretch" : "flex-start" }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={[
          styles.base,
          {
            backgroundColor:    variantStyles.bg,
            borderColor:        variantStyles.border,
            paddingVertical:    sizeConfig.paddingVertical,
            paddingHorizontal:  sizeConfig.paddingHorizontal,
            minHeight:          sizeConfig.minHeight,
            alignSelf:          fullWidth ? "stretch" : "flex-start",
          },
          variant === "ghost" ? { borderWidth: 0 } : { borderWidth: 1.5 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyles.textColor} size="small" />
        ) : (
          <View style={styles.inner}>
            {icon && (
              <Feather name={icon} size={sizeConfig.iconSize} color={variantStyles.textColor} />
            )}
            <Text style={[styles.label, { fontSize: sizeConfig.fontSize, color: variantStyles.textColor }]}>
              {label}
            </Text>
            {iconRight && (
              <Feather name={iconRight} size={sizeConfig.iconSize} color={variantStyles.textColor} />
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius:   RADIUS.md,
    alignItems:     "center",
    justifyContent: "center",
  },
  inner: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            8,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
  },
});
