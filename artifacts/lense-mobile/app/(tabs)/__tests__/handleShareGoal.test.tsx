/**
 * Component-level integration test: handleShareConfirm wires buildGoalShareMessage
 * correctly into Share.share().
 *
 * What this test covers:
 *   The unit tests in __tests__/shareUtils.test.ts verify buildGoalShareMessage
 *   in isolation. This test mounts the real HomeScreen, opens the share preview
 *   modal via the share button, presses Confirm, and asserts that Share.share()
 *   receives the exact string the utility produces — catching any mismatch in how
 *   the component reads profile / stats or constructs the call arguments.
 *
 * Flow under test:
 *   1. Press goal-share-btn  →  showSharePreview becomes true (modal opens).
 *   2. Press goal-share-confirm-btn  →  handleShareConfirm runs.
 *   3. expo-sharing.isAvailableAsync() returns false  →  plain-text
 *      Share.share({ message }) branch executes.
 *   4. Assert Share.share received the exact string buildGoalShareMessage produces.
 *
 * Mocking strategy:
 *   - expo-router's useFocusEffect is captured so tests fire it manually.
 *   - @/lib/api is stubbed so we control the profile / stats values that drive
 *     buildGoalShareMessage (sessionCount, sport, streakDays).
 *   - expo-sharing returns isAvailableAsync = false so handleShareConfirm takes
 *     the plain-text Share.share({ message }) path — the simplest branch to assert.
 *   - Share.share is replaced with jest.spyOn after import (no jest.mock override
 *     of 'react-native' — that would load TurboModuleRegistry and crash the suite).
 *   - Heavy native components (ShareCard, ConfettiBurst, WeekDotRow, etc.) are
 *     stubbed to null renderers so the test stays fast and host-agnostic.
 *
 * Covered scenarios:
 *   1. Sport + streak > 1  →  full message with sport suffix and streak suffix.
 *   2. No sport, streak = 1 →  base message, no sport or streak suffix.
 *   3. No sport, streak = 0 →  base message only.
 *   4. ShareCard receives correct analysis prop from the latest complete analysis.
 *   5. topTip is wired through to ShareCard when latestTips contains a tip.
 *   6. captureRef is called once when Share CTA is pressed (image-sharing branch).
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { Share } from "react-native";

// ─── Module-level mock state ───────────────────────────────────────────────────

let mockProfile: {
  sport: string | null;
  weeklyGoal: number;
  weeklyProgress: number;
  trainingDays: number[];
  name: string;
  avatarUrl: null;
  level: string;
} | null = null;

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList     = jest.fn();
const mockAnalysesGet      = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => (() => void) | void) => {
    mockFocusCallback = cb;
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: () => null,
  Svg: () => null,
  Circle: () => null,
  Path: () => null,
  Line: () => null,
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
    user:           { id: "u1" },
    profile:        mockProfile,
    updateProfile:  jest.fn(async () => {}),
    refreshProfile: jest.fn(async () => {}),
  }),
  useTier: () => "free",
}));

jest.mock("@/lib/api", () => ({
  analyses:     {
    list: (...a: any[]) => mockAnalysesList(...a),
    get:  (...a: any[]) => mockAnalysesGet(...a),
  },
  achievements: { list: (...a: any[]) => mockAchievementsList(...a) },
  profile:      { stats: (...a: any[]) => mockProfileStats(...a) },
  jointTrends:  { get:  (...a: any[]) => mockJointTrendsGet(...a) },
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
  checkConfettiGate: jest.fn(async () => false),
}));

jest.mock("@/lib/sessionDelta", () => ({
  buildDeltaMap: jest.fn(() => new Map()),
}));

jest.mock("@/components/WeekDotRow", () => ({
  WeekDotRow: () => null,
}));

jest.mock("expo-image", () => ({
  Image: () => null,
}));

jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:        jest.fn(() => null),
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(async () => "file:///tmp/share-card.png"),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync:       jest.fn(async () => {}),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync:         jest.fn(async () => {}),
  impactAsync:               jest.fn(async () => {}),
  NotificationFeedbackType:  { Success: "success" },
  ImpactFeedbackStyle:       { Light: "light" },
}));

// ─── Component import (must come after all mocks) ─────────────────────────────

import HomeScreen from "../index";
import { buildGoalShareMessage } from "../../../utils/shareUtils";

// ─── Shared test data ─────────────────────────────────────────────────────────

/** At least one analysis is required so allAnalyses.length > 0 renders "This Week". */
const ANALYSIS_ROW = {
  id:               "a1",
  status:           "complete",
  sport:            "running",
  title:            "Morning Run",
  uploadedAt:       new Date().toISOString(),
  thumbnailUrl:     null,
  overallScore:     85,
  techniqueScore:   80,
  powerScore:       75,
  balanceScore:     70,
  consistencyScore: 65,
  mobilityScore:    60,
  speedScore:       55,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let shareSpy: jest.SpyInstance;

beforeEach(() => {
  mockFocusCallback = null;
  mockAnalysesList.mockResolvedValue({ analyses: [ANALYSIS_ROW] });
  mockAnalysesGet.mockResolvedValue({ tips: [] });
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));

  // Spy on Share.share via the already-mocked RN module — no requireActual needed.
  shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
});

afterEach(() => {
  shareSpy.mockRestore();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — handleShareConfirm passes the correct message to Share.share", () => {
  // ── Scenario 1: sport + streak > 1 ─────────────────────────────────────────

  it("includes sport suffix and streak suffix when both are provided", async () => {
    mockProfile = {
      name: "Alice",
      avatarUrl: null,
      level: "intermediate",
      sport: "running",
      weeklyGoal: 3,
      weeklyProgress: 3,
      trainingDays: [1, 2, 3, 4, 5],
    };
    mockProfileStats.mockResolvedValue({
      thisWeekCount: 3,
      streak:        7,
      totalAnalyses: 10,
      scoreDelta:    null,
      lastWeekCount: 2,
      personalBests: { technique: 0, power: 0, balance: 0, consistency: 0, mobility: 0, speed: 0 },
    });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    // Open the share preview modal
    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();

    // Confirm — triggers handleShareConfirm → Share.share
    await act(async () => { fireEvent.press(getByTestId("goal-share-confirm-btn")); });
    await flush();

    const expected = buildGoalShareMessage({
      sessionCount: 3,
      sport:        "running",
      streakDays:   7,
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy).toHaveBeenCalledWith({ message: expected });
    // Exact string guard — a change here signals a real message regression
    expect(expected).toBe(
      "I hit my weekly training goal on AthleteAI! 🏆 3 sessions this week (running). 7-day streak and counting!",
    );
  });

  // ── Scenario 2: no sport, streak = 1 ───────────────────────────────────────

  it("omits both sport suffix and streak suffix when sport is null and streak is 1", async () => {
    mockProfile = {
      name: "Bob",
      avatarUrl: null,
      level: "beginner",
      sport: null,
      weeklyGoal: 2,
      weeklyProgress: 2,
      trainingDays: [0, 1, 2, 3, 4, 5, 6],
    };
    mockProfileStats.mockResolvedValue({
      thisWeekCount: 2,
      streak:        1,
      totalAnalyses: 5,
      scoreDelta:    null,
      lastWeekCount: 0,
      personalBests: { technique: 0, power: 0, balance: 0, consistency: 0, mobility: 0, speed: 0 },
    });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();
    await act(async () => { fireEvent.press(getByTestId("goal-share-confirm-btn")); });
    await flush();

    const expected = buildGoalShareMessage({
      sessionCount: 2,
      sport:        null,
      streakDays:   1,
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy).toHaveBeenCalledWith({ message: expected });
    expect(expected).toBe(
      "I hit my weekly training goal on AthleteAI! 🏆 2 sessions this week.",
    );
  });

  // ── Scenario 3: no sport, streak = 0 ───────────────────────────────────────

  it("sends only the base message when sport is absent and streak is 0", async () => {
    mockProfile = {
      name: "Carol",
      avatarUrl: null,
      level: "advanced",
      sport: null,
      weeklyGoal: 4,
      weeklyProgress: 5,
      trainingDays: [0, 1, 2, 3, 4, 5, 6],
    };
    mockProfileStats.mockResolvedValue({
      thisWeekCount: 5,
      streak:        0,
      totalAnalyses: 20,
      scoreDelta:    null,
      lastWeekCount: 4,
      personalBests: { technique: 0, power: 0, balance: 0, consistency: 0, mobility: 0, speed: 0 },
    });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();
    await act(async () => { fireEvent.press(getByTestId("goal-share-confirm-btn")); });
    await flush();

    const expected = buildGoalShareMessage({
      sessionCount: 5,
      sport:        null,
      streakDays:   0,
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy).toHaveBeenCalledWith({ message: expected });
    expect(expected).toBe(
      "I hit my weekly training goal on AthleteAI! 🏆 5 sessions this week.",
    );
  });
});

// ─── Share card prop-wiring tests ─────────────────────────────────────────────

describe("HomeScreen — share card receives correct props from analysis record", () => {
  let MockShareCard: jest.Mock;

  beforeEach(() => {
    const mod = jest.requireMock("@/components/analysis/ShareCard") as {
      ShareCard: jest.Mock;
    };
    MockShareCard = mod.ShareCard;
    MockShareCard.mockClear();

    mockProfile = {
      name: "Dave",
      avatarUrl: null,
      level: "intermediate",
      sport: "running",
      weeklyGoal: 3,
      weeklyProgress: 3,
      trainingDays: [1, 2, 3, 4, 5],
    };
    mockProfileStats.mockResolvedValue({
      thisWeekCount: 3,
      streak:        5,
      totalAnalyses: 8,
      scoreDelta:    null,
      lastWeekCount: 2,
      personalBests: { technique: 0, power: 0, balance: 0, consistency: 0, mobility: 0, speed: 0 },
    });
  });

  // ── Scenario 4: correct analysis prop ──────────────────────────────────────

  it("passes the latest complete analysis record to ShareCard when the share preview opens", async () => {
    mockAnalysesGet.mockResolvedValue({ tips: [] });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    // Open share preview modal
    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();

    // ShareCard is rendered in both the off-screen capture view and the modal
    // preview — at least one call must carry the correct analysis record.
    const calls = MockShareCard.mock.calls as Array<[{ analysis: typeof ANALYSIS_ROW; topTip?: string }]>;
    const analysisProps = calls.map(([props]) => props.analysis);
    expect(analysisProps.some(a => a?.id === ANALYSIS_ROW.id)).toBe(true);
  });

  // ── Scenario 5: topTip wired through ───────────────────────────────────────

  it("passes topTip to ShareCard when latestTips contains a coaching tip", async () => {
    const TIP_TITLE = "Drive through your hips to increase power transfer";
    mockAnalysesGet.mockResolvedValue({
      tips: [
        {
          id:       "tip-1",
          tipType:  "technique",
          severity: "high",
          title:    TIP_TITLE,
          body:     "Focus on hip extension during the drive phase.",
          joint:    "hip",
          drills:   [],
          sources:  [],
        },
      ],
    });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    // Open share preview modal
    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();

    const calls = MockShareCard.mock.calls as Array<[{ analysis: typeof ANALYSIS_ROW; topTip?: string }]>;
    const topTipValues = calls.map(([props]) => props.topTip);
    expect(topTipValues.some(t => t === TIP_TITLE)).toBe(true);
  });

  // ── Scenario 6: captureRef called on Share CTA ─────────────────────────────

  it("calls captureRef once when the Share CTA is pressed and image sharing is available", async () => {
    const { isAvailableAsync, shareAsync } = jest.requireMock("expo-sharing") as {
      isAvailableAsync: jest.Mock;
      shareAsync:       jest.Mock;
    };
    const { captureRef } = jest.requireMock("react-native-view-shot") as {
      captureRef: jest.Mock;
    };

    // Enable image-sharing branch
    isAvailableAsync.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);
    captureRef.mockResolvedValue("file:///tmp/share-card.png");

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();
    await act(async () => { fireEvent.press(getByTestId("goal-share-confirm-btn")); });
    await flush();

    expect(captureRef).toHaveBeenCalledTimes(1);
  });
});
