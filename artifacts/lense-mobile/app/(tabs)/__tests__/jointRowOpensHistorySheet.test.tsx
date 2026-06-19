/**
 * Test: tapping a joint row on the Progress tab opens the JointHistorySheet.
 *
 * The Progress screen renders a TouchableOpacity for each joint in
 * filteredTrends.joints.  Pressing the row sets selectedJoint, which causes
 * the JointHistorySheet modal to mount.  Calling onClose (via the X button
 * or backdrop) resets selectedJoint to null and unmounts the sheet.
 *
 * Mocking strategy mirrors mostImprovedCardTap.test.tsx:
 *   - useFocusEffect is captured so tests fire focus manually.
 *   - @/lib/api returns joint trends data for leftKnee so the row is rendered
 *     and filteredTrends.joints[selectedJoint] is truthy.
 *   - JointHistorySheet is stubbed to a lightweight recorder component that
 *     (a) captures the joint prop and (b) exposes a "Close sheet" button that
 *     calls onClose so we can verify dismissal.
 *   - react-native-svg is stubbed to null (crashes in the RN test env).
 */

import React from "react";
import { fireEvent, render, act } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList    = jest.fn();
const mockAchievementsList = jest.fn();
const mockJointTrendsGet  = jest.fn();

/** Records the joint prop passed into the JointHistorySheet stub. */
let capturedJointProp: string | null = null;

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

/**
 * Stub JointHistorySheet so tests can:
 *   1. Confirm it mounted with the right joint prop.
 *   2. Invoke onClose to verify the sheet is dismissed.
 */
jest.mock("@/components/JointHistorySheet", () => {
  const React = require("react");
  const { TouchableOpacity, Text } = require("react-native");
  return function MockJointHistorySheet({
    joint,
    onClose,
  }: {
    joint: string;
    onClose: () => void;
  }) {
    capturedJointProp = joint;
    return (
      <TouchableOpacity testID="close-sheet-btn" onPress={onClose}>
        <Text>Close sheet</Text>
      </TouchableOpacity>
    );
  };
});

// Import component AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_PROGRESS     = { entries: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

/**
 * Trends payload with two data-points for leftKnee so that:
 *   - The joint row renders (history.length >= 1).
 *   - filteredTrends.joints["leftKnee"] is truthy, causing JointHistorySheet
 *     to mount once selectedJoint is set.
 */
const TRENDS_WITH_LEFT_KNEE = {
  joints: {
    leftKnee: [
      { date: "2026-01-01T00:00:00Z", angle: 45, risk: 0, sport: "running", analysisId: "a1" },
      { date: "2026-02-01T00:00:00Z", angle: 50, risk: 0, sport: "running", analysisId: "a2" },
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
  mockFocusCallback  = null;
  capturedJointProp  = null;
  mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
  mockJointTrendsGet.mockResolvedValue(TRENDS_WITH_LEFT_KNEE);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — joint row tap opens JointHistorySheet", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("mounts JointHistorySheet with the tapped joint when a joint row is pressed", async () => {
    const { getByText, queryByTestId } = render(<ProgressScreen />);
    await simulateFocus();

    // The joint row label must appear before we press it.
    expect(getByText("Left Knee")).toBeTruthy();

    // Sheet must not be open yet.
    expect(queryByTestId("close-sheet-btn")).toBeNull();
    expect(capturedJointProp).toBeNull();

    // Press the joint row.
    await act(async () => {
      fireEvent.press(getByText("Left Knee"));
    });
    await flush();

    // JointHistorySheet stub must be mounted with the correct joint prop.
    expect(capturedJointProp).toBe("leftKnee");
    expect(queryByTestId("close-sheet-btn")).not.toBeNull();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("dismisses the sheet when onClose is called (e.g. pressing the X button)", async () => {
    const { getByText, queryByTestId } = render(<ProgressScreen />);
    await simulateFocus();

    // Open the sheet by tapping the joint row.
    await act(async () => {
      fireEvent.press(getByText("Left Knee"));
    });
    await flush();

    // Confirm the sheet is open.
    expect(queryByTestId("close-sheet-btn")).not.toBeNull();

    // Dismiss the sheet via the stub's close button (maps to onClose).
    await act(async () => {
      fireEvent.press(queryByTestId("close-sheet-btn")!);
    });
    await flush();

    // The sheet must be unmounted after onClose fires.
    expect(queryByTestId("close-sheet-btn")).toBeNull();
  });
});
