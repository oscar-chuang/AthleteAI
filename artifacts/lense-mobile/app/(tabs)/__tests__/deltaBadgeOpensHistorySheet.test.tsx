/**
 * Tests: tapping a delta badge on the Analyze screen opens JointHistorySheet
 * with the correct `currentAnalysisId` (the tapped session's id).
 *
 * When an analysis card has joint-history data available (hasHistory = true),
 * tapping its delta badge calls setHistoryJoint + setHistoryAnalysisId, which
 * mounts JointHistorySheet with `currentAnalysisId` equal to that card's id.
 * Inside JointHistorySheet, that causes `isCurrent = true` for the matching
 * dot, producing the purple glow ring and "This session" legend.  The legend
 * text is verified in components/__tests__/JointHistorySheet.test.tsx; here we
 * verify the prop is forwarded correctly from the screen.
 *
 * Mocking strategy mirrors breakdownChip.test.tsx:
 *   - useFocusEffect is captured so tests fire focus manually.
 *   - buildDeltaMap is mocked to return a badge for the tapped session only.
 *   - jointTrends.get returns history for the badge's jointKey so hasHistory=true.
 *   - JointHistorySheet is stubbed to capture currentAnalysisId.
 *   - All native deps (SVG, Haptics, ImagePicker, etc.) are stubbed.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mutable state ───────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;
let mockRouterPush: jest.Mock;

const mockAnalysesList   = jest.fn();
const mockJointTrendsGet = jest.fn();

/** Records the currentAnalysisId prop forwarded to the JointHistorySheet stub. */
let capturedCurrentAnalysisId: string | undefined;

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push:     (route: string) => mockRouterPush(route),
    back:     jest.fn(),
    replace:  jest.fn(),
    navigate: jest.fn(),
  }),
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

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync:       jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync:             jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync:                   jest.fn(async () => ({ canceled: true, assets: [] })),
  MediaTypeOptions:                    { Videos: "Videos" },
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

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(async () => "file://mock.png"),
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
    user:    { id: "u1", name: "Test Athlete", email: "test@test.com" },
    profile: {
      weeklyGoal:     3,
      name:           "Test Athlete",
      level:          "intermediate",
      sport:          "running",
      avatarUrl:      null,
      trainingDays:   [0, 1, 2, 3, 4, 5, 6],
      weeklyProgress: 1,
    },
    updateProfile: jest.fn(async () => {}),
  }),
  useCanAccessFeature: () => false,
}));

jest.mock("@/lib/api", () => ({
  analyses:    { list: () => mockAnalysesList() },
  jointTrends: { get:  () => mockJointTrendsGet() },
  ApiError:    class ApiError extends Error {},
}));

jest.mock("@/lib/sessionDelta", () => ({
  buildDeltaMap: jest.fn(() => new Map()),
}));

/**
 * JointHistorySheet stub: captures currentAnalysisId and exposes a
 * "Close sheet" button so tests can exercise dismissal.
 */
jest.mock("@/components/JointHistorySheet", () => {
  const React = require("react");
  const { TouchableOpacity, Text } = require("react-native");
  return function MockJointHistorySheet({
    currentAnalysisId,
    onClose,
  }: {
    currentAnalysisId?: string;
    onClose: () => void;
  }) {
    capturedCurrentAnalysisId = currentAnalysisId;
    return (
      <TouchableOpacity testID="close-sheet-btn" onPress={onClose}>
        <Text>Close sheet</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock("@/components/RecordingTipsModal", () => ({
  __esModule: true,
  default: () => null,
  RECORDING_TIPS_KEY: "recording_tips_dismissed",
}));

jest.mock("@/components/ui/SkeletonLoader", () => ({
  SkeletonCard: () => null,
}));

// ─── Component import (must come after all mocks) ─────────────────────────────

import { buildDeltaMap } from "@/lib/sessionDelta";
import AnalyzeScreen from "../analyze";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TAPPED_ID = "session-tapped";
const OTHER_ID  = "session-other";
const JOINT_KEY = "leftKnee";

const makeAnalysis = (id: string) => ({
  id,
  title:        `Session ${id}`,
  sport:        "running",
  status:       "complete" as const,
  uploadedAt:   new Date().toISOString(),
  overallScore: 75,
  thumbnailUrl: null,
  duration:     null,
});

/**
 * Trends payload with both session ids so hasHistory is true for TAPPED_ID.
 * TAPPED_ID is the second data point (index 1 → currentIdx = 1, isCurrent=true).
 */
const TRENDS_WITH_LEFT_KNEE = {
  joints: {
    [JOINT_KEY]: [
      { analysisId: OTHER_ID,  date: "2026-01-01T00:00:00Z", angle: 45, risk: 0, sport: "running" },
      { analysisId: TAPPED_ID, date: "2026-02-01T00:00:00Z", angle: 50, risk: 0, sport: "running" },
    ],
  },
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
  mockFocusCallback         = null;
  mockRouterPush            = jest.fn();
  capturedCurrentAnalysisId = undefined;

  mockAnalysesList.mockResolvedValue({
    analyses: [makeAnalysis(TAPPED_ID), makeAnalysis(OTHER_ID)],
  });
  mockJointTrendsGet.mockResolvedValue(TRENDS_WITH_LEFT_KNEE);

  (buildDeltaMap as jest.Mock).mockReturnValue(new Map([
    [TAPPED_ID, { jointKey: JOINT_KEY, jointLabel: "Left Knee", delta: 5, color: "#22c55e" }],
  ]));
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalyzeScreen — delta badge tap passes currentAnalysisId to JointHistorySheet", () => {
  it("renders a tappable delta badge for the session that has joint history", async () => {
    const { getByTestId } = render(<AnalyzeScreen />);
    await simulateFocus();

    expect(getByTestId(`delta-badge-${TAPPED_ID}`)).toBeTruthy();
  });

  it("JointHistorySheet is not mounted before the badge is tapped", async () => {
    const { queryByTestId } = render(<AnalyzeScreen />);
    await simulateFocus();

    expect(queryByTestId("close-sheet-btn")).toBeNull();
    expect(capturedCurrentAnalysisId).toBeUndefined();
  });

  it("tapping the delta badge opens JointHistorySheet with the tapped session's id", async () => {
    const { getByTestId } = render(<AnalyzeScreen />);
    await simulateFocus();

    await act(async () => {
      fireEvent.press(getByTestId(`delta-badge-${TAPPED_ID}`), {
        stopPropagation: jest.fn(),
      });
    });
    await flush();

    expect(getByTestId("close-sheet-btn")).toBeTruthy();
    expect(capturedCurrentAnalysisId).toBe(TAPPED_ID);
  });

  it("dismisses the sheet when onClose fires", async () => {
    const { getByTestId, queryByTestId } = render(<AnalyzeScreen />);
    await simulateFocus();

    await act(async () => {
      fireEvent.press(getByTestId(`delta-badge-${TAPPED_ID}`), {
        stopPropagation: jest.fn(),
      });
    });
    await flush();

    expect(queryByTestId("close-sheet-btn")).not.toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("close-sheet-btn"));
    });
    await flush();

    expect(queryByTestId("close-sheet-btn")).toBeNull();
  });
});
