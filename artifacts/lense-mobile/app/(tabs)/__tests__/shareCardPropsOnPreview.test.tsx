/**
 * Test: ShareCard receives the correct stat props when the share preview modal opens.
 *
 * What this test covers:
 *   - When the home screen is in the "goal reached" state (thisWeekCount=3, weeklyGoal=3,
 *     streak=5), tapping the share button opens the preview modal.
 *   - The ShareCard rendered inside the modal receives:
 *       sessions   = 3   (= stats.thisWeekCount)
 *       weeklyGoal = 3   (= profile.weeklyGoal)
 *       streakDays = 5   (= stats.streak)
 *
 * Mocking strategy:
 *   - @/components/ShareCard is replaced with a prop-capturing mock that stores
 *     the most-recent props it receives so the test can assert them.
 *   - Everything else mirrors the approach used in sharePreviewModal.test.tsx.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { Share } from "react-native";

// ─── Module-level state ───────────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();

/** Props captured by the ShareCard mock on every render. */
let capturedShareCardProps: Record<string, unknown> | null = null;

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
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
  default:   () => null,
  Svg:       () => null,
  Circle:    () => null,
  Path:      () => null,
  Line:      () => null,
  Polyline:  () => null,
  Text:      () => null,
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
    profile:        {
      name:           "Alice",
      avatarUrl:      null,
      level:          "intermediate",
      sport:          "running",
      weeklyGoal:     3,
      weeklyProgress: 3,
      trainingDays:   [1, 2, 3, 4, 5],
    },
    updateProfile:  jest.fn(async () => {}),
    refreshProfile: jest.fn(async () => {}),
  }),
  useTier: () => "free",
}));

jest.mock("@/lib/api", () => ({
  analyses:    {
    list: (...a: any[]) => mockAnalysesList(...a),
    get:  jest.fn().mockRejectedValue(new Error("not needed")),
  },
  achievements: { list: (...a: any[]) => mockAchievementsList(...a) },
  profile:     { stats: (...a: any[]) => mockProfileStats(...a) },
  jointTrends: { get:  (...a: any[]) => mockJointTrendsGet(...a) },
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

jest.mock("../../../utils/scheduleUtils", () => ({
  computeScheduleSummary: jest.fn(() => "Mon–Fri"),
}));

// ShareCard mock — captures every set of props it receives so we can assert
// which values the home screen passes.  index.tsx uses the named export from
// @/components/analysis/ShareCard with props: { analysis, topTip, weeklyStats }
jest.mock("@/components/analysis/ShareCard", () => {
  const { View } = jest.requireActual("react-native");
  const MockCard = (props: any) => {
    // Store latest props at module scope so the test can read them.
    capturedShareCardProps = { ...props };
    return <View testID="share-card-preview" />;
  };
  return {
    __esModule: true,
    ShareCard:        MockCard,
    SHARE_CARD_DARK:  {},
    SHARE_CARD_LIGHT: {},
  };
});

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

// ─── Shared test data ─────────────────────────────────────────────────────────

const GOAL_REACHED_STATS = {
  thisWeekCount:  3,
  lastWeekCount:  2,
  totalAnalyses:  8,
  streak:         5,
  scoreDelta:     null,
  weeklyGoal:     3,
  weeklyProgress: 3,
  personalBests:  { technique: 0, power: 0, balance: 0, consistency: 0, mobility: 0, speed: 0 },
};

const ONE_COMPLETE_ANALYSIS = {
  analyses: [
    {
      id:               "a1",
      status:           "complete",
      sport:            "running",
      uploadedAt:       new Date().toISOString(),
      overallScore:     85,
      techniqueScore:   80,
      powerScore:       75,
      balanceScore:     70,
      consistencyScore: 65,
      mobilityScore:    60,
      speedScore:       55,
    },
  ],
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

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback       = null;
  capturedShareCardProps  = null;

  mockAnalysesList.mockResolvedValue(ONE_COMPLETE_ANALYSIS);
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(GOAL_REACHED_STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));

  jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — ShareCard receives correct stat props when preview opens", () => {
  it("passes sessions=3, weeklyGoal=3, and streakDays=5 to ShareCard when the modal is visible", async () => {
    const { getByTestId, getByText } = render(<HomeScreen />);
    await simulateFocus();

    // Open the share preview modal
    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();

    // Modal is open
    expect(getByText("Share your achievement")).toBeTruthy();

    // ShareCard must have been rendered with the expected stat props.
    // Props shape: { analysis, topTip, weeklyStats: { sessions, weeklyGoal, streakDays } }
    expect(capturedShareCardProps).not.toBeNull();
    expect(capturedShareCardProps).toMatchObject({
      weeklyStats: { sessions: 3, weeklyGoal: 3, streakDays: 5 },
    });
  });
});
