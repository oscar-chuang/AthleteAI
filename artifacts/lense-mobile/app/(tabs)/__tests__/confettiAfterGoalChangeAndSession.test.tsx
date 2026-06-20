/**
 * End-to-end test: goal change → celebrated-flag reset → new session → confetti fires.
 *
 * Scenario:
 *   1. User previously had weeklyGoal = 3 (stored in last_seen_weekly_goal).
 *   2. User changes their goal to 5 in Settings.
 *   3. HomeScreen is focused (first visit) — detects the mismatch, removes
 *      confetti_celebrated_<weekKey> so the gate can fire again, and
 *      checkConfettiGate returns false (count not yet at the new goal).
 *   4. User completes enough sessions to cross the new target (thisWeekCount → 5).
 *   5. HomeScreen is focused again (second visit) — with the celebrated flag gone
 *      checkConfettiGate returns true → ConfettiBurst is rendered.
 *
 * Assertions:
 *   - After the first visit, AsyncStorage.removeItem was called with
 *     confetti_celebrated_<weekKey> (the reset fired).
 *   - After the second visit, the ConfettiBurst component is present in the tree.
 */

import React from "react";
import { Animated } from "react-native";
import { render, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Mutable profile for per-test overrides ───────────────────────────────────

let mockProfile = {
  name: "Tester",
  weeklyGoal:             5,
  weeklyProgress:         5,
  weeklyGoalCelebratedAt: null as string | null,
  trainingDays:           [0, 1, 2, 3, 4, 5, 6],
};

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();

// ─── Week key (mirrors the component's getWeekKey logic) ─────────────────────

function getWeekKey(): string {
  const d      = new Date();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split("T")[0]!;
}

const WEEK_KEY           = getWeekKey();
const CELEBRATED_KEY     = `confetti_celebrated_${WEEK_KEY}`;
const LAST_SEEN_GOAL_KEY = "last_seen_weekly_goal";

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter:            () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect:       (cb: () => (() => void) | void) => { mockFocusCallback = cb; },
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync:       jest.fn(async () => {}),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync:        jest.fn(async () => {}),
  impactAsync:              jest.fn(async () => {}),
  ImpactFeedbackStyle:      { Light: "Light" },
  NotificationFeedbackType: { Success: "Success" },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    getAllKeys:  jest.fn(async () => []),
    multiGet:   jest.fn(async () => []),
  },
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background:      "#0a0a0a",
    foreground:      "#f5f5f5",
    card:            "#1a1a1a",
    border:          "#2a2a2a",
    primary:         "#6c63ff",
    mutedForeground: "#888888",
    muted:           "#333333",
    success:         "#22c55e",
    warning:         "#f59e0b",
    destructive:     "#ff4d6d",
    radius:          12,
  }),
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    user:          { id: "u1", name: "Tester" },
    profile:       mockProfile,
    updateProfile: jest.fn(async () => {}),
  }),
  useTier: () => "free",
}));

jest.mock("@/lib/api", () => ({
  analyses:    {
    list: (...args: any[]) => mockAnalysesList(...args),
    get:  jest.fn().mockRejectedValue(new Error("not needed")),
  },
  achievements: { list: (...args: any[]) => mockAchievementsList(...args) },
  profile:      { stats: (...args: any[]) => mockProfileStats(...args) },
  jointTrends:  { get:  (...args: any[]) => mockJointTrendsGet(...args) },
}));

jest.mock("@/app/profile-settings", () => ({
  AvatarDisplay: () => null,
}));

jest.mock("@/components/JointHistorySheet", () => ({
  __esModule: true,
  default: () => null,
}));

// Render a real View with testID so we can assert it appeared in the tree.
jest.mock("@/components/ConfettiBurst", () => {
  const RealReact = require("react");
  const { View }  = require("react-native");
  return {
    ConfettiBurst: ({ onComplete: _onComplete }: { onComplete?: () => void }) =>
      RealReact.createElement(View, { testID: "confetti-burst" }),
  };
});

// confettiGate is mocked per-test via mockResolvedValueOnce so the gate can
// return false on the first visit and true on the second.
jest.mock("@/utils/confettiGate", () => ({
  checkConfettiGate:          jest.fn(async () => false),
  retryCelebrationSync:       jest.fn(async () => {}),
  persistCelebrationToServer: jest.fn(async () => {}),
}));

jest.mock("@/lib/sessionDelta", () => ({
  buildDeltaMap: jest.fn(() => new Map()),
}));

jest.mock("@/components/WeekDotRow", () => ({
  WeekDotRow: () => null,
}));

jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:        () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

jest.mock("@/utils/shareUtils", () => ({
  buildGoalShareMessage:    jest.fn(() => "Share message"),
  buildSessionDeepLink:     jest.fn(() => "athleteai://analysis/a1"),
  buildSessionShareMessage: jest.fn(() => "Session share"),
  buildSessionSharePayload: jest.fn(() => ({ message: "", url: "" })),
  SESSION_DEEP_LINK_SCHEME: "athleteai://analysis",
}));

jest.mock("@/utils/scheduleUtils", () => ({
  SCHEDULE_DAY_LABELS:    ["S", "M", "T", "W", "T", "F", "S"],
  computeScheduleSummary: jest.fn(() => null),
}));

jest.mock("@/utils/shareCardCapture", () => ({
  HIDDEN_SHARE_CARD_STYLE:    { position: "absolute", opacity: 0 },
  SHARE_CARD_CAPTURE_OPTIONS: { format: "png", quality: 1, result: "tmpfile" },
}));

// ─── Import component AFTER all mocks ─────────────────────────────────────────

import HomeScreen from "../index";
import { checkConfettiGate } from "@/utils/confettiGate";

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_STATS_GOAL_CROSSED = {
  thisWeekCount:  5,
  lastWeekCount:  2,
  streak:         3,
  totalAnalyses:  10,
  scoreDelta:     5,
  weeklyProgress: 5,
  weeklyGoal:     5,
  personalBests:  {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let timingSpy: jest.SpyInstance;

beforeEach(() => {
  mockFocusCallback = null;
  mockProfile = {
    name:                    "Tester",
    weeklyGoal:              5,
    weeklyProgress:          5,
    weeklyGoalCelebratedAt:  null,
    trainingDays:            [0, 1, 2, 3, 4, 5, 6],
  };

  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(MOCK_STATS_GOAL_CROSSED);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));

  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

  timingSpy = jest.spyOn(Animated, "timing").mockImplementation(
    (_value: any, _config: any) => ({
      start: (_cb?: any) => {},
      stop:  () => {},
      reset: () => {},
    } as any),
  );
});

afterEach(() => {
  timingSpy.mockRestore();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — confetti fires after goal change and new session", () => {

  it("removes the celebrated flag on first visit when goal changed, then shows ConfettiBurst on second visit", async () => {
    // First visit: stored goal was 3, profile goal is 5 → reset fires.
    // checkConfettiGate returns false (session count may not have crossed yet).
    // Second visit: checkConfettiGate returns true (gate is now open after reset).
    (checkConfettiGate as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LAST_SEEN_GOAL_KEY) return "3";
      return null;
    });

    const { getByTestId } = render(<HomeScreen />);

    // ── First focus visit ─────────────────────────────────────────────────────
    await simulateFocus();

    // The celebrated flag must have been cleared so confetti can re-fire.
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CELEBRATED_KEY);
    // The new goal must be persisted for future comparisons.
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(LAST_SEEN_GOAL_KEY, "5");

    // ── Second focus visit (user completed the session that crosses the new goal) ─
    await simulateFocus();

    // With the celebrated flag gone, checkConfettiGate returns true and the
    // component sets showConfetti=true, mounting ConfettiBurst in the tree.
    expect(getByTestId("confetti-burst")).toBeTruthy();
  });

  it("checkConfettiGate is called on both visits", async () => {
    (checkConfettiGate as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LAST_SEEN_GOAL_KEY) return "3";
      return null;
    });

    render(<HomeScreen />);
    await simulateFocus();
    await simulateFocus();

    expect(checkConfettiGate).toHaveBeenCalledTimes(2);
  });
});
