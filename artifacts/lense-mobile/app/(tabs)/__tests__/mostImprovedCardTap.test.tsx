/**
 * Test: tapping the most-improved card scrolls to and selects that joint.
 *
 * When the user presses the most-improved card the component must:
 *   1. Set selectedJoint to the winning joint — verified by the JointHistorySheet
 *      being mounted with the correct `joint` prop.
 *   2. Call scrollTo on the ScrollView to bring the Joint Angle Trends section
 *      into view — verified by spying on ScrollView.prototype.scrollTo after
 *      the trends section fires its onLayout event (so trendsYRef.current > 0).
 *
 * Mocking strategy mirrors mostImprovedCard.test.tsx:
 *   - useFocusEffect is captured so tests control when focus fires.
 *   - @/lib/api mocks return trends data that contains a clear most-improved
 *     joint (leftKnee, deltaDeg 10) AND actual history for that joint so
 *     filteredTrends.joints[selectedJoint] is truthy and JointHistorySheet
 *     mounts.
 *   - JointHistorySheet is stubbed to a lightweight recorder component so we
 *     can assert which joint prop it received.
 *   - ScrollView.prototype.scrollTo is spied on to assert the scroll happens.
 *   - jest.useFakeTimers covers the 100 ms setTimeout that guards the scroll.
 */

import React from "react";
import { fireEvent, render, act } from "@testing-library/react-native";
import { ScrollView } from "react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList = jest.fn();
const mockAchievementsList = jest.fn();
const mockJointTrendsGet = jest.fn();

// Records the joint prop received by the JointHistorySheet stub.
let capturedJointProp: string | null = null;

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
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    getAllKeys: jest.fn(async () => []),
    multiGet: jest.fn(async () => []),
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

jest.mock("@/lib/api", () => ({
  progress: {
    list: (...args: any[]) => mockProgressList(...args),
    sports: jest.fn().mockResolvedValue({ sports: [] }),
    personalRecords: jest.fn().mockResolvedValue({ records: {} }),
    summary: jest.fn().mockResolvedValue({ summary: "" }),
  },
  achievements: {
    list: (...args: any[]) => mockAchievementsList(...args),
  },
  profile: {
    stats: jest.fn().mockRejectedValue(new Error("not needed")),
  },
  jointTrends: {
    get: (...args: any[]) => mockJointTrendsGet(...args),
  },
  movementSummaryHistory: {
    get: jest.fn().mockResolvedValue({ history: [] }),
  },
  analyses: {
    get: jest.fn().mockResolvedValue({ analysis: {}, tips: [], injuryRisks: [] }),
  },
}));

// Stub JointHistorySheet so we can assert the joint prop it receives.
jest.mock("@/components/JointHistorySheet", () => {
  const React = require("react");
  return function MockJointHistorySheet({ joint }: { joint: string }) {
    capturedJointProp = joint;
    return React.createElement(React.Fragment, null);
  };
});

// Import component AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_PROGRESS = { entries: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

// leftKnee has the highest deltaDeg (10) so it must win the mostImproved card.
// The joints object includes history for leftKnee so filteredTrends.joints
// is truthy, which causes JointHistorySheet to mount when selectedJoint is set.
const TRENDS_WITH_MOST_IMPROVED = {
  joints: {
    leftKnee: [
      { date: "2025-01-01T00:00:00Z", angle: 45, risk: 0 },
      { date: "2025-02-01T00:00:00Z", angle: 55, risk: 0 },
    ],
    rightHip: [
      { date: "2025-01-01T00:00:00Z", angle: 30, risk: 0 },
      { date: "2025-02-01T00:00:00Z", angle: 33, risk: 0 },
    ],
  },
  improvements: [
    { joint: "leftKnee", deltaDeg: 10, sessions: 2, improved: true },
    { joint: "rightHip", deltaDeg: 3, sessions: 2, improved: true },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
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
  mockFocusCallback = null;
  capturedJointProp = null;
  mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
  mockJointTrendsGet.mockResolvedValue(TRENDS_WITH_MOST_IMPROVED);
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — most-improved card tap", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("selects the most-improved joint when the card is pressed", async () => {
    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // The card subtitle must be visible before we press.
    expect(getByText("Most improved · tap to view trend")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText("Most improved · tap to view trend"));
    });
    await flush();

    // JointHistorySheet must mount with the winning joint.
    expect(capturedJointProp).toBe("leftKnee");
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("calls scrollTo toward the trends section when the card is pressed", async () => {
    jest.useFakeTimers();

    const scrollToSpy = jest
      .spyOn(ScrollView.prototype, "scrollTo")
      .mockImplementation(() => {});

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Fire the onLayout event on the Joint Angle Trends section so that
    // trendsYRef.current becomes > 0, which is the guard for the scrollTo call.
    const trendsSectionHeader = getByText("Joint Angle Trends");
    fireEvent(
      trendsSectionHeader.parent!.parent!,
      "layout",
      { nativeEvent: { layout: { x: 0, y: 320, width: 360, height: 400 } } },
    );

    // Press the card.
    await act(async () => {
      fireEvent.press(getByText("Most improved · tap to view trend"));
    });

    // Advance past the 100 ms setTimeout that defers the scroll.
    act(() => {
      jest.runAllTimers();
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ y: 320, animated: true });

    scrollToSpy.mockRestore();
  });
});
