/**
 * Unit test: Coaching tips are not re-fetched on repeat home screen visits
 * when the latest-complete analysis ID hasn't changed.
 *
 * Strategy:
 *   - useFocusEffect is captured so tests fire focus events manually.
 *   - analysesApi.get is tracked with a Jest mock.
 *   - Animated.timing is intercepted so simulateFocus() can wait until the
 *     full loadData() async chain (Promise.all → tip guard → animation) has
 *     completed.  After simulateFocus() returns we flush remaining micro-tasks
 *     with waitFor() so the tip .then() callback (which updates lastFetchedTipIdRef)
 *     is guaranteed to have run before the next focus event fires.
 *
 * Assertions:
 *   1. analysesApi.get is called exactly once on first focus when a complete
 *      analysis is present.
 *   2. A second focus with the same analysis list does NOT call analysesApi.get
 *      again — the lastFetchedTipIdRef guard short-circuits.
 *   3. A subsequent focus where the analysis list has a NEW complete analysis ID
 *      DOES call analysesApi.get again (with the new ID).
 */

import React from "react";
import { Animated } from "react-native";
import { render, act, waitFor } from "@testing-library/react-native";

// ─── Mutable analysis list for per-test overrides ─────────────────────────────

const ANALYSIS_A1 = {
  id: "a1",
  status: "complete",
  sport: "basketball",
  overallScore: 72,
  uploadedAt: new Date().toISOString(),
  techniqueScore: 72, powerScore: 65, balanceScore: 80,
  consistencyScore: 75, mobilityScore: 68, speedScore: 70,
};

const ANALYSIS_A2 = {
  ...ANALYSIS_A1,
  id: "a2",
  overallScore: 80,
};

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList   = jest.fn();
const mockAnalysesGet    = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats   = jest.fn();
const mockJointTrendsGet = jest.fn();

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
    primary:         "#00C2FF",
    mutedForeground: "#6B7280",
    muted:           "#333333",
    success:         "#1DB954",
    warning:         "#FF6B35",
    energy:          "#FF6B35",
    destructive:     "#FF4444",
    radius:          12,
  }),
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    user:          { id: "u1", name: "Tester" },
    profile:       { name: "Tester", weeklyGoal: 3, weeklyProgress: 1, trainingDays: [1, 2, 3] },
    updateProfile: jest.fn(async () => {}),
  }),
  useTier: () => "free",
}));

jest.mock("@/lib/api", () => ({
  analyses: {
    list: (...args: any[]) => mockAnalysesList(...args),
    get:  (...args: any[]) => mockAnalysesGet(...args),
  },
  achievements:{ list: (...args: any[]) => mockAchievementsList(...args) },
  profile:     { stats: (...args: any[]) => mockProfileStats(...args) },
  jointTrends: { get:  (...args: any[]) => mockJointTrendsGet(...args) },
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
  ShareCard:        () => null,
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

// ─── Spies ────────────────────────────────────────────────────────────────────

let timingSpy: jest.SpyInstance;

/** All calls to Animated.timing with duration=600 (progress bar). */
let barTimingCalls: { toValue: number; duration: number }[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fire the useFocusEffect callback and wait until the full loadData() async
 * chain has completed.  We know loadData() is done when Animated.timing is
 * called (it runs synchronously at the end of the data-load block).
 */
async function simulateFocus() {
  const prevCount = barTimingCalls.length;
  await act(async () => { mockFocusCallback?.(); });
  await waitFor(
    () => { expect(barTimingCalls.length).toBeGreaterThan(prevCount); },
    { timeout: 5000 },
  );
}

/**
 * After simulateFocus() the Animated.timing call has been observed, but the
 * tip .then() callback (which updates lastFetchedTipIdRef) may still be a
 * pending micro-task.  This helper flushes those remaining micro-tasks so the
 * ref is up-to-date before the next focus event fires.
 */
async function flushTipCallback(expectedGetCalls: number) {
  await waitFor(
    () => { expect(mockAnalysesGet).toHaveBeenCalledTimes(expectedGetCalls); },
    { timeout: 5000 },
  );
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

const MOCK_STATS = {
  thisWeekCount: 1, lastWeekCount: 0, streak: 1,
  totalAnalyses: 1, scoreDelta: 0, weeklyProgress: 1, weeklyGoal: 3,
  personalBests: {},
};

beforeEach(() => {
  mockFocusCallback = null;
  barTimingCalls    = [];

  mockAnalysesList.mockResolvedValue({ analyses: [ANALYSIS_A1] });
  mockAnalysesGet.mockResolvedValue({ tips: [] });
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(MOCK_STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));

  timingSpy = jest.spyOn(Animated, "timing").mockImplementation(
    (_value: any, config: any) => {
      if (config.duration === 600) {
        barTimingCalls.push({ toValue: config.toValue, duration: config.duration });
      }
      return { start: (_cb?: any) => {}, stop: () => {}, reset: () => {} } as any;
    },
  );
});

afterEach(() => {
  timingSpy.mockRestore();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — coaching tip re-fetch guard (lastFetchedTipIdRef)", () => {

  it("calls analysesApi.get once on first focus when a complete analysis is present", async () => {
    render(<HomeScreen />);

    await simulateFocus();
    await flushTipCallback(1);

    expect(mockAnalysesGet).toHaveBeenCalledTimes(1);
    expect(mockAnalysesGet).toHaveBeenCalledWith("a1");
  });

  it("does NOT call analysesApi.get again when the analysis ID hasn't changed on second focus", async () => {
    render(<HomeScreen />);

    // First focus — ref is populated with "a1".
    await simulateFocus();
    await flushTipCallback(1);
    expect(mockAnalysesGet).toHaveBeenCalledTimes(1);

    // Second focus — same analysis list, same ID.
    // The lastFetchedTipIdRef guard must skip the fetch.
    await simulateFocus();
    // Allow any inadvertent async micro-tasks to settle.
    await act(async () => {});

    expect(mockAnalysesGet).toHaveBeenCalledTimes(1);
  });

  it("calls analysesApi.get again when a new complete analysis appears", async () => {
    render(<HomeScreen />);

    // First focus — fetches tips for "a1".
    await simulateFocus();
    await flushTipCallback(1);
    expect(mockAnalysesGet).toHaveBeenCalledTimes(1);

    // Second focus — same list, guard skips.
    await simulateFocus();
    await act(async () => {});
    expect(mockAnalysesGet).toHaveBeenCalledTimes(1);

    // Simulate a new complete analysis arriving (different ID).
    mockAnalysesList.mockResolvedValue({ analyses: [ANALYSIS_A2, ANALYSIS_A1] });

    // Third focus — new latest ID "a2" → guard must allow the fetch.
    await simulateFocus();
    await flushTipCallback(2);

    expect(mockAnalysesGet).toHaveBeenCalledTimes(2);
    expect(mockAnalysesGet).toHaveBeenLastCalledWith("a2");
  });
});
