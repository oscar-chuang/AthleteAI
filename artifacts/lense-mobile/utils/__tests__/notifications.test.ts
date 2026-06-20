import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (hoisted before imports) ────────────────────────────────────
// Platform.OS must not be "web" or the function returns early.
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Stub every expo-notifications API used by scheduleImprovementNotification so
// the test runs in Node without any native module.
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: vi.fn().mockResolvedValue("mock-notification-id"),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

// Stub AsyncStorage so persist/clear/resolve helpers work without native modules.
// Default: getItem returns null (simulates empty storage → falls back to hour 9).
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  scheduleImprovementNotification,
  persistCheckInHour,
  clearPersistedCheckInHour,
} from "../notifications";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ONE_IMPROVEMENT = [{ joint: "leftKnee", oldRisk: 2, newRisk: 1 }];

/** Pull the content object that was passed to scheduleNotificationAsync. */
function capturedContent(): { title: string; body: string } {
  const calls = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls;
  expect(calls).toHaveLength(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (calls[0]![0] as any).content as { title: string; body: string };
}

/** Pull the Date that was passed to scheduleNotificationAsync's trigger field. */
function capturedTriggerDate(): Date {
  const calls = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls;
  expect(calls).toHaveLength(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (calls[0]![0] as any).trigger.date as Date;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("scheduleImprovementNotification — trigger hour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply implementations after clearAllMocks so every test starts clean.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as any);
    vi.mocked(Notifications.cancelScheduledNotificationAsync).mockResolvedValue(undefined);
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue("mock-notification-id");
    // Default: storage is empty → resolveCheckInHour returns 9.
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
  });

  // ── Default hour ───────────────────────────────────────────────────────────

  it("defaults to hour 9 when checkInHour is not supplied", async () => {
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running");
    expect(capturedTriggerDate().getHours()).toBe(9);
  });

  // ── Custom hour ────────────────────────────────────────────────────────────

  it("uses the supplied hour (18) as the trigger time", async () => {
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 18);
    expect(capturedTriggerDate().getHours()).toBe(18);
  });

  it("uses hour 6 (boundary minimum) without clamping", async () => {
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 6);
    expect(capturedTriggerDate().getHours()).toBe(6);
  });

  it("uses hour 22 (boundary maximum) without clamping", async () => {
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 22);
    expect(capturedTriggerDate().getHours()).toBe(22);
  });

  // ── Clamping ───────────────────────────────────────────────────────────────

  it("clamps a value below 6 up to 6", async () => {
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 3);
    expect(capturedTriggerDate().getHours()).toBe(6);
  });

  it("clamps a negative value up to 6", async () => {
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", -10);
    expect(capturedTriggerDate().getHours()).toBe(6);
  });

  it("clamps a value above 22 down to 22", async () => {
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 25);
    expect(capturedTriggerDate().getHours()).toBe(22);
  });

  it("rounds a fractional hour before clamping — 5.6 rounds to 6 (boundary, no further clamp)", async () => {
    // Math.round(5.6) = 6, Math.max(6, 6) = 6 — sits exactly on the lower bound
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 5.6);
    expect(capturedTriggerDate().getHours()).toBe(6);
  });

  it("rounds a fractional hour before clamping — 22.5 rounds to 23 then clamps to 22", async () => {
    // Math.round(22.5) = 23, Math.min(22, 23) = 22
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 22.5);
    expect(capturedTriggerDate().getHours()).toBe(22);
  });

  // ── Trigger date is tomorrow ───────────────────────────────────────────────

  it("schedules for tomorrow, not today", async () => {
    const before = new Date();
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 9);
    const triggerDate = capturedTriggerDate();

    // Must be strictly in the future
    expect(triggerDate.getTime()).toBeGreaterThan(before.getTime());

    // Calendar date must be the next day
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(triggerDate.getDate()).toBe(tomorrow.getDate());
    expect(triggerDate.getMonth()).toBe(tomorrow.getMonth());
    expect(triggerDate.getFullYear()).toBe(tomorrow.getFullYear());
  });

  it("sets minutes, seconds, and milliseconds to zero on the trigger date", async () => {
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running", 14);
    const d = capturedTriggerDate();
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  // ── Early-exit guard ───────────────────────────────────────────────────────

  it("does not call scheduleNotificationAsync when improvements list is empty", async () => {
    await scheduleImprovementNotification([], "running", 9);
    expect(vi.mocked(Notifications.scheduleNotificationAsync)).not.toHaveBeenCalled();
  });
});

// ─── AsyncStorage persistence tests ───────────────────────────────────────────

describe("persistCheckInHour / clearPersistedCheckInHour — AsyncStorage fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as any);
    vi.mocked(Notifications.cancelScheduledNotificationAsync).mockResolvedValue(undefined);
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue("mock-notification-id");
    // Start each test with empty storage.
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
  });

  // ── Input validation ───────────────────────────────────────────────────────

  it("throws a RangeError when called with NaN", async () => {
    await expect(persistCheckInHour(NaN)).rejects.toThrow(RangeError);
    expect(vi.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();
  });

  it("throws a RangeError when called with Infinity", async () => {
    await expect(persistCheckInHour(Infinity)).rejects.toThrow(RangeError);
    expect(vi.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();
  });

  it("throws a RangeError when called with -Infinity", async () => {
    await expect(persistCheckInHour(-Infinity)).rejects.toThrow(RangeError);
    expect(vi.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();
  });

  it("clamps a value below 6 to 6 before writing", async () => {
    await persistCheckInHour(3);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith("check_in_hour", "6");
  });

  it("clamps a negative value to 6 before writing", async () => {
    await persistCheckInHour(-5);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith("check_in_hour", "6");
  });

  it("clamps a value above 22 to 22 before writing", async () => {
    await persistCheckInHour(25);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith("check_in_hour", "22");
  });

  it("rounds a fractional hour before clamping — 14.7 stores as 15", async () => {
    await persistCheckInHour(14.7);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith("check_in_hour", "15");
  });

  it("rounds a fractional hour and clamps — 22.5 rounds to 23 then clamps to 22", async () => {
    await persistCheckInHour(22.5);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith("check_in_hour", "22");
  });

  it("writes the exact boundary value 6 without clamping", async () => {
    await persistCheckInHour(6);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith("check_in_hour", "6");
  });

  it("writes the exact boundary value 22 without clamping", async () => {
    await persistCheckInHour(22);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith("check_in_hour", "22");
  });

  it("schedules at the persisted hour after persistCheckInHour(14)", async () => {
    // Simulate: user saved check-in hour 14 via persistCheckInHour.
    // AsyncStorage.getItem returns "14" when the correct key is queried.
    vi.mocked(AsyncStorage.setItem).mockImplementation(async () => undefined);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("14");

    // Persist the hour (exercises the setItem path).
    await persistCheckInHour(14);
    expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith("check_in_hour", "14");

    // Now schedule without an explicit hour — resolveCheckInHour should read "14".
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running");

    const calls = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls;
    expect(calls).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const triggerDate = (calls[0]![0] as any).trigger.date as Date;
    expect(triggerDate.getHours()).toBe(14);
  });

  it("falls back to hour 9 after clearPersistedCheckInHour() removes the stored value", async () => {
    // After clear, AsyncStorage.getItem should return null → default 9.
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async () => undefined);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

    // Clear the stored hour (exercises the removeItem path).
    await clearPersistedCheckInHour();
    expect(vi.mocked(AsyncStorage.removeItem)).toHaveBeenCalledWith("check_in_hour");

    // Schedule without an explicit hour — no stored value means default 9.
    await scheduleImprovementNotification(ONE_IMPROVEMENT, "running");

    const calls = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls;
    expect(calls).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const triggerDate = (calls[0]![0] as any).trigger.date as Date;
    expect(triggerDate.getHours()).toBe(9);
  });
});

// ─── Notification body text ────────────────────────────────────────────────────

describe("scheduleImprovementNotification — body text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as any);
    vi.mocked(Notifications.cancelScheduledNotificationAsync).mockResolvedValue(undefined);
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue("mock-notification-id");
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
  });

  // ── Single improvement — all six tracked joints ───────────────────────────

  it.each([
    ["leftKnee",   "left knee",   1, "Caution"],
    ["rightKnee",  "right knee",  1, "Caution"],
    ["leftHip",    "left hip",    0, "Safe"],
    ["rightHip",   "right hip",   0, "Safe"],
    ["leftElbow",  "left elbow",  1, "Caution"],
    ["rightElbow", "right elbow", 0, "Safe"],
  ] as const)(
    "body text for %s single-improvement uses display label and risk label",
    async (joint, displayLabel, newRisk, riskLabel) => {
      await scheduleImprovementNotification(
        [{ joint, oldRisk: 2, newRisk }],
        "running",
        9,
      );
      expect(capturedContent().body).toBe(
        `Your ${displayLabel} is down to ${riskLabel} — keep it up!`,
      );
    },
  );

  it("falls back to the raw joint key when it has no display mapping", async () => {
    await scheduleImprovementNotification(
      [{ joint: "leftShoulder", oldRisk: 2, newRisk: 1 }],
      "running",
      9,
    );
    expect(capturedContent().body).toBe(
      "Your leftShoulder is down to Caution — keep it up!",
    );
  });

  it("falls back to 'improved' when the new risk value has no label mapping", async () => {
    await scheduleImprovementNotification(
      [{ joint: "leftKnee", oldRisk: 2, newRisk: 99 }],
      "running",
      9,
    );
    expect(capturedContent().body).toBe(
      "Your left knee is down to improved — keep it up!",
    );
  });

  // ── Plural path ───────────────────────────────────────────────────────────

  it("uses singular 'joint' when exactly 2 improvements (1 other)", async () => {
    await scheduleImprovementNotification(
      [
        { joint: "leftKnee", oldRisk: 2, newRisk: 1 },
        { joint: "rightKnee", oldRisk: 2, newRisk: 1 },
      ],
      "running",
      9,
    );
    expect(capturedContent().body).toBe(
      "Your left knee and 1 other joint improved — keep it up!",
    );
  });

  it("uses plural 'joints' when there are 3 improvements (2 others)", async () => {
    await scheduleImprovementNotification(
      [
        { joint: "leftKnee", oldRisk: 2, newRisk: 1 },
        { joint: "rightKnee", oldRisk: 2, newRisk: 1 },
        { joint: "leftHip", oldRisk: 2, newRisk: 1 },
      ],
      "running",
      9,
    );
    expect(capturedContent().body).toBe(
      "Your left knee and 2 other joints improved — keep it up!",
    );
  });

  it("uses plural 'joints' for 4 improvements (3 others)", async () => {
    await scheduleImprovementNotification(
      [
        { joint: "leftKnee", oldRisk: 2, newRisk: 0 },
        { joint: "rightKnee", oldRisk: 2, newRisk: 1 },
        { joint: "leftHip", oldRisk: 2, newRisk: 1 },
        { joint: "rightHip", oldRisk: 2, newRisk: 1 },
      ],
      "running",
      9,
    );
    expect(capturedContent().body).toBe(
      "Your left knee and 3 other joints improved — keep it up!",
    );
  });

  // ── Sorting — highest delta is named first ────────────────────────────────

  it("names the joint with the largest risk delta first", async () => {
    // leftKnee delta = 1, rightElbow delta = 2 → rightElbow should be named first
    await scheduleImprovementNotification(
      [
        { joint: "leftKnee", oldRisk: 2, newRisk: 1 },   // delta 1
        { joint: "rightElbow", oldRisk: 2, newRisk: 0 }, // delta 2
      ],
      "running",
      9,
    );
    expect(capturedContent().body).toBe(
      "Your right elbow and 1 other joint improved — keep it up!",
    );
  });

  it("names the highest-delta joint first even when it appears last in the input array", async () => {
    // Input order: rightHip (delta 1), leftElbow (delta 2)
    // Expected: leftElbow is named first because its delta is larger
    await scheduleImprovementNotification(
      [
        { joint: "rightHip", oldRisk: 2, newRisk: 1 },  // delta 1
        { joint: "leftElbow", oldRisk: 2, newRisk: 0 }, // delta 2
      ],
      "running",
      9,
    );
    expect(capturedContent().body).toBe(
      "Your left elbow and 1 other joint improved — keep it up!",
    );
  });

  it("uses the single-improvement body for the top joint when delta is equal (stable — first after sort is used)", async () => {
    // Both joints have delta 1; the sort is not guaranteed stable, but the body
    // format for 2 improvements must include "1 other joint".
    await scheduleImprovementNotification(
      [
        { joint: "leftKnee", oldRisk: 2, newRisk: 1 },
        { joint: "rightKnee", oldRisk: 2, newRisk: 1 },
      ],
      "running",
      9,
    );
    const body = capturedContent().body;
    expect(body).toMatch(/^Your (left knee|right knee) and 1 other joint improved — keep it up!$/);
  });
});
