/**
 * Test: the 'Latest session →' link on joint rows in the Progress tab.
 *
 * Each joint row derives `latestAnalysisId` from the most recent entry's
 * `analysisId` field.  The link (testID `joint-session-link-<joint>`) is
 * rendered only when `latestAnalysisId` is truthy.  Pressing it must call
 * `router.push` with `/analysis/skeleton/<latestAnalysisId>`.
 *
 * Three cases are covered:
 *   1. Link renders and navigates when the latest data-point has an analysisId.
 *   2. Link is absent when the latest data-point has no analysisId.
 *   3. Link is absent when the latest data-point has an empty-string analysisId.
 *
 * Mocking strategy mirrors jointRowOpensHistorySheet.test.tsx:
 *   - useFocusEffect is captured so tests control when focus fires.
 *   - @/lib/api returns joint-trends data tailored per test.
 *   - JointHistorySheet is stubbed to a no-op (not under test here).
 *   - react-native-svg is stubbed to null (crashes in the RN test env).
 */

import React from "react";
import { fireEvent, render, act } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockJointTrendsGet   = jest.fn();
const mockRouterPush       = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter:            () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn() }),
  useFocusEffect:       (cb: () => (() => void) | void) => { mockFocusCallback = cb; },
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default:    () => null,
  Svg:        () => null,
  Line:       () => null,
  Path:       () => null,
  Polyline:   () => null,
  Circle:     () => null,
  Text:       () => null,
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

jest.mock("@/lib/api", () => ({
  progress: {
    list:            (...args: any[]) => mockProgressList(...args),
    sports:          jest.fn().mockResolvedValue({ sports: [] }),
    personalRecords: jest.fn().mockResolvedValue({ records: {} }),
    summary:         jest.fn().mockResolvedValue({ summary: "" }),
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

jest.mock("@/components/JointHistorySheet", () => {
  const React = require("react");
  return function MockJointHistorySheet() {
    return React.createElement(React.Fragment, null);
  };
});

// Import component AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_PROGRESS     = { entries: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

/** Trends where the latest leftKnee entry has a real analysisId. */
const TRENDS_WITH_ANALYSIS_ID = {
  joints: {
    leftKnee: [
      { date: "2026-01-01T00:00:00Z", angle: 45, risk: 0, sport: "running", analysisId: "older-id" },
      { date: "2026-02-01T00:00:00Z", angle: 50, risk: 0, sport: "running", analysisId: "latest-id-abc" },
    ],
  },
  improvements: [
    { joint: "leftKnee", deltaDeg: 5, sessions: 2, improved: true },
  ],
};

/** Trends where the latest leftKnee entry has no analysisId field. */
const TRENDS_WITHOUT_ANALYSIS_ID = {
  joints: {
    leftKnee: [
      { date: "2026-01-01T00:00:00Z", angle: 45, risk: 0, sport: "running" },
      { date: "2026-02-01T00:00:00Z", angle: 50, risk: 0, sport: "running" },
    ],
  },
  improvements: [
    { joint: "leftKnee", deltaDeg: 5, sessions: 2, improved: true },
  ],
};

/** Trends where the latest leftKnee entry has an empty-string analysisId. */
const TRENDS_WITH_EMPTY_ANALYSIS_ID = {
  joints: {
    leftKnee: [
      { date: "2026-01-01T00:00:00Z", angle: 45, risk: 0, sport: "running", analysisId: "older-id" },
      { date: "2026-02-01T00:00:00Z", angle: 50, risk: 0, sport: "running", analysisId: "" },
    ],
  },
  improvements: [
    { joint: "leftKnee", deltaDeg: 5, sessions: 2, improved: true },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 6) {
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
  mockRouterPush.mockClear();
  mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — 'Latest session' link on joint rows", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("renders the link when the latest data-point has an analysisId", async () => {
    mockJointTrendsGet.mockResolvedValue(TRENDS_WITH_ANALYSIS_ID);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // The joint row itself must be visible.
    expect(getByText("Left Knee")).toBeTruthy();

    // The 'Latest session' link must appear.
    expect(getByText("Latest session")).toBeTruthy();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("calls router.push with the skeleton route when the link is pressed", async () => {
    mockJointTrendsGet.mockResolvedValue(TRENDS_WITH_ANALYSIS_ID);

    const { getByTestId } = render(<ProgressScreen />);
    await simulateFocus();

    const link = getByTestId("joint-session-link-leftKnee");

    await act(async () => {
      fireEvent.press(link);
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/analysis/skeleton/latest-id-abc");
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("does not render the link when the latest data-point has no analysisId", async () => {
    mockJointTrendsGet.mockResolvedValue(TRENDS_WITHOUT_ANALYSIS_ID);

    const { queryByTestId, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByTestId("joint-session-link-leftKnee")).toBeNull();
    expect(queryByText("Latest session")).toBeNull();
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("does not render the link when the latest data-point has an empty-string analysisId", async () => {
    mockJointTrendsGet.mockResolvedValue(TRENDS_WITH_EMPTY_ANALYSIS_ID);

    const { queryByTestId, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByTestId("joint-session-link-leftKnee")).toBeNull();
    expect(queryByText("Latest session")).toBeNull();
  });
});
