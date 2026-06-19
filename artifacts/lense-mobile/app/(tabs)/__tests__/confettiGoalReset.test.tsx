/**
 * Unit test: Home screen resets the confetti-celebrated flag when the weekly
 * goal changes, so confetti can re-fire on the next session that crosses the
 * new target.
 *
 * Strategy:
 *   - Mock AsyncStorage so `last_seen_weekly_goal` returns a previous goal (3)
 *     while profile.weeklyGoal is set to a new value (5).
 *   - Trigger a focus event on the Home screen.
 *   - Assert that AsyncStorage.removeItem was called with the correct
 *     `confetti_celebrated_<weekKey>` key.
 *   - Assert that AsyncStorage.setItem was called with "last_seen_weekly_goal"
 *     and the new goal string.
 *   - Verify that when the goal has NOT changed, removeItem is NOT called for
 *     the celebrated key (no spurious reset).
 *   - Verify that when there is no stored goal yet (first visit), removeItem is
 *     NOT called either (no goal to diff against).
 */

import React from "react";
import { Animated } from "react-native";
import { render, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Mutable profile for per-test overrides ───────────────────────────────────

let mockProfile = {
  name: "Tester",
  weeklyGoal:              5,
  weeklyProgress:          0,
  weeklyGoalCelebratedAt:  null as string | null,
  trainingDays:            [0, 1, 2, 3, 4, 5, 6],
};

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();

// ─── Derive the expected week key the same way the component does ─────────────

function getWeekKey(): string {
  const d      = new Date();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split("T")[0]!;
}

const WEEK_KEY            = getWeekKey();
const CELEBRATED_KEY      = `confetti_celebrated_${WEEK_KEY}`;
const LAST_SEEN_GOAL_KEY  = "last_seen_weekly_goal";

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

jest.mock("@/components/ConfettiBurst", () => ({
  ConfettiBurst: () => null,
}));

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

jest.mock("@/components/ShareCard", () => ({
  __esModule: true,
  default: require("react").forwardRef(() => null),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_STATS = {
  thisWeekCount:  2,
  lastWeekCount:  1,
  streak:         1,
  totalAnalyses:  5,
  scoreDelta:     0,
  weeklyProgress: 2,
  weeklyGoal:     5,
  personalBests:  {},
};

async function flush(rounds = 6) {
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
    weeklyProgress:          0,
    weeklyGoalCelebratedAt:  null,
    trainingDays:            [0, 1, 2, 3, 4, 5, 6],
  };

  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(MOCK_STATS);
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

describe("HomeScreen — confetti flag reset on goal change", () => {

  it("removes confetti_celebrated key when goal changes from a stored value", async () => {
    // Simulate: stored goal was 3, current profile goal is 5.
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LAST_SEEN_GOAL_KEY) return "3";
      return null;
    });

    render(<HomeScreen />);
    await simulateFocus();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CELEBRATED_KEY);
  });

  it("writes last_seen_weekly_goal with the new goal after a goal change", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LAST_SEEN_GOAL_KEY) return "3";
      return null;
    });

    render(<HomeScreen />);
    await simulateFocus();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(LAST_SEEN_GOAL_KEY, "5");
  });

  it("does NOT remove confetti_celebrated key when goal is unchanged", async () => {
    // Stored goal matches current profile goal (5 === 5).
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LAST_SEEN_GOAL_KEY) return "5";
      return null;
    });

    render(<HomeScreen />);
    await simulateFocus();

    const removedKeys = (AsyncStorage.removeItem as jest.Mock).mock.calls.map(
      ([k]: [string]) => k,
    );
    expect(removedKeys).not.toContain(CELEBRATED_KEY);
  });

  it("does NOT remove confetti_celebrated key on first visit (no stored goal yet)", async () => {
    // getItem always returns null → no stored goal to diff against.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    render(<HomeScreen />);
    await simulateFocus();

    const removedKeys = (AsyncStorage.removeItem as jest.Mock).mock.calls.map(
      ([k]: [string]) => k,
    );
    expect(removedKeys).not.toContain(CELEBRATED_KEY);
  });

  it("still writes last_seen_weekly_goal on first visit", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    render(<HomeScreen />);
    await simulateFocus();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(LAST_SEEN_GOAL_KEY, "5");
  });
});
