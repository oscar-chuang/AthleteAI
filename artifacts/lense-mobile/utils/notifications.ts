import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHECK_IN_HOUR_KEY = "check_in_hour";

export async function persistCheckInHour(hour: number): Promise<void> {
  try {
    await AsyncStorage.setItem(CHECK_IN_HOUR_KEY, String(hour));
  } catch {
    // non-fatal
  }
}

export async function clearPersistedCheckInHour(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHECK_IN_HOUR_KEY);
  } catch {
    // non-fatal
  }
}

async function resolveCheckInHour(explicit: number | undefined): Promise<number> {
  if (explicit !== undefined) return explicit;
  try {
    const stored = await AsyncStorage.getItem(CHECK_IN_HOUR_KEY);
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {
    // fall through to default
  }
  return 9;
}

const IMPROVEMENT_NOTIFICATION_ID = "joint-improvement";

const JOINT_DISPLAY: Record<string, string> = {
  leftKnee: "left knee",
  rightKnee: "right knee",
  leftHip: "left hip",
  rightHip: "right hip",
  leftElbow: "left elbow",
  rightElbow: "right elbow",
};

const RISK_LABEL: Record<number, string> = {
  0: "Safe",
  1: "Caution",
  2: "High Risk",
};

const SPORT_TITLE: Record<string, string> = {
  weightlifting: "Your lifts are getting stronger 🏋️",
  running: "Your running form is improving 🏃",
  swimming: "Your swim technique is coming together 🏊",
  cycling: "Your cycling mechanics are improving 🚴",
  tennis: "Your tennis swing is getting better 🎾",
  basketball: "Your basketball mechanics are improving 🏀",
  baseball: "Your baseball form is improving ⚾",
  soccer: "Your soccer technique is getting better ⚽",
  football: "Your football mechanics are improving 🏈",
  golf: "Your golf swing is improving ⛳",
  volleyball: "Your volleyball form is getting better 🏐",
  gymnastics: "Your gymnastics form is improving 🤸",
  yoga: "Your yoga alignment is improving 🧘",
};

function getSportTitle(sport: string): string {
  const normalised = sport.trim().toLowerCase();
  return SPORT_TITLE[normalised] ?? "You're improving! 🎉";
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    if ((existing as unknown as { granted: boolean }).granted) return true;
    const result = await Notifications.requestPermissionsAsync();
    return (result as unknown as { granted: boolean }).granted;
  } catch {
    return false;
  }
}

export async function scheduleImprovementNotification(
  improvements: Array<{ joint: string; oldRisk: number; newRisk: number }>,
  sport: string,
  checkInHour?: number,
): Promise<void> {
  if (Platform.OS === "web") return;
  if (!improvements.length) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.cancelScheduledNotificationAsync(IMPROVEMENT_NOTIFICATION_ID).catch(() => {});

  const sorted = [...improvements].sort(
    (a, b) => (b.oldRisk - b.newRisk) - (a.oldRisk - a.newRisk)
  );
  const top = sorted[0]!;
  const jointLabel = JOINT_DISPLAY[top.joint] ?? top.joint;
  const newRiskLabel = RISK_LABEL[top.newRisk] ?? "improved";

  const extraCount = improvements.length - 1;
  const body =
    improvements.length === 1
      ? `Your ${jointLabel} is down to ${newRiskLabel} — keep it up!`
      : `Your ${jointLabel} and ${extraCount} other joint${extraCount > 1 ? "s" : ""} improved — keep it up!`;

  const resolvedHour = await resolveCheckInHour(checkInHour);
  const safeHour = Math.min(22, Math.max(6, Math.round(resolvedHour)));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(safeHour, 0, 0, 0);

  await Notifications.scheduleNotificationAsync({
    identifier: IMPROVEMENT_NOTIFICATION_ID,
    content: {
      title: getSportTitle(sport),
      body,
      data: { screen: "progress", scrollTo: "trends" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
    },
  });
}
