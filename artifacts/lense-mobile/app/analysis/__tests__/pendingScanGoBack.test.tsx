/**
 * Regression test: the "Go back" button on the pending/processing state screen.
 *
 * When a poll-exhausted pending/processing analysis is displayed, the screen
 * renders a StateScreen with a secondary "Go back" button. This test asserts
 * that tapping that button calls router.back().
 *
 * Key mechanics:
 *   - analysesApi.get resolves immediately with status === "pending".
 *   - Jest fake timers advance past 45 × 4000 ms so pollExhausted flips to
 *     true, which switches from AnimatedLoadingState to the timed-out
 *     StateScreen containing the "Go back" button.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mock state ────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockRouterPush    = jest.fn();
const mockRouterBack    = jest.fn();
const mockRouterReplace = jest.fn();

const mockAnalysesGet  = jest.fn();
const mockAnalysesList = jest.fn();

// ─── Module mocks ────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "pending-analysis-1" }),
  useRouter: () => ({
    push:    mockRouterPush,
    back:    mockRouterBack,
    replace: mockRouterReplace,
  }),
  useFocusEffect: (cb: () => (() => void) | void) => {
    mockFocusCallback = cb;
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("expo-image", () => ({ Image: () => null }));

jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn() }));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync:       jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(() => Promise.resolve(null)),
    setItem:    jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
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

jest.mock("@/lib/api", () => ({
  analyses: {
    get:    (...args: unknown[]) => mockAnalysesGet(...args),
    list:   (...args: unknown[]) => mockAnalysesList(...args),
    delete: jest.fn(),
  },
  profile: {
    stats:  jest.fn().mockResolvedValue({ thisWeekCount: 0 }),
    get:    jest.fn().mockResolvedValue({ profile: { weeklyGoal: 3, sport: "running" } }),
    update: jest.fn().mockResolvedValue({
      profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null, weeklyGoalCelebratedAt: null },
    }),
  },
  jointTrends: { get: jest.fn().mockResolvedValue({ joints: {} }) },
  movementSummaryHistory: { get: jest.fn().mockResolvedValue({ history: [] }) },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile:        { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null },
    refreshProfile: jest.fn(async () => {}),
  }),
  useCanAccessFeature: () => true,
}));

jest.mock("@/components/ScoreRing",                       () => ({ ScoreRing:             () => null }));
jest.mock("@/components/analysis/ScoreCard",              () => ({
  ScoreCard:    () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader",          () => ({ SectionHeader:          () => null }));
jest.mock("@/components/analysis/NextFocusCard",          () => ({ NextFocusCard:          () => null }));
jest.mock("@/components/analysis/AnimatedLoadingState",   () => ({ AnimatedLoadingState:   () => null }));
jest.mock("@/components/analysis/ShareCard",              () => ({
  ShareCard:        () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

// Import the screen AFTER all mocks are registered.
import AnalysisDetailScreen from "../[id]";

// ─── Fixture data ────────────────────────────────────────────────────────────

const PENDING_ANALYSIS = {
  id:                  "pending-analysis-1",
  title:               "Morning Run",
  sport:               "running",
  status:              "pending",
  uploadedAt:          "2024-01-15T08:00:00Z",
  overallScore:        null,
  techniqueScore:      null,
  powerScore:          null,
  balanceScore:        null,
  consistencyScore:    null,
  mobilityScore:       null,
  speedScore:          null,
  jointAngles:         null,
  jointRisks:          null,
  biomechanicsApplied: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => {
    mockFocusCallback?.();
  });
  await flush();
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;
  mockRouterPush.mockReset();
  mockRouterBack.mockReset();
  mockAnalysesGet.mockReset();
  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockAnalysesGet.mockResolvedValue({ analysis: PENDING_ANALYSIS, tips: [], injuryRisks: [] });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — pending/processing state", () => {
  it("calls router.back() when 'Go back' is tapped after poll exhaustion", async () => {
    const { getByText } = render(<AnalysisDetailScreen />);

    await simulateFocus();

    // The poll setInterval fires every 4 000 ms.  On the 46th tick count
    // reaches 46 (> 45) and setPollExhausted(true) is called.
    // Advance 46 × 4 000 + 100 ms to guarantee that 46th tick fires.
    await act(async () => {
      jest.advanceTimersByTime(46 * 4000 + 100);
    });

    await flush();

    fireEvent.press(getByText("Go back"));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("shows 'Taking longer than usual' heading after poll exhaustion", async () => {
    const { getByText } = render(<AnalysisDetailScreen />);

    await simulateFocus();

    await act(async () => {
      jest.advanceTimersByTime(46 * 4000 + 100);
    });

    await flush();

    expect(getByText("Taking longer than usual")).toBeTruthy();
  });
});
