/**
 * Unit test: Home screen progress bar animation resets and re-runs on every visit.
 *
 * Strategy:
 *   - jest.spyOn(Animated, 'timing') — intercepts all Animated.timing calls so we
 *     can (a) assert the correct toValue / duration and (b) hold the completion
 *     callback until we choose to fire it.
 *   - jest.spyOn(Animated.Value.prototype, 'setValue') — verifies the bar is reset
 *     to 0 before each animation starts.
 *   - useFocusEffect is captured so tests fire focus events manually.
 *   - testID="progress-bar-fill" (added to index.tsx) gives a stable selector for
 *     the bar fill element so we can assert its backgroundColor without traversal
 *     heuristics.
 *
 * Assertions:
 *   1. barScaleAnim.setValue(0) is called on every focus event (including re-focus).
 *   2. Animated.timing is called with toValue equal to (thisWeekCount / weeklyGoal)
 *      and duration=600.
 *   3. After focus, capturedBarCallback is non-null — the animation was started and
 *      its completion callback is pending (i.e. not yet fired).
 *   4. Bar fill is NOT gold before callback fires, and IS gold after — tested via a
 *      scenario where goalReached=true (from profile.weeklyProgress fallback) but
 *      targetRatio=0 (stats=null so currentCount=0, no early setBarAnimDone path).
 *      See index.tsx L149-155: the early-path only triggers when targetRatio>=1;
 *      using the profile-fallback scenario keeps barAnimDone=false until callback.
 *   5. On a second focus visit, setValue(0) and a fresh Animated.timing call are
 *      both issued again — confirming the animation fully resets each time.
 */

import React from "react";
import { Animated } from "react-native";
import { render, act } from "@testing-library/react-native";

// ─── Mutable profile for per-test overrides ───────────────────────────────────

/**
 * Mutable object read by the useAuth mock on every render.
 * Tests that need a different weeklyProgress mutate this before rendering.
 */
let mockProfile = {
  name: "Tester",
  weeklyGoal:     4,
  weeklyProgress: 0,
  trainingDays:   [0, 1, 2, 3, 4, 5, 6],
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
  notificationAsync:           jest.fn(async () => {}),
  impactAsync:                 jest.fn(async () => {}),
  ImpactFeedbackStyle:         { Light: "Light" },
  NotificationFeedbackType:    { Success: "Success" },
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
    // get is called for the latest tips; return a rejected promise so the
    // component's .catch(() => {}) handles it and execution continues past
    // the tips fetch to the Animated.timing call.
    get:  jest.fn().mockRejectedValue(new Error("not needed")),
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

// ─── Test data ────────────────────────────────────────────────────────────────

/** Minimal analysis so the "This Week" section renders (allAnalyses.length > 0). */
const MOCK_ANALYSIS = {
  id: "a1",
  status: "complete",
  sport: "basketball",
  overallScore: 72,
  uploadedAt: new Date().toISOString(),
  techniqueScore: 72, powerScore: 65, balanceScore: 80,
  consistencyScore: 75, mobilityScore: 68, speedScore: 70,
};

/**
 * Stats with thisWeekCount=3, weeklyGoal=4 → targetRatio = 0.75, goalReached = false.
 * Used for tests 1, 2, 3, and 5.
 */
const MOCK_STATS_PARTIAL = {
  thisWeekCount: 3,
  lastWeekCount: 2,
  streak:        2,
  totalAnalyses: 9,
  scoreDelta:    3,
  weeklyProgress: 3,
  weeklyGoal:    4,
  personalBests: {},
};

const GOLD    = "#f59e0b";
const PRIMARY = "#6c63ff";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending React state updates and async effects. */
async function flush(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

/** Simulate the Home tab gaining focus (fires the useFocusEffect callback). */
async function simulateFocus() {
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

/**
 * Extract the flattened style object from the progress bar fill element
 * found via its testID.
 */
function getBarFillStyle(getByTestId: (id: string) => any): Record<string, unknown> {
  const el = getByTestId("progress-bar-fill");
  const styles: any[] = Array.isArray(el.props.style)
    ? el.props.style
    : [el.props.style];
  return Object.assign({}, ...styles.filter(Boolean));
}

// ─── Spies ────────────────────────────────────────────────────────────────────

let timingSpy:    jest.SpyInstance;
let setValueSpy:  jest.SpyInstance;

/** Captured .start() callback for the progress-bar timing animation (duration=600). */
let capturedBarCallback: ((result: { finished: boolean }) => void) | null = null;

/** Whether capturedBarCallback has been invoked at least once. */
let barCallbackFired = false;

/** All calls to Animated.timing with duration=600 (progress bar). */
let barTimingCalls: { toValue: number; duration: number }[] = [];

// ─── Default profile (reset in afterEach) ─────────────────────────────────────

const DEFAULT_PROFILE = {
  name: "Tester",
  weeklyGoal:     4,
  weeklyProgress: 0,
  trainingDays:   [0, 1, 2, 3, 4, 5, 6],
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback    = null;
  capturedBarCallback  = null;
  barCallbackFired     = false;
  barTimingCalls       = [];

  // Reset mutable profile to default.
  mockProfile = { ...DEFAULT_PROFILE };

  mockAnalysesList.mockResolvedValue({ analyses: [MOCK_ANALYSIS] });
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(MOCK_STATS_PARTIAL);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));

  setValueSpy = jest.spyOn(Animated.Value.prototype, "setValue");

  timingSpy = jest.spyOn(Animated, "timing").mockImplementation(
    (value: any, config: any) => {
      if (config.duration === 600) {
        // Progress-bar animation — record call and hold the callback.
        barTimingCalls.push({ toValue: config.toValue, duration: config.duration });
        return {
          start: (cb?: (result: { finished: boolean }) => void) => {
            if (cb) {
              capturedBarCallback = (result) => {
                barCallbackFired = true;
                cb(result);
              };
            } else {
              capturedBarCallback = null;
            }
          },
          stop:  () => {},
          reset: () => {},
        } as any;
      }
      // All other animations (trophy pulse, share hint).
      // No-op: never fire the callback so Animated.loop doesn't create an
      // infinite recursion through the sequence children.
      return {
        start: (_cb?: any) => {},
        stop:  () => {},
        reset: () => {},
      } as any;
    },
  );
});

afterEach(() => {
  timingSpy.mockRestore();
  setValueSpy.mockRestore();
  jest.clearAllMocks();
  // Restore mutable profile to default so it doesn't bleed into other suites.
  mockProfile = { ...DEFAULT_PROFILE };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — progress bar animation", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("calls setValue(0) on barScaleAnim before the animation starts on focus", async () => {
    render(<HomeScreen />);
    await simulateFocus();

    // At least one setValue(0) call must have occurred (bar reset before animate).
    const zeroResets = setValueSpy.mock.calls.filter(([v]) => v === 0);
    expect(zeroResets.length).toBeGreaterThanOrEqual(1);
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("calls Animated.timing with the resolved week ratio and duration=600", async () => {
    render(<HomeScreen />);
    await simulateFocus();

    // targetRatio = Math.min(3 / 4, 1) = 0.75
    expect(barTimingCalls.length).toBeGreaterThanOrEqual(1);
    expect(barTimingCalls[0]).toMatchObject({ toValue: 0.75, duration: 600 });
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("holds the animation callback until it is explicitly fired", async () => {
    render(<HomeScreen />);
    await simulateFocus();

    // The callback must be captured (animation was started) …
    expect(capturedBarCallback).not.toBeNull();
    // … but must NOT have been invoked automatically.
    expect(barCallbackFired).toBe(false);
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  //
  // Production code (index.tsx L149-155) has an intentional fast path:
  // when targetRatio >= 1, setBarAnimDone(true) fires BEFORE .start() so the
  // bar is instantly gold on pull-to-refresh of a fully-met goal.
  // To test the callback-gated gold path we need goalReached=true but
  // targetRatio<1. The only way is: stats API returns null (so currentCount=0,
  // targetRatio=0, no early path) while profile.weeklyProgress=weeklyGoal
  // (so thisWeek falls back to profile.weeklyProgress and goalReached=true).

  it("bar fill is NOT gold before callback fires, then turns gold (#f59e0b) after", async () => {
    // Profile shows goal met (weeklyProgress = weeklyGoal = 4).
    mockProfile = { ...DEFAULT_PROFILE, weeklyProgress: 4 };
    // Stats API returns null → targetRatio = 0 (currentCount falls back to 0).
    // This bypasses the early setBarAnimDone(true) path.
    mockProfileStats.mockResolvedValue(null);

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    // Callback captured, not yet fired (barAnimDone is still false).
    expect(capturedBarCallback).not.toBeNull();
    expect(barCallbackFired).toBe(false);

    // Before callback: barAnimDone=false → fill must NOT be gold.
    const styleBefore = getBarFillStyle(getByTestId);
    expect(styleBefore.backgroundColor).not.toBe(GOLD);
    expect(styleBefore.backgroundColor).toBe(PRIMARY);

    // Fire the completion callback → setBarAnimDone(true).
    await act(async () => {
      capturedBarCallback!({ finished: true });
    });

    // After callback: barAnimDone=true AND goalReached=true → fill must be gold.
    const styleAfter = getBarFillStyle(getByTestId);
    expect(styleAfter.backgroundColor).toBe(GOLD);
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────

  it("resets and re-runs the animation on every focus visit", async () => {
    render(<HomeScreen />);

    // First focus visit.
    await simulateFocus();
    const zerosAfterFirst  = setValueSpy.mock.calls.filter(([v]) => v === 0).length;
    const timingsAfterFirst = barTimingCalls.length;
    expect(zerosAfterFirst).toBeGreaterThanOrEqual(1);
    expect(timingsAfterFirst).toBeGreaterThanOrEqual(1);

    // Second focus visit (user navigates away and back).
    await simulateFocus();
    expect(setValueSpy.mock.calls.filter(([v]) => v === 0).length)
      .toBeGreaterThan(zerosAfterFirst);
    expect(barTimingCalls.length).toBeGreaterThan(timingsAfterFirst);
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────
  //
  // Cold launch: the goal was already reached in a previous session.
  // stats.thisWeekCount >= weeklyGoal → targetRatio = 1 → the early fast-path
  // (L193-195 in index.tsx) fires setBarAnimDone(true) BEFORE Animated.timing
  // starts, so the bar is gold without waiting for the animation callback.
  //
  // Assertions:
  //   a. setValue(0) is called first (stale-gold guard resets bar to 0).
  //   b. Animated.timing is called with toValue=1, duration=600 (full bar).
  //   c. The bar fill IS gold (#f59e0b) without firing the callback —
  //      because barAnimDone was set true by the fast-path, not the callback.

  it("cold launch with goal already met: resets to 0 then turns gold via fast-path (no callback needed)", async () => {
    // Both stats and profile agree the goal is fully met.
    mockProfile = { ...DEFAULT_PROFILE, weeklyGoal: 4, weeklyProgress: 4 };
    mockProfileStats.mockResolvedValue({
      ...MOCK_STATS_PARTIAL,
      thisWeekCount: 4,
      weeklyGoal:    4,
      weeklyProgress: 4,
    });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    // a. Bar must be reset to 0 before the animation (stale-gold guard).
    const zeroResets = setValueSpy.mock.calls.filter(([v]) => v === 0);
    expect(zeroResets.length).toBeGreaterThanOrEqual(1);

    // b. Animation runs to the full bar width.
    expect(barTimingCalls.length).toBeGreaterThanOrEqual(1);
    expect(barTimingCalls[0]).toMatchObject({ toValue: 1, duration: 600 });

    // c. Gold appears immediately — callback has NOT been fired yet.
    expect(barCallbackFired).toBe(false);
    const style = getBarFillStyle(getByTestId);
    expect(style.backgroundColor).toBe(GOLD);
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────
  //
  // Stale-gold guard across two visits when the goal is already met.
  // After a first visit that leaves the bar gold, returning to the tab must
  // reset barAnimDone to false (via setValue(0) + setBarAnimDone(false) at the
  // top of loadData) before the fast-path re-applies it.
  // Observable effect: a fresh setValue(0) and a new Animated.timing call are
  // both issued on the second focus, proving the reset happened.

  it("stale-gold guard: resets before re-animating on second focus when goal is already met", async () => {
    mockProfile = { ...DEFAULT_PROFILE, weeklyGoal: 4, weeklyProgress: 4 };
    mockProfileStats.mockResolvedValue({
      ...MOCK_STATS_PARTIAL,
      thisWeekCount: 4,
      weeklyGoal:    4,
      weeklyProgress: 4,
    });

    render(<HomeScreen />);

    // First focus visit — goal met, bar goes gold via fast-path.
    await simulateFocus();
    const zerosAfterFirst   = setValueSpy.mock.calls.filter(([v]) => v === 0).length;
    const timingsAfterFirst = barTimingCalls.length;
    expect(zerosAfterFirst).toBeGreaterThanOrEqual(1);

    // Second focus visit — user leaves and comes back.
    await simulateFocus();

    // setValue(0) must be called again (bar reset before re-animation).
    expect(setValueSpy.mock.calls.filter(([v]) => v === 0).length)
      .toBeGreaterThan(zerosAfterFirst);

    // A fresh Animated.timing call must be issued (animation re-runs).
    expect(barTimingCalls.length).toBeGreaterThan(timingsAfterFirst);

    // Bar is still gold after the second visit (fast-path re-applies).
    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();
    const style = getBarFillStyle(getByTestId);
    expect(style.backgroundColor).toBe(GOLD);
  });
});
