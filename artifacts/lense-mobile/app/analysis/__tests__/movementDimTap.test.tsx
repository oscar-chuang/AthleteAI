/**
 * Test: tapping a Movement Quality ring on the Analysis Results screen
 * opens MovementDimensionHistorySheet with the correct dimension and a
 * trend window anchored to the current analysis ID.
 *
 * Strategy:
 *   - Render the full [id].tsx screen with all external modules mocked.
 *   - Stub MovementDimensionHistorySheet to a lightweight recorder that
 *     captures the props passed to it and exposes a close button.
 *   - Provide an analysis fixture with a movementSummary so the ring row
 *     renders, and a movementSummaryHistory that spans several sessions.
 *   - Assert: tap opens the sheet; dimensionKey / label / color are correct;
 *     data is anchored to the tapped analysis (not unrelated future sessions);
 *     closing the sheet unmounts it.
 */

import React from "react";
import { fireEvent, render, act } from "@testing-library/react-native";

// ─── Module-level state ───────────────────────────────────────────────────────

let capturedDimKey:   string | null = null;
let capturedLabel:    string | null = null;
let capturedColor:    string | null = null;
let capturedData:     unknown[]     = [];

const mockAnalysesGet          = jest.fn();
const mockMovementHistoryGet   = jest.fn();

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

jest.mock("expo-image", () => ({ Image: () => null }));

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn().mockResolvedValue("file://mock.jpg"),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn(),
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
    destructive:     "#ff4d6d",
    warning:         "#f59e0b",
  }),
}));

jest.mock("@/hooks/useSharePreview", () => ({
  useSharePreview: () => ({
    showSharePreview:  false,
    handleShare:       jest.fn(),
    handleCancelShare: jest.fn(),
    handleDoShare:     jest.fn(),
  }),
}));

jest.mock("@/utils/formatBiomechanics", () => ({
  formatBiomechanicsText: (t: string) => t,
}));

jest.mock("@/utils/shareCardCapture", () => ({
  SHARE_CARD_CAPTURE_OPTIONS: { format: "png", quality: 1, result: "tmpfile" },
  HIDDEN_SHARE_CARD_STYLE:    { position: "absolute", opacity: 0 },
}));

const HISTORY = [
  { analysisId: "a-old1", date: "2026-03-01T00:00:00.000Z", sport: "running", flowScore: 60, efficiencyScore: 62, bodyControlScore: 58, consistencyScore: 61, rhythmScore: 59, overallScore: 60 },
  { analysisId: "a-old2", date: "2026-04-01T00:00:00.000Z", sport: "running", flowScore: 65, efficiencyScore: 66, bodyControlScore: 63, consistencyScore: 64, rhythmScore: 62, overallScore: 64 },
  { analysisId: "a1",     date: "2026-06-01T00:00:00.000Z", sport: "running", flowScore: 72, efficiencyScore: 74, bodyControlScore: 70, consistencyScore: 71, rhythmScore: 69, overallScore: 71 },
  { analysisId: "a-new1", date: "2026-07-01T00:00:00.000Z", sport: "running", flowScore: 80, efficiencyScore: 82, bodyControlScore: 78, consistencyScore: 79, rhythmScore: 77, overallScore: 79 },
];

jest.mock("@/lib/api", () => ({
  analyses: {
    get:    (...args: unknown[]) => mockAnalysesGet(...args),
    list:   jest.fn().mockResolvedValue({ analyses: [] }),
    delete: jest.fn(),
  },
  profile: {
    stats: jest.fn().mockResolvedValue({ thisWeekCount: 1 }),
    get:   jest.fn().mockResolvedValue({
      profile: { weeklyGoal: 3, sport: "running", level: "beginner", name: "Tester", avatarUrl: null, weeklyGoalCelebratedAt: null },
      subscription: { id: "free", userId: "1", tier: "free", status: "active" },
    }),
  },
  jointTrends: { get: jest.fn().mockResolvedValue({ joints: {} }) },
  movementSummaryHistory: { get: (...args: unknown[]) => mockMovementHistoryGet(...args) },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile: { weeklyGoal: 3, sport: "running", level: "beginner", name: "Tester", avatarUrl: null },
  }),
  useCanAccessFeature: () => true,
}));

jest.mock("@/components/JointHistorySheet", () => () => null);

/**
 * Stub MovementDimensionHistorySheet — captures props and exposes a close button.
 */
jest.mock("@/components/MovementDimensionHistorySheet", () => {
  const React = require("react");
  const { TouchableOpacity, Text, View } = require("react-native");
  return function MockMovementDimensionHistorySheet({
    dimensionKey,
    label,
    color,
    data,
    onClose,
  }: {
    dimensionKey: string;
    label: string;
    color: string;
    data: unknown[];
    onClose: () => void;
  }) {
    capturedDimKey = dimensionKey;
    capturedLabel  = label;
    capturedColor  = color;
    capturedData   = data;
    return (
      <View testID="movement-dim-sheet">
        <Text testID="movement-dim-sheet-label">{label}</Text>
        <TouchableOpacity testID="movement-dim-sheet-close" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

import AnalysisDetailScreen from "../[id]";

// ─── Fixture ──────────────────────────────────────────────────────────────────

const MOVEMENT_SUMMARY = {
  overallScore: 71,
  coachSummary: "Good session overall.",
  flowScore: 72,
  efficiencyScore: 74,
  bodyControlScore: 70,
  consistencyScore: 71,
  rhythmScore: 69,
  topStrengths: ["Strong rhythm"],
  topImprovements: ["Improve efficiency"],
  mostImportantFix: "Work on body control",
};

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
  movementSummary: MOVEMENT_SUMMARY,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

beforeEach(() => {
  capturedDimKey = null;
  capturedLabel  = null;
  capturedColor  = null;
  capturedData   = [];
  mockAnalysesGet.mockResolvedValue({ analysis: BASE_ANALYSIS, tips: [], injuryRisks: [] });
  mockMovementHistoryGet.mockResolvedValue({ history: HISTORY });
});

afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — Movement Quality ring tap", () => {
  it("opens MovementDimensionHistorySheet with the correct dimensionKey and label when Flow ring is tapped", async () => {
    const { getByTestId, queryByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    expect(queryByTestId("movement-dim-sheet")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("movement-dim-flow"));
    });
    await flush();

    expect(queryByTestId("movement-dim-sheet")).not.toBeNull();
    expect(capturedDimKey).toBe("flowScore");
    expect(capturedLabel).toBe("Flow");
    expect(capturedColor).toBe("#6c63ff");
  });

  it("opens MovementDimensionHistorySheet with correct props when Control ring is tapped", async () => {
    const { getByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("movement-dim-control"));
    });
    await flush();

    expect(capturedDimKey).toBe("bodyControlScore");
    expect(capturedLabel).toBe("Control");
    expect(capturedColor).toBe("#f59e0b");
  });

  it("closes the sheet when onClose is called", async () => {
    const { getByTestId, queryByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("movement-dim-flow"));
    });
    await flush();

    expect(queryByTestId("movement-dim-sheet")).not.toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("movement-dim-sheet-close"));
    });
    await flush();

    expect(queryByTestId("movement-dim-sheet")).toBeNull();
  });

  it("anchors the history window to the current analysis — excludes sessions newer than analysis a1", async () => {
    const { getByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("movement-dim-flow"));
    });
    await flush();

    // The current analysis is "a1" (2026-06-01). The newer session "a-new1"
    // (2026-07-01) must NOT appear in the data passed to the sheet.
    const ids = (capturedData as { analysisId: string }[]).map((d) => d.analysisId);
    expect(ids).toContain("a1");
    expect(ids).not.toContain("a-new1");
  });

  it("limits the trend window to at most 3 sessions ending at the current analysis", async () => {
    const { getByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("movement-dim-efficiency"));
    });
    await flush();

    // HISTORY has 4 entries but window must be capped at 3, anchored at "a1"
    expect(capturedData.length).toBeLessThanOrEqual(3);
    const ids = (capturedData as { analysisId: string }[]).map((d) => d.analysisId);
    // The window should be a-old2, a1 (and a-old1 if only 3 total before a1)
    expect(ids).toContain("a1");
    expect(ids).not.toContain("a-new1");
  });

  it("injects the viewed session as a synthetic datapoint when the current analysis is absent from history", async () => {
    // History that does NOT contain the current analysis ("a1")
    mockMovementHistoryGet.mockResolvedValue({
      history: [
        { analysisId: "other-a", date: "2026-01-01T00:00:00.000Z", sport: "running", flowScore: 55, efficiencyScore: 56, bodyControlScore: 54, consistencyScore: 55, rhythmScore: 53, overallScore: 55 },
      ],
    });

    const { getByTestId } = render(<AnalysisDetailScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("movement-dim-flow"));
    });
    await flush();

    // The injected synthetic datapoint must be the last element with analysisId "a1"
    // and flowScore matching BASE_ANALYSIS.movementSummary.flowScore (72).
    const data = capturedData as { analysisId: string; flowScore: number }[];
    const synthetic = data.find((d) => d.analysisId === "a1");
    expect(synthetic).toBeDefined();
    expect(synthetic?.flowScore).toBe(MOVEMENT_SUMMARY.flowScore);
  });
});
