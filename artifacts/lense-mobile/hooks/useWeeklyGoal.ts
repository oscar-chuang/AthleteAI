import { useState, useEffect, useRef } from "react";
import { Animated } from "react-native";

export interface UseWeeklyGoalResult {
  localWeeklyGoal: number | null;
  setLocalWeeklyGoal: React.Dispatch<React.SetStateAction<number | null>>;
  showGoalSheet: boolean;
  setShowGoalSheet: React.Dispatch<React.SetStateAction<boolean>>;
  goalSheetSaving: boolean;
  setGoalSheetSaving: React.Dispatch<React.SetStateAction<boolean>>;
  showGoalSaved: boolean;
  setShowGoalSaved: React.Dispatch<React.SetStateAction<boolean>>;
  goalSavedAnim: Animated.Value;
}

export function useWeeklyGoal(profileWeeklyGoal: number | null | undefined): UseWeeklyGoalResult {
  const [localWeeklyGoal, setLocalWeeklyGoal] = useState<number | null>(null);
  const [showGoalSheet, setShowGoalSheet] = useState(false);
  const [goalSheetSaving, setGoalSheetSaving] = useState(false);
  const [showGoalSaved, setShowGoalSaved] = useState(false);
  const goalSavedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setLocalWeeklyGoal(null);
  }, [profileWeeklyGoal]);

  return {
    localWeeklyGoal, setLocalWeeklyGoal,
    showGoalSheet, setShowGoalSheet,
    goalSheetSaving, setGoalSheetSaving,
    showGoalSaved, setShowGoalSaved,
    goalSavedAnim,
  };
}
