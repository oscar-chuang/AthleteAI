/**
 * Unit test: progress bar stays gold immediately on pull-to-refresh when the
 * weekly goal is already reached.
 *
 * Strategy:
 *   - Mock stats so thisWeekCount >= weeklyGoal → targetRatio = 1.
 *   - Simulate an initial focus load, then trigger pull-to-refresh by calling
 *     the onRefresh prop on the RefreshControl (via UNSAFE_getByType).
 *   - Because targetRatio >= 1, loadData calls setBarAnimDone(true) BEFORE
 *     Animated.timing(..).start() — so the bar fill must already be gold
 *     without waiting for the animation callback to fire.
 *
 * Assertions:
 *   1. After pull-to-refresh resolves, the bar fill has backgroundColor
 *      "#f59e0b" (gold) immediately — the Animated.timing callback has NOT
 *      been manually fired.
 *   2. The bar fill does NOT show colors.primary at that point.
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

jest.mock("@/components/ShareCard", () => ({
  __esModule: true,
  default: require("react").forwardRef(() => null),
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

/** Stats where thisWeekCount equals weeklyGoal → targetRatio = 1.0 (goal reached). */
const MOCK_STATS_GOAL_REACHED = {
  thisWeekCount: 3,
  lastWeekCount: 1,
  streak:        3,
  totalAnalyses: 9,
  scoreDelta:    0,
  weeklyProgress: 3,
  weeklyGoal:    3,
  personalBests: {},
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
    (_value: any, config: any) => ({
      start: (_cb?: (result: { finished: boolean }) => void) => {
        // Intentionally do NOT invoke the callback — the test asserts that gold
        // is visible before the callback fires (via the early setBarAnimDone path).
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

describe("HomeScreen — progress bar gold on pull-to-refresh when goal reached", () => {
  it("bar fill is gold (#f59e0b) immediately after pull-to-refresh when goal is already reached, without waiting for animation callback", async () => {
    const { getByTestId, UNSAFE_getByType } = render(<HomeScreen />);

    // Initial focus load — stats already show goal reached (3/3).
    await simulateFocus();

    // Locate the ScrollView and extract its onRefresh handler from the
    // RefreshControl prop — this is how pull-to-refresh fires in production.
    const scrollView = UNSAFE_getByType(ScrollView);
    const refreshControl = scrollView.props.refreshControl as React.ReactElement<{ onRefresh?: () => void }>;
    const onRefresh = refreshControl?.props?.onRefresh;
    expect(onRefresh).toBeDefined();

    // Simulate pull-to-refresh: loadData(true) is called, which resets barScaleAnim
    // to 0 then immediately calls setBarAnimDone(true) because targetRatio >= 1,
    // all before Animated.timing(...).start() is invoked.
    await act(async () => { onRefresh!(); });
    await flush();

    // The animation callback has NOT been manually fired — the timing mock's
    // start() is a no-op. Gold colour must come from the early setBarAnimDone(true)
    // path, not from the callback.
    const style = getBarFillStyle(getByTestId);
    expect(style.backgroundColor).toBe(GOLD);
    expect(style.backgroundColor).not.toBe(PRIMARY);
  });

  it("bar fill is NOT gold when goal is not yet reached (targetRatio < 1) after pull-to-refresh", async () => {
    // Override stats: only 1 of 3 sessions done → targetRatio = 0.33 < 1.
    mockProfileStats.mockResolvedValue({
      ...MOCK_STATS_GOAL_REACHED,
      thisWeekCount: 1,
      weeklyProgress: 1,
    });
    // Profile weeklyProgress does not indicate goal met either.
    mockProfile = { ...mockProfile, weeklyProgress: 1 };

    const { getByTestId, UNSAFE_getByType } = render(<HomeScreen />);
    await simulateFocus();

    const scrollView = UNSAFE_getByType(ScrollView);
    const refreshControl = scrollView.props.refreshControl as React.ReactElement<{ onRefresh?: () => void }>;
    const onRefresh = refreshControl?.props?.onRefresh;
    expect(onRefresh).toBeDefined();

    await act(async () => { onRefresh!(); });
    await flush();

    // Animation callback is a no-op, so barAnimDone stays false → bar is not gold.
    const style = getBarFillStyle(getByTestId);
    expect(style.backgroundColor).not.toBe(GOLD);
    expect(style.backgroundColor).toBe(PRIMARY);
  });
});
