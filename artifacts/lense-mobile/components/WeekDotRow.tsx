import React from "react";
import { View, Text } from "react-native";
import { classifyWeekDots } from "@/utils/weekDots";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface Colors {
  primary: string;
  border: string;
  mutedForeground: string;
  warning: string;
}

interface WeekDotRowProps {
  lastSevenDays: string[];
  todayStr: string;
  trainedDaysSet: Set<string>;
  trainingDaysSet: Set<number>;
  goalReached: boolean;
  colors: Colors;
}

/**
 * The 7-day dot strip rendered inside the "This Week" card on the Home tab.
 * Extracted into its own component so it can be independently tested.
 */
export function WeekDotRow({
  lastSevenDays,
  todayStr,
  trainedDaysSet,
  trainingDaysSet,
  goalReached,
  colors,
}: WeekDotRowProps) {
  const dots = classifyWeekDots(lastSevenDays, todayStr, trainedDaysSet, trainingDaysSet);

  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }} testID="week-dot-row">
      {dots.map(({ dateStr, dayIdx, status }) => {
        const isRestDay      = status === "rest";
        const trained        = status === "trained";
        // "today-unrained" status: pip is shown only when the user hasn't trained yet today.
        const isTodayStatus  = status === "today";
        const isMissed       = status === "missed";
        // Label uses primary whenever the date is today, regardless of training status.
        const isActuallyToday = dateStr === todayStr;

        return (
          <View key={dateStr} style={{ alignItems: "center", gap: 5 }} testID={`day-dot-${dateStr}`}>
            <Text
              style={{
                fontSize: 9,
                fontFamily: "Inter_500Medium",
                color: isRestDay ? colors.border : isActuallyToday ? colors.primary : colors.mutedForeground,
              }}
              testID={`day-label-${dateStr}`}
            >
              {DAY_LABELS[dayIdx]}
            </Text>
            <View
              testID={`day-dot-circle-${dateStr}`}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: trained
                  ? goalReached ? "#f59e0b" : colors.primary
                  : isRestDay
                  ? colors.border + "44"
                  : "transparent",
                borderWidth: trained || isRestDay ? 0 : 1.5,
                borderColor: isMissed ? colors.warning + "88" : isActuallyToday ? colors.primary : colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: isRestDay ? 0.45 : 1,
              }}
            >
              {isTodayStatus && !isRestDay && (
                <View
                  testID={`day-dot-today-pip-${dateStr}`}
                  style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary }}
                />
              )}
              {isRestDay && (
                <View
                  testID={`day-dot-dash-${dateStr}`}
                  style={{ width: 4, height: 1, backgroundColor: colors.mutedForeground, borderRadius: 1, opacity: 0.6 }}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
