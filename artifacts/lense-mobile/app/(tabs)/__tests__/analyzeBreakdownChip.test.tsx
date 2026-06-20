/**
 * Unit tests: the Breakdown chip on the Analyze screen session history cards.
 *
 * The Breakdown chip is rendered inside each session card on the Analyses tab
 * when the analysis is "complete" AND AsyncStorage has a non-empty
 * `frameTicks_<id>` entry (written by the skeleton scanner after a scan).
 *
 * Mocking strategy mirrors breakdownChip.test.tsx (HomeScreen variant):
 *   - useFocusEffect is captured so tests fire it manually.
 *   - @react-native-async-storage/async-storage is mocked with a conditional
 *     getItem so individual tests can control which frameTicks entries exist.
 *   - @/lib/api is stubbed to return controlled analysis fixtures.
 *   - All heavy native deps (expo-image-picker, SVG, etc.) are stubbed out.
 *
 * Covered scenarios:
 *   1. Chip is present for an analysis that has frameTicks in AsyncStorage.
 *   2. Chip is absent for an analysis with no frameTicks in AsyncStorage.
 *   3. When two analyses exist, chip shows only for the scanned one.
 *   4. Tapping the chip calls router.push with the correct /analysis/live/<id>.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Module-level mutable state ───────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;
let mockRouterPush: jest.Mock;

const mockAnalysesList   = jest.fn();
const mockJointTrendsGet = jest.fn();

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
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default:   () => null,
  Svg:       () => null,
  Line:      () => null,
  Path:      () => null,
  Polyline:  () => null,
  Circle:    () => null,
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

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestCameraPermissionsAsync:       jest.fn(async () => ({ status: "granted" })),
  launchImageLibraryAsync:             jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync:                   jest.fn(async () => ({ canceled: true, assets: [] })),
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
      weeklyGoal:   3,
      name:         "Test Athlete",
      level:        "intermediate",
      sport:        "running",
      avatarUrl:    null,
      trainingDays: [0, 1, 2, 3, 4, 5, 6],
    },
    updateProfile: jest.fn(async () => {}),
  }),
  useCanAccessFeature: jest.fn(() => true),
}));

jest.mock("@/lib/api", () => ({
  analyses:   {
    list:   () => mockAnalysesList(),
    create: jest.fn(async () => ({ analysis: { id: "new-id" } })),
  },
  jointTrends: { get: () => mockJointTrendsGet() },
  ApiError:    class ApiError extends Error { code = ""; },
}));

jest.mock("@/lib/sessionDelta", () => ({
  buildDeltaMap: jest.fn(() => new Map()),
}));

jest.mock("@/components/RecordingTipsModal", () => ({
  __esModule:       true,
  default:          () => null,
  RECORDING_TIPS_KEY: "recording_tips_dismissed",
}));

jest.mock("@/components/JointHistorySheet", () => ({
  __esModule: true,
  default:    () => null,
}));

jest.mock("@/utils/formatDisplay", () => ({
  toTitleCase: (s: string) => s,
}));

// ─── Component import (must come after all mocks) ─────────────────────────────

import AnalyzeScreen from "../analyze";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SCANNED_ID   = "analysis-scanned";
const UNSCANNED_ID = "analysis-unscanned";

const makeAnalysis = (id: string) => ({
  id,
  title:        `Session ${id}`,
  sport:        "running",
  status:       "complete" as const,
  uploadedAt:   new Date().toISOString(),
  overallScore: 75,
  thumbnailUrl: null,
});

const SCANNED_ANALYSIS   = makeAnalysis(SCANNED_ID);
const UNSCANNED_ANALYSIS = makeAnalysis(UNSCANNED_ID);

const FRAME_TICKS_JSON = JSON.stringify([
  { time: 0.5, risk: "high",   jointKey: "leftKnee" },
  { time: 1.2, risk: "medium", jointKey: "rightHip" },
]);

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

beforeEach(() => {
  mockFocusCallback = null;
  mockRouterPush    = jest.fn();

  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async () => null);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalyzeScreen — Breakdown chip visibility", () => {
  // ── Test 1 ─────────────────────────────────────────────────────────────────

  it("shows the chip for an analysis that has frameTicks in AsyncStorage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === `frameTicks_${SCANNED_ID}`) return FRAME_TICKS_JSON;
      return null;
    });

    mockAnalysesList.mockResolvedValue({ analyses: [SCANNED_ANALYSIS] });

    const { getByTestId } = render(<AnalyzeScreen />);
    await simulateFocus();

    expect(getByTestId(`breakdown-chip-${SCANNED_ID}`)).toBeTruthy();
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  it("does NOT show the chip for an analysis with no frameTicks in AsyncStorage", async () => {
    mockAnalysesList.mockResolvedValue({ analyses: [UNSCANNED_ANALYSIS] });

    const { queryByTestId } = render(<AnalyzeScreen />);
    await simulateFocus();

    expect(queryByTestId(`breakdown-chip-${UNSCANNED_ID}`)).toBeNull();
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  it("shows the chip only for the scanned session when both types are present", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === `frameTicks_${SCANNED_ID}`) return FRAME_TICKS_JSON;
      return null;
    });

    mockAnalysesList.mockResolvedValue({
      analyses: [SCANNED_ANALYSIS, UNSCANNED_ANALYSIS],
    });

    const { getByTestId, queryByTestId } = render(<AnalyzeScreen />);
    await simulateFocus();

    expect(getByTestId(`breakdown-chip-${SCANNED_ID}`)).toBeTruthy();
    expect(queryByTestId(`breakdown-chip-${UNSCANNED_ID}`)).toBeNull();
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  it("tapping the chip calls router.push with the correct /analysis/live/<id> path", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === `frameTicks_${SCANNED_ID}`) return FRAME_TICKS_JSON;
      return null;
    });

    mockAnalysesList.mockResolvedValue({ analyses: [SCANNED_ANALYSIS] });

    const { getByTestId } = render(<AnalyzeScreen />);
    await simulateFocus();

    fireEvent.press(
      getByTestId(`breakdown-chip-${SCANNED_ID}`),
      { stopPropagation: jest.fn() },
    );

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith(`/analysis/live/${SCANNED_ID}`);
  });
});
