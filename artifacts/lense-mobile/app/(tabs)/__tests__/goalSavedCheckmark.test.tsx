/**
 * Unit test: "Goal saved!" checkmark appears and fades after picking a new goal.
 *
 * When the user picks a new weekly goal value, handleGoalSelect:
 *   1. Calls updateProfile({ weeklyGoal: n }).
 *   2. Sets showGoalSaved = true  → the "Goal saved!" label + check-circle renders.
 *   3. Starts an Animated.sequence (fade-in 80ms → delay 180ms → fade-out 130ms).
 *   4. In the .start() callback, calls setShowGoalSaved(false) → label unmounts.
 *
 * Animation interception strategy:
 *   Because useNativeDriver:true animations never auto-fire their callbacks in Jest,
 *   we save a reference to the REAL Animated.sequence before spying, then use a
 *   pass-through spy that:
 *     a) Creates the real composite animation (so Animated.loop still works at mount).
 *     b) Wraps the returned animation's .start() to capture the completion callback.
 *   Manually invoking the captured callback simulates animation completion and lets
 *   us assert that showGoalSaved transitions back to false.
 */

import React from "react";
import { Animated } from "react-native";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mutable state ───────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;
let mockUpdateProfile: jest.Mock;
let mockProfile: Record<string, unknown>;

const mockAnalysesList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter:      () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => (() => void) | void) => { mockFocusCallback = cb; },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: () => null,
  Svg: () => null, Line: () => null, Path: () => null,
  Polyline: () => null, Circle: () => null, Text: () => null,
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

jest.mock("expo-haptics", () => ({
  impactAsync:              jest.fn(async () => {}),
  notificationAsync:        jest.fn(async () => {}),
  ImpactFeedbackStyle:      { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync:       jest.fn(async () => {}),
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
    user:          { id: "u1", name: "Test Athlete", email: "test@test.com" },
    profile:       mockProfile,
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  }),
  useTier: () => "free",
}));

jest.mock("@/lib/api", () => ({
  analyses:    { list: (...args: any[]) => mockAnalysesList(...args) },
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

jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:       () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

jest.mock("@/components/ShareCard", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/WeekDotRow", () => ({
  WeekDotRow: () => null,
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

// Import AFTER all mocks are registered.
import HomeScreen from "../index";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ONE_ANALYSIS = {
  id:          "analysis-1",
  title:       "Morning Run",
  sport:       "running",
  status:      "complete",
  uploadedAt:  new Date().toISOString(),
  overallScore: 72,
  thumbnailUrl: null,
};

const BASE_STATS = {
  thisWeekCount: 1,
  lastWeekCount: 0,
  streak:        0,
  totalAnalyses: 1,
  scoreDelta:    null,
  personalBests: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback = null;
  mockUpdateProfile = jest.fn(async () => {});
  mockProfile = {
    weeklyGoal:     3,
    name:           "Test Athlete",
    level:          "intermediate",
    sport:          "running",
    avatarUrl:      null,
    trainingDays:   [0, 1, 2, 3, 4, 5, 6],
    weeklyProgress: 1,
  };

  mockAnalysesList.mockResolvedValue({ analyses: [ONE_ANALYSIS] });
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(BASE_STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — goal-saved checkmark micro-animation", () => {
  // ── Test 1 ────────────────────────────────────────────────────────────────
  it("shows 'Goal saved!' immediately after selecting a new goal", async () => {
    const { getByText } = render(<HomeScreen />);
    await simulateFocus();

    // Open the goal picker and tap a different value.
    fireEvent.press(getByText("Goal: 3 sessions/week"));
    fireEvent.press(getByText("5"));
    await flush();

    // The label must be visible immediately (showGoalSaved = true).
    // Note: useNativeDriver animations never auto-fire their completion
    // callback in Jest, so the badge stays visible until manually resolved.
    expect(getByText("Goal saved!")).toBeTruthy();
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  it("removes 'Goal saved!' once the animation sequence completes", async () => {
    // Save the real Animated.sequence BEFORE we spy so that the pass-through
    // can delegate to it — mount-time animations (trophy pulse, share hint loop)
    // continue to work normally while we intercept only the .start() callback.
    const realSequence = Animated.sequence.bind(Animated);
    let capturedCallback: ((result: { finished: boolean }) => void) | null = null;

    const sequenceSpy = jest
      .spyOn(Animated, "sequence")
      .mockImplementation((animations) => {
        const compositeAnim = realSequence(animations);
        const originalStart = compositeAnim.start.bind(compositeAnim);
        compositeAnim.start = (cb?: (result: { finished: boolean }) => void) => {
          // Capture every callback; the last one triggered is from handleGoalSelect.
          if (cb) capturedCallback = cb;
          originalStart(cb);
        };
        return compositeAnim;
      });

    try {
      const { getByText, queryByText } = render(<HomeScreen />);
      await simulateFocus();

      fireEvent.press(getByText("Goal: 3 sessions/week"));
      fireEvent.press(getByText("5"));
      await flush();

      // Phase 1: "Goal saved!" must be visible before the sequence resolves.
      expect(getByText("Goal saved!")).toBeTruthy();

      // The sequence must have been started and its callback captured.
      expect(capturedCallback).not.toBeNull();

      // Phase 2: fire the completion callback → setShowGoalSaved(false).
      await act(async () => {
        capturedCallback!({ finished: true });
      });

      // After the callback, showGoalSaved is false so the label must be gone.
      expect(queryByText("Goal saved!")).toBeNull();
    } finally {
      sequenceSpy.mockRestore();
    }
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  it("does NOT show 'Goal saved!' when the already-selected value is tapped", async () => {
    const { getByText, queryByText } = render(<HomeScreen />);
    await simulateFocus();

    // Tap the current value — handleGoalSelect returns early, no animation.
    fireEvent.press(getByText("Goal: 3 sessions/week"));
    fireEvent.press(getByText("3"));
    await flush();

    expect(queryByText("Goal saved!")).toBeNull();
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  it("does NOT show 'Goal saved!' when updateProfile rejects", async () => {
    mockUpdateProfile = jest.fn(async () => { throw new Error("Server error"); });

    const { getByText, queryByText } = render(<HomeScreen />);
    await simulateFocus();

    fireEvent.press(getByText("Goal: 3 sessions/week"));
    fireEvent.press(getByText("5"));
    await flush();

    // On failure the animation block is skipped — label must not appear.
    expect(queryByText("Goal saved!")).toBeNull();
    // And the goal label reverts to the previous value.
    expect(getByText("Goal: 3 sessions/week")).toBeTruthy();
  });
});
