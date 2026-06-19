/**
 * Unit tests confirming the 'Tap to share' hint auto-dismisses after 5 seconds.
 *
 * The hint is shown when the weekly goal is reached and `share_hint_shown` is
 * absent from AsyncStorage.  A `setTimeout` inside a `useEffect` fires
 * `dismissShareHint` after 5 000 ms; the cleanup `clearTimeout` cancels it if
 * `showShareHint` becomes false before the timer fires.
 *
 * Mocking strategy mirrors shareHintOnce.test.tsx with two additions:
 *   - jest.useFakeTimers() allows advancing the clock without real delays.
 *   - For the early-tap test, Animated.timing is spied on (same pattern used in
 *     goalSavedCheckmark.test.tsx) so the dismiss animation's completion callback
 *     (`setShowShareHint(false)`) can be triggered synchronously.  Without this,
 *     useNativeDriver animations never fire their callbacks in Jest, leaving
 *     showShareHint=true and preventing the effect cleanup that cancels the timer.
 *
 * Covered scenarios:
 *   1. No tap for 5 s  → AsyncStorage.setItem("share_hint_shown", "true") is
 *      called and the hint is gone from the tree.
 *   2. User taps before 5 s → dismissShareHint runs (setItem written once),
 *      animation callback is fired to flip showShareHint=false, effect cleanup
 *      cancels the timer, advancing past 5 s does NOT call setItem again.
 */

import React from "react";
import { Animated } from "react-native";
import { render, act, fireEvent } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => (() => void) | void) => {
    mockFocusCallback = cb;
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: () => null,
  Svg: () => null,
  Line: () => null,
  Path: () => null,
  Polyline: () => null,
  Circle: () => null,
  Text: () => null,
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
    background: "#0a0a0a",
    foreground: "#f5f5f5",
    card: "#1a1a1a",
    border: "#2a2a2a",
    primary: "#6c63ff",
    mutedForeground: "#888888",
    muted: "#333333",
    success: "#22c55e",
    warning: "#f59e0b",
    destructive: "#ff4d6d",
    radius: 12,
  }),
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@test.com" },
    profile: {
      weeklyGoal: 3,
      weeklyProgress: 3,
      sport: "basketball",
      trainingDays: [1, 2, 3, 4, 5],
    },
    updateProfile: jest.fn(),
  }),
  useTier: () => "free",
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
  ShareCard: () => null,
}));

jest.mock("expo-haptics", () => ({
  notificationAsync:        jest.fn(async () => {}),
  impactAsync:              jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle:      { Light: "light" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync:       jest.fn(async () => {}),
}));

jest.mock("@/lib/api", () => ({
  analyses:    {
    list: (...args: any[]) => mockAnalysesList(...args),
    get:  jest.fn().mockRejectedValue(new Error("not needed")),
  },
  achievements:{ list: (...args: any[]) => mockAchievementsList(...args) },
  profile:     { stats: (...args: any[]) => mockProfileStats(...args) },
  jointTrends: { get: (...args: any[]) => mockJointTrendsGet(...args) },
}));

jest.mock("../../../utils/shareUtils", () => ({
  buildGoalShareMessage: jest.fn(() => "I reached my weekly goal!"),
}));

jest.mock("../../../utils/scheduleUtils", () => ({
  computeScheduleSummary: jest.fn(() => "Mon–Fri"),
}));

// ─── Import component AFTER mocks ─────────────────────────────────────────────

import HomeScreen from "../index";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const HINT_TEXT = "Tap to share 🎉";

const GOAL_REACHED_STATS = {
  thisWeekCount: 3,
  lastWeekCount: 2,
  totalAnalyses: 5,
  streak: 1,
  scoreDelta: 0,
  weeklyGoal: 3,
  weeklyProgress: 3,
  personalBests: {
    technique: 0,
    power: 0,
    balance: 0,
    consistency: 0,
    mobility: 0,
    speed: 0,
  },
};

const ONE_ANALYSIS = {
  analyses: [
    {
      id: "a1",
      status: "complete",
      sport: "basketball",
      overallScore: 78,
      uploadedAt: new Date().toISOString(),
      techniqueScore: 78,
      powerScore: 72,
      balanceScore: 80,
      consistencyScore: 70,
      mobilityScore: 75,
      speedScore: 68,
    },
  ],
};

const EMPTY_ACHIEVEMENTS = { achievements: [] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => {
    mockFocusCallback?.();
  });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;
  mockAnalysesList.mockResolvedValue(ONE_ANALYSIS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
  mockProfileStats.mockResolvedValue(GOAL_REACHED_STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
  // Default: key absent so the hint will be shown when goal is reached.
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — share hint auto-dismiss", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("auto-dismisses after 5 s: writes share_hint_shown and removes the hint from the tree", async () => {
    // Spy on Animated.timing to capture the dismiss callback so we can fire
    // setShowShareHint(false) synchronously — same pattern as test 2 and
    // goalSavedCheckmark.test.tsx.  Without this, the native-driver animation
    // never invokes its callback in Jest, leaving showShareHint=true even
    // after the timer calls dismissShareHint(), so the hint stays in the tree.
    const realTiming = Animated.timing.bind(Animated);
    let capturedDismissCallback: ((result: { finished: boolean }) => void) | null = null;

    const timingSpy = jest
      .spyOn(Animated, "timing")
      .mockImplementation((value: any, config: any) => {
        const anim = realTiming(value, config);
        const originalStart = anim.start.bind(anim);
        anim.start = (cb?: (result: { finished: boolean }) => void) => {
          if (config.toValue === 0 && cb) capturedDismissCallback = cb;
          originalStart(cb);
        };
        return anim;
      });

    try {
      const { queryByText } = render(<HomeScreen />);
      await simulateFocus();

      // Hint must be visible before we advance the clock.
      expect(queryByText(HINT_TEXT)).toBeTruthy();

      // Advance fake clock by exactly 5 seconds to fire the auto-dismiss timer.
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      await flush();

      // 1) dismissShareHint writes the storage key before starting the animation.
      expect(AsyncStorage.setItem).toHaveBeenCalledWith("share_hint_shown", "true");

      // 2) Fire the captured animation callback → setShowShareHint(false).
      expect(capturedDismissCallback).not.toBeNull();
      await act(async () => {
        capturedDismissCallback!({ finished: true });
      });
      await flush();

      // 3) Hint must be gone from the rendered tree.
      expect(queryByText(HINT_TEXT)).toBeNull();
    } finally {
      timingSpy.mockRestore();
    }
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("cancels the timer when the user taps before 5 s — setItem is not called a second time", async () => {
    // ── Spy on Animated.timing (mirrors goalSavedCheckmark.test.tsx pattern) ──
    // useNativeDriver animations never fire their callbacks in Jest, so without
    // this spy, setShowShareHint(false) would never run, showShareHint would
    // stay true, and the effect cleanup (clearTimeout) would never fire.
    // We capture the callback from the dismiss call (toValue: 0) and invoke it
    // manually to simulate the animation completing.
    const realTiming = Animated.timing.bind(Animated);
    let capturedDismissCallback: ((result: { finished: boolean }) => void) | null = null;

    const timingSpy = jest
      .spyOn(Animated, "timing")
      .mockImplementation((value: any, config: any) => {
        const anim = realTiming(value, config);
        const originalStart = anim.start.bind(anim);
        anim.start = (cb?: (result: { finished: boolean }) => void) => {
          // Intercept the dismiss animation (fade-out: toValue 0) to capture
          // its completion callback.  All other animations (fade-in, pulse,
          // trophy, bar…) run normally.
          if (config.toValue === 0 && cb) capturedDismissCallback = cb;
          originalStart(cb);
        };
        return anim;
      });

    try {
      const { getByText } = render(<HomeScreen />);
      await simulateFocus();

      // Hint is present — tap the goal banner which calls dismissShareHint.
      expect(getByText(HINT_TEXT)).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByText("Weekly goal reached!"));
      });
      await flush();

      // setItem must have been called once by the manual tap.
      expect(AsyncStorage.setItem).toHaveBeenCalledWith("share_hint_shown", "true");
      const callCountAfterTap = (AsyncStorage.setItem as jest.Mock).mock.calls.length;

      // Fire the captured dismiss-animation callback so setShowShareHint(false)
      // runs, the effect re-executes with showShareHint=false, and the cleanup
      // calls clearTimeout(autoDismiss) — cancelling the 5 s timer.
      expect(capturedDismissCallback).not.toBeNull();
      await act(async () => {
        capturedDismissCallback!({ finished: true });
      });
      await flush();

      // Advance past the 5 s mark — the cleared timer must NOT fire again.
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      await flush();

      // No additional setItem calls — the timer was cancelled by the cleanup.
      expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(callCountAfterTap);
    } finally {
      timingSpy.mockRestore();
    }
  });
});
