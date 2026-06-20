/**
 * Unit tests: the Breakdown chip on Home screen Recent Sessions cards.
 *
 * The Breakdown chip is a TouchableOpacity rendered inside each session card
 * when the analysis is "complete" AND AsyncStorage has a non-empty
 * `frameTicks_<id>` entry (written by the skeleton scanner after a scan).
 *
 * Mocking strategy mirrors goalPicker.test.tsx / homeAvatarHeader.test.tsx:
 *   - useFocusEffect is captured so tests fire it manually.
 *   - @react-native-async-storage/async-storage is mocked with a conditional
 *     getItem so individual tests can control which frameTicks entries exist.
 *   - @/lib/api is stubbed to return controlled analysis fixtures.
 *   - All heavy native deps (SVG, Haptics, Sharing, etc.) are stubbed out.
 *
 * Covered scenarios:
 *   1. Chip is present for a scanned analysis (non-empty frameTicks in storage).
 *   2. Chip is absent for an unscanned analysis (null frameTicks in storage).
 *   3. When two analyses exist, chip shows only for the scanned one.
 *   4. Tapping the chip calls router.push with the correct /analysis/live/<id>.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Module-level mutable state ───────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;
let mockRouterPush: jest.Mock;

const mockAnalysesList     = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats     = jest.fn();
const mockJointTrendsGet   = jest.fn();
const mockAnalysesGet      = jest.fn();

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
    user:          { id: "u1", name: "Test Athlete", email: "test@test.com" },
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
  useTier: () => "free",
}));

jest.mock("@/lib/api", () => ({
  analyses:    {
    list: () => mockAnalysesList(),
    get:  (id: string) => mockAnalysesGet(id),
  },
  achievements: { list: () => mockAchievementsList() },
  profile:      { stats: () => mockProfileStats() },
  jointTrends:  { get:  () => mockJointTrendsGet() },
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
  persistCelebrationToServer: jest.fn(async () => {}),
  retryCelebrationSync:       jest.fn(async () => {}),
}));

jest.mock("@/lib/sessionDelta", () => ({
  buildDeltaMap: jest.fn(() => new Map()),
}));

jest.mock("@/components/ShareCard", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/WeekDotRow", () => ({
  WeekDotRow: () => null,
}));

jest.mock("@/utils/shareCardCapture", () => ({
  HIDDEN_SHARE_CARD_STYLE:    { opacity: 0 },
  SHARE_CARD_CAPTURE_OPTIONS: {},
}));

// ─── Component import (must come after all mocks) ─────────────────────────────

import HomeScreen from "../index";

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

const BASE_STATS = {
  thisWeekCount: 1,
  lastWeekCount: 0,
  streak:        0,
  totalAnalyses: 1,
  scoreDelta:    null,
  personalBests: {},
};

const FRAME_TICKS_JSON = JSON.stringify([
  { time: 0.5, risk: "high", jointKey: "leftKnee" },
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

  mockAchievementsList.mockResolvedValue({ achievements: [] });
  mockProfileStats.mockResolvedValue(BASE_STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
  mockAnalysesGet.mockResolvedValue({ tips: [] });

  (AsyncStorage.getItem as jest.Mock).mockImplementation(async () => null);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — Breakdown chip visibility", () => {
  // ── Test 1 ─────────────────────────────────────────────────────────────────

  it("shows the chip for an analysis that has frameTicks in AsyncStorage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === `frameTicks_${SCANNED_ID}`) return FRAME_TICKS_JSON;
      return null;
    });

    mockAnalysesList.mockResolvedValue({ analyses: [SCANNED_ANALYSIS] });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    expect(getByTestId(`breakdown-chip-${SCANNED_ID}`)).toBeTruthy();
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  it("does NOT show the chip for an analysis with no frameTicks in AsyncStorage", async () => {
    mockAnalysesList.mockResolvedValue({ analyses: [UNSCANNED_ANALYSIS] });

    const { queryByTestId } = render(<HomeScreen />);
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

    const { getByTestId, queryByTestId } = render(<HomeScreen />);
    await simulateFocus();

    expect(getByTestId(`breakdown-chip-${SCANNED_ID}`)).toBeTruthy();
    expect(queryByTestId(`breakdown-chip-${UNSCANNED_ID}`)).toBeNull();
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  it("chip is tappable when a DeltaBadge is also present on the same card", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === `frameTicks_${SCANNED_ID}`) return FRAME_TICKS_JSON;
      return null;
    });

    const { buildDeltaMap } = jest.requireMock("@/lib/sessionDelta") as { buildDeltaMap: jest.Mock };
    buildDeltaMap.mockReturnValue(
      new Map([
        [
          SCANNED_ID,
          { jointKey: "leftKnee", direction: "improved", deltaPct: 5, label: "Left Knee" },
        ],
      ])
    );

    mockAnalysesList.mockResolvedValue({ analyses: [SCANNED_ANALYSIS] });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    const chip = getByTestId(`breakdown-chip-${SCANNED_ID}`);
    expect(chip).toBeTruthy();
    fireEvent.press(chip, { stopPropagation: jest.fn() });
    expect(mockRouterPush).toHaveBeenCalledWith(`/analysis/live/${SCANNED_ID}`);
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────

  it("tapping the chip calls router.push with the correct /analysis/live/<id> path", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === `frameTicks_${SCANNED_ID}`) return FRAME_TICKS_JSON;
      return null;
    });

    mockAnalysesList.mockResolvedValue({ analyses: [SCANNED_ANALYSIS] });

    const { getByTestId } = render(<HomeScreen />);
    await simulateFocus();

    fireEvent.press(getByTestId(`breakdown-chip-${SCANNED_ID}`), { stopPropagation: jest.fn() });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith(`/analysis/live/${SCANNED_ID}`);
  });
});
