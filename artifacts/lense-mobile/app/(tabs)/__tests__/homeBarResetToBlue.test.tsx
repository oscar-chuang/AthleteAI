/**
 * Unit test: progress bar resets to primary (blue) when the weekly goal drops
 * below the reached threshold mid-week (e.g. user raises their goal).
 *
 * Strategy:
 *   - Visit 1: stats where thisWeekCount >= weeklyGoal → targetRatio = 1.
 *     The early fast-path (L204 in index.tsx) calls setBarAnimDone(true) BEFORE
 *     Animated.timing starts, so the bar turns gold without waiting for a callback.
 *     Assert gold is visible.
 *   - Mutate mockProfileStats → goal raised (thisWeekCount < weeklyGoal).
 *   - Visit 2: focus fires loadData(true). loadData always calls setValue(0) +
 *     setBarAnimDone(false) when resetBar=true (useFocusEffect passes true, L279).
 *     targetRatio is now < 1 → fast-path does NOT fire. Animated.timing start()
 *     is a no-op (callback never invoked) → barAnimDone stays false.
 *     goalReached = thisWeekCount >= weeklyGoal = false.
 *     Bar colour = barAnimDone && goalReached ? gold : primary → PRIMARY.
 *     Assert blue is visible.
 *   - Visit 3 (pull-to-refresh with same below-goal stats): re-asserts blue
 *     is still showing after an explicit refresh.
 *
 * Key invariant in index.tsx:
 *   L877: backgroundColor: barAnimDone && goalReached ? "#f59e0b" : colors.primary
 *   L279: useFocusEffect(useCallback(() => { loadData(true); }, [loadData]));
 *   L143-146: if (resetBar) { barScaleAnim.setValue(0); setBarAnimDone(false); }
 *   L204-206: if (targetRatio >= 1) { setBarAnimDone(true); } ← fast-path
 */

import React from "react";
import { Animated, ScrollView } from "react-native";
import { render, act } from "@testing-library/react-native";

// ─── Mutable profile ──────────────────────────────────────────────────────────

let mockProfile = {
  name: "Tester",
  weeklyGoal: 3,
  weeklyProgress: 3,
  trainingDays: [0, 1, 2, 3, 4, 5, 6],
};

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();

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
    energy:          "#f59e0b",
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
  analyses: {
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

jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:       () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

jest.mock("@/utils/shareUtils", () => ({
  buildGoalShareMessage:    jest.fn(() => "Share message"),
  buildSessionDeepLink:     jest.fn(() => "athleteai://analysis/a1"),
  buildSessionShareMessage: jest.fn(() => "Session share message"),
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

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD    = "#f59e0b";
const PRIMARY = "#6c63ff";

/** Stats where goal is fully met: thisWeekCount=3, weeklyGoal=3 → targetRatio=1. */
const MOCK_STATS_GOAL_REACHED = {
  thisWeekCount:  3,
  lastWeekCount:  1,
  streak:         3,
  totalAnalyses:  9,
  scoreDelta:     0,
  weeklyProgress: 3,
  weeklyGoal:     3,
  personalBests:  {},
};

/**
 * Stats where goal was raised mid-week: thisWeekCount=3, weeklyGoal=5
 * → targetRatio = 0.6 < 1 (goal no longer reached).
 */
const MOCK_STATS_GOAL_RAISED = {
  thisWeekCount:  3,
  lastWeekCount:  1,
  streak:         3,
  totalAnalyses:  9,
  scoreDelta:     0,
  weeklyProgress: 3,
  weeklyGoal:     5,
  personalBests:  {},
};

const MOCK_ANALYSIS = {
  id: "a1",
  status: "complete",
  sport: "basketball",
  overallScore: 75,
  uploadedAt: new Date().toISOString(),
  techniqueScore: 75, powerScore: 70, balanceScore: 80,
  consistencyScore: 75, mobilityScore: 70, speedScore: 72,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

function getBarFillStyle(getByTestId: (id: string) => any): Record<string, unknown> {
  const el = getByTestId("progress-bar-fill");
  const styles: any[] = Array.isArray(el.props.style)
    ? el.props.style
    : [el.props.style];
  return Object.assign({}, ...styles.filter(Boolean));
}

// ─── Spies ────────────────────────────────────────────────────────────────────

let timingSpy: jest.SpyInstance;

beforeEach(() => {
  mockFocusCallback = null;

  mockProfile = {
    name: "Tester",
    weeklyGoal: 3,
    weeklyProgress: 3,
    trainingDays: [0, 1, 2, 3, 4, 5, 6],
  };

  mockAnalysesList.mockResolvedValue({ analyses: [MOCK_ANALYSIS] });
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(MOCK_STATS_GOAL_REACHED);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));

  timingSpy = jest.spyOn(Animated, "timing").mockImplementation(
    (_value: any, _config: any) => ({
      start: (_cb?: (result: { finished: boolean }) => void) => {
        // Intentionally no-op: callback is never invoked.
        // This means barAnimDone is only true if the early fast-path fires
        // (targetRatio >= 1 calls setBarAnimDone(true) before .start()).
      },
      stop:  () => {},
      reset: () => {},
    }) as any,
  );
});

afterEach(() => {
  timingSpy.mockRestore();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — progress bar resets to primary (blue) when goal drops below reached", () => {
  /**
   * Core transition test: gold → blue across two focus visits.
   *
   * Visit 1: thisWeekCount=3, weeklyGoal=3 → targetRatio=1 → fast-path sets
   *   barAnimDone=true → bar is gold (no callback needed).
   * Mutate stats: weeklyGoal raised to 5 → targetRatio drops to 0.6.
   * Visit 2: useFocusEffect calls loadData(true) → setBarAnimDone(false) runs
   *   first, then targetRatio=0.6 → fast-path does NOT fire, callback is no-op
   *   → barAnimDone stays false → goalReached = false → bar is blue.
   */
  it("bar resets from gold to primary (#6c63ff) on re-focus after goal is raised above the current count", async () => {
    const { getByTestId } = render(<HomeScreen />);

    // ── Visit 1: goal met (3/3) — fast-path makes bar gold ──────────────────
    await simulateFocus();

    const styleAfterFirstFocus = getBarFillStyle(getByTestId);
    expect(styleAfterFirstFocus.backgroundColor).toBe(GOLD);

    // ── Simulate goal being raised mid-week: new goal = 5, still 3 sessions ─
    mockProfileStats.mockResolvedValue(MOCK_STATS_GOAL_RAISED);
    mockProfile = { ...mockProfile, weeklyGoal: 5, weeklyProgress: 3 };

    // ── Visit 2: user navigates away and returns → loadData(true) is called ──
    // loadData(true) runs: setBarAnimDone(false), then targetRatio = 3/5 = 0.6
    // → fast-path skipped → callback never fires → barAnimDone stays false
    // → goalReached = false → bar must be primary.
    await simulateFocus();

    const styleAfterSecondFocus = getBarFillStyle(getByTestId);
    expect(styleAfterSecondFocus.backgroundColor).toBe(PRIMARY);
    expect(styleAfterSecondFocus.backgroundColor).not.toBe(GOLD);
  });

  /**
   * Supplementary: pull-to-refresh with below-goal stats also shows blue.
   *
   * Identical setup to the focus test above (visit 1 = gold), then instead of
   * a second focus we trigger onRefresh from the ScrollView's RefreshControl.
   * loadData(true) is called by onRefresh too, so the same reset logic applies.
   */
  it("bar remains primary (#6c63ff) after pull-to-refresh when goal is above the current count", async () => {
    const { getByTestId, UNSAFE_getByType } = render(<HomeScreen />);

    // ── Visit 1: goal met → gold ─────────────────────────────────────────────
    await simulateFocus();

    expect(getBarFillStyle(getByTestId).backgroundColor).toBe(GOLD);

    // ── Raise goal ───────────────────────────────────────────────────────────
    mockProfileStats.mockResolvedValue(MOCK_STATS_GOAL_RAISED);
    mockProfile = { ...mockProfile, weeklyGoal: 5, weeklyProgress: 3 };

    // ── Pull-to-refresh ──────────────────────────────────────────────────────
    const scrollView = UNSAFE_getByType(ScrollView);
    const refreshControl = scrollView.props.refreshControl as React.ReactElement<{ onRefresh?: () => void }>;
    const onRefresh = refreshControl?.props?.onRefresh;
    expect(onRefresh).toBeDefined();

    await act(async () => { onRefresh!(); });
    await flush();

    const style = getBarFillStyle(getByTestId);
    expect(style.backgroundColor).toBe(PRIMARY);
    expect(style.backgroundColor).not.toBe(GOLD);
  });
});
