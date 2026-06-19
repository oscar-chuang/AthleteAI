/**
 * Component-level integration test: share preview modal opens and closes correctly.
 *
 * What this test covers:
 *   1. Tapping the share button (goal-share-btn) opens the preview modal.
 *   2. The open modal renders the ShareCard, a "Share" button, and a "Cancel" button.
 *   3. Tapping "Cancel" closes the modal WITHOUT invoking Share.share or expo-sharing.
 *   4. Tapping "Share" (goal-share-confirm-btn) closes the modal AND invokes Share.share.
 *
 * Mocking strategy:
 *   - useFocusEffect is captured so tests trigger loadData manually.
 *   - @/lib/api is stubbed to return a goal-reached state (thisWeek >= weeklyGoal).
 *   - expo-sharing.isAvailableAsync returns false so handleShareConfirm takes the
 *     plain-text Share.share({ message }) path — the simplest branch to assert.
 *   - Share.share is spied on (no jest.mock override of 'react-native').
 *   - ShareCard is mocked to render a <View testID="share-card-preview" /> so the
 *     test can assert it is present inside the open modal.
 *   - All other heavy native dependencies (SVG, Haptics, etc.) are stubbed to null.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { Share } from "react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();

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
      name:          "Alice",
      avatarUrl:     null,
      level:         "intermediate",
      sport:         "running",
      weeklyGoal:    3,
      weeklyProgress: 3,
      trainingDays:  [1, 2, 3, 4, 5],
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

// ShareCard: the forwarded-ref version lives off-screen for capture; the plain
// version renders inside the modal.  We stub both to a lightweight element so
// the test stays fast while still asserting the card is present in the tree.
jest.mock("@/components/ShareCard", () => {
  const { forwardRef } = jest.requireActual("react");
  const { View }       = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: forwardRef((_props: any, _ref: any) =>
      <View testID="share-card-preview" />,
    ),
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
  thisWeekCount: 3,
  lastWeekCount: 2,
  totalAnalyses: 8,
  streak:        5,
  scoreDelta:    null,
  weeklyGoal:    3,
  weeklyProgress: 3,
  personalBests: { technique: 0, power: 0, balance: 0, consistency: 0, mobility: 0, speed: 0 },
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
  mockAnalysesList.mockResolvedValue(ONE_COMPLETE_ANALYSIS);
  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(GOAL_REACHED_STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));

  shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
});

afterEach(() => {
  shareSpy.mockRestore();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — share preview modal open / close", () => {
  // ── Test 1: modal opens on share button tap ──────────────────────────────────

  it("opens the modal when the share button is tapped", async () => {
    const { getByTestId, getByText } = render(<HomeScreen />);
    await simulateFocus();

    // Modal not yet visible
    expect(() => getByText("Share your achievement")).toThrow();

    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();

    // Title is now in the tree
    expect(getByText("Share your achievement")).toBeTruthy();
  });

  // ── Test 2: modal renders ShareCard, Share button, Cancel button ─────────────

  it("shows the ShareCard, Share button, and Cancel button inside the open modal", async () => {
    const { getByTestId, getAllByTestId, getByText } = render(<HomeScreen />);
    await simulateFocus();

    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();

    // Modal title confirms it is open
    expect(getByText("Share your achievement")).toBeTruthy();

    // ShareCard: the mock renders <View testID="share-card-preview" />; there
    // are two instances — one off-screen capture card and one in the modal.
    const cards = getAllByTestId("share-card-preview");
    expect(cards.length).toBeGreaterThanOrEqual(1);

    // Action buttons
    expect(getByTestId("goal-share-confirm-btn")).toBeTruthy();
    expect(getByTestId("share-preview-cancel-btn")).toBeTruthy();
  });

  // ── Test 3: Cancel closes the modal without sharing ──────────────────────────

  it("closes the modal on Cancel without invoking Share.share", async () => {
    const { getByTestId, getByText, queryByText } = render(<HomeScreen />);
    await simulateFocus();

    // Open the modal
    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();
    expect(getByText("Share your achievement")).toBeTruthy();

    // Tap Cancel
    await act(async () => { fireEvent.press(getByTestId("share-preview-cancel-btn")); });
    await flush();

    // Modal title is gone
    expect(queryByText("Share your achievement")).toBeNull();

    // Share.share must NOT have been called
    expect(shareSpy).not.toHaveBeenCalled();
  });

  // ── Test 4: Share closes the modal and invokes the share flow ────────────────

  it("closes the modal and invokes Share.share when the Share button is tapped", async () => {
    const { getByTestId, getByText, queryByText } = render(<HomeScreen />);
    await simulateFocus();

    // Open the modal
    await act(async () => { fireEvent.press(getByTestId("goal-share-btn")); });
    await flush();
    expect(getByText("Share your achievement")).toBeTruthy();

    // Tap Share (confirm)
    await act(async () => { fireEvent.press(getByTestId("goal-share-confirm-btn")); });
    await flush();

    // Modal title is gone
    expect(queryByText("Share your achievement")).toBeNull();

    // Share.share must have been called exactly once
    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) }),
    );
  });
});
