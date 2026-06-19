/**
 * Regression test: the failed-scan state screen rendered by the Analysis Detail
 * screen when analysis.status === "failed".
 *
 * Behaviours verified:
 *   1. The heading "We couldn't process this video" is visible.
 *   2. A "Try again" button is present.
 *   3. Tapping "Try again" calls router.push with "/(tabs)/analyze".
 *
 * Mocking strategy:
 *   - expo-router's useFocusEffect is captured so we control when load() fires.
 *   - analysesApi.get resolves immediately with status === "failed".
 *   - All heavy sub-components are stubbed to null — this test focuses solely on
 *     the StateScreen rendered for the failed state.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mock state ───────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockRouterPush    = jest.fn();
const mockRouterBack    = jest.fn();
const mockRouterReplace = jest.fn();

const mockAnalysesGet  = jest.fn();
const mockAnalysesList = jest.fn();

// ─── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "failed-analysis-1" }),
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

// ─── Fixture data ──────────────────────────────────────────────────────────────

const FAILED_ANALYSIS = {
  id:                  "failed-analysis-1",
  title:               "Morning Run",
  sport:               "running",
  status:              "failed",
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback = null;
  mockRouterPush.mockReset();
  mockRouterBack.mockReset();
  mockAnalysesGet.mockReset();
  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockAnalysesGet.mockResolvedValue({ analysis: FAILED_ANALYSIS, tips: [], injuryRisks: [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — failed-scan state", () => {
  it("shows the heading 'We couldn't process this video'", async () => {
    const { getByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    expect(getByText("We couldn't process this video")).toBeTruthy();
  });

  it("shows a 'Try again' button", async () => {
    const { getByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    expect(getByText("Try again")).toBeTruthy();
  });

  it("navigates to the Analyze tab when 'Try again' is tapped", async () => {
    const { getByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    fireEvent.press(getByText("Try again"));

    expect(mockRouterPush).toHaveBeenCalledWith("/(tabs)/analyze");
  });

  it("calls router.back() when 'Go back' is tapped", async () => {
    const { getByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    fireEvent.press(getByText("Go back"));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
