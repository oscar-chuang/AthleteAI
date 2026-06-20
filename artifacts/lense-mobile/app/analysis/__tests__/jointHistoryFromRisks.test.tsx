/**
 * Test: tapping a joint row in the "Joint Health" section of the Analysis
 * results screen opens JointHistorySheet pre-seeded with that joint's data.
 *
 * Strategy:
 *   - The full [id].tsx screen is heavily coupled to expo-router, native APIs,
 *     and multiple async data sources.  We render the complete screen with
 *     all external modules mocked, wait for data to settle, then simulate a
 *     tap on a joint risk card and assert the sheet mounts with the correct
 *     joint prop.
 *   - JointHistorySheet is stubbed to a lightweight recorder that exposes a
 *     testID so we can confirm mounting / unmounting.
 *   - @/lib/api returns a complete fixture so the risk cards render and
 *     jointTrendsData is populated, enabling the hasHistory guard.
 */

import React from "react";
import { fireEvent, render, act } from "@testing-library/react-native";

// ─── Module-level state ───────────────────────────────────────────────────────

let capturedJointProp: string | null = null;

const mockAnalysesGet  = jest.fn();
const mockJointTrendsGet = jest.fn();

// ─── Module mocks — must be declared before the component import ──────────────

jest.mock("expo-router", () => ({
  useRouter:            () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect:       (cb: () => (() => void) | void) => { cb(); },
  useLocalSearchParams: () => ({ id: "a1" }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("expo-image", () => ({
  Image: () => null,
}));

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn().mockResolvedValue("file://mock.jpg"),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
}));

jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  getContentUriAsync: jest.fn().mockResolvedValue("content://mock"),
}));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default:    () => null,
  Svg:        () => null,
  Line:       () => null,
  Path:       () => null,
  Polyline:   () => null,
  Circle:     () => null,
  Text:       () => null,
  Rect:       () => null,
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

jest.mock("@/utils/mediaLibrary", () => ({
  saveToLibraryAsync: jest.fn().mockResolvedValue(undefined),
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

jest.mock("@/hooks/useSharePreview", () => ({
  useSharePreview: () => ({
    showSharePreview:     false,
    handleShare:          jest.fn(),
    handleCancelShare:    jest.fn(),
  }),
}));

jest.mock("@/hooks/useCardStagger", () => ({
  useCardStagger: (_vis: boolean, count: number) =>
    Array.from({ length: count }, () => false),
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({ profile: null }),
}));

jest.mock("@/lib/api", () => ({
  analyses: {
    get:    (...args: any[]) => mockAnalysesGet(...args),
    list:   jest.fn().mockResolvedValue({ analyses: [] }),
    delete: jest.fn(),
  },
  profile: {
    stats: jest.fn().mockRejectedValue(new Error("not needed")),
    get:   jest.fn().mockRejectedValue(new Error("not needed")),
  },
  jointTrends: {
    get: (...args: any[]) => mockJointTrendsGet(...args),
  },
  drills: {
    list: jest.fn().mockResolvedValue({ drills: [] }),
  },
}));

/**
 * Stub JointHistorySheet — records the joint prop and exposes a close button.
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
      <TouchableOpacity testID="joint-history-sheet-close" onPress={onClose}>
        <Text testID="joint-history-sheet-label">{joint}</Text>
      </TouchableOpacity>
    );
  };
});

// Import AFTER all mocks.
import AnalysisDetailScreen from "../[id]";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_ANALYSIS = {
  id: "a1",
  userId: "u1",
  title: "Sprint Session",
  sport: "running",
  status: "complete",
  uploadedAt: "2026-06-01T08:00:00.000Z",
  overallScore: 74,
  techniqueScore: 80,
  powerScore: 70,
  balanceScore: 65,
  consistencyScore: 78,
  mobilityScore: 72,
  speedScore: 82,
  biomechanicsApplied: true,
};

const RISKS = [
  {
    id: "r1",
    joint: "leftKnee",
    riskPercent: 55,
    description: "High valgus stress on left knee.",
    prevention: "Strengthen hip abductors.",
  },
];

const TRENDS_WITH_LEFT_KNEE = {
  joints: {
    leftKnee: [
      { date: "2026-04-01T00:00:00Z", angle: 42, risk: 1, sport: "running", analysisId: "prev1" },
      { date: "2026-06-01T00:00:00Z", angle: 55, risk: 2, sport: "running", analysisId: "a1"   },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  capturedJointProp = null;
  mockAnalysesGet.mockResolvedValue({ analysis: BASE_ANALYSIS, tips: [], injuryRisks: RISKS });
  mockJointTrendsGet.mockResolvedValue(TRENDS_WITH_LEFT_KNEE);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — joint row tap opens JointHistorySheet", () => {
  it("mounts JointHistorySheet with the correct joint when a joint risk row is tapped", async () => {
    const { getByTestId, queryByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    // Sheet must not be open before tap.
    expect(queryByTestId("joint-history-sheet-label")).toBeNull();
    expect(capturedJointProp).toBeNull();

    // Tap the leftKnee risk row.
    await act(async () => {
      fireEvent.press(getByTestId("joint-risk-row-leftKnee"));
    });
    await flush();

    // JointHistorySheet stub must be mounted with the correct joint.
    expect(capturedJointProp).toBe("leftKnee");
    expect(queryByTestId("joint-history-sheet-label")).not.toBeNull();
  });

  it("dismisses the sheet when onClose is called", async () => {
    const { getByTestId, queryByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    // Open the sheet.
    await act(async () => {
      fireEvent.press(getByTestId("joint-risk-row-leftKnee"));
    });
    await flush();

    expect(queryByTestId("joint-history-sheet-close")).not.toBeNull();

    // Close the sheet via the stub's close button.
    await act(async () => {
      fireEvent.press(getByTestId("joint-history-sheet-close"));
    });
    await flush();

    // Sheet must be unmounted.
    expect(queryByTestId("joint-history-sheet-close")).toBeNull();
  });

  it("does not open the sheet when the joint has no trend history", async () => {
    // Return trends with a different joint — leftKnee has no history.
    mockJointTrendsGet.mockResolvedValue({ joints: { rightKnee: [] } });

    const { getByTestId, queryByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("joint-risk-row-leftKnee"));
    });
    await flush();

    // Sheet must remain closed because hasHistory is false for leftKnee.
    expect(queryByTestId("joint-history-sheet-label")).toBeNull();
  });
});
