/**
 * Unit test: the "X of Y" session counter in the Analysis Detail screen.
 *
 * Key behaviours verified:
 *   1. When the current analysis is the second of three siblings, the counter
 *      renders "2 of 3".
 *   2. When there is only one sibling (siblingIds.length === 1) the counter
 *      is absent from the tree.
 *
 * Mocking strategy:
 *   - analysesApi.list returns a controlled set of complete analyses that
 *     become the siblingIds array (sorted newest-first by uploadedAt).
 *   - analysesApi.get returns a minimal complete analysis for the current id.
 *   - useFocusEffect is captured so we can trigger the screen's load() cycle.
 *   - All heavy sub-components are stubbed so the render stays fast.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Module-level mock state ───────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesGet  = jest.fn();
const mockAnalysesList = jest.fn();

// ─── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "session-b" }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
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
  shareAsync: jest.fn(),
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
    get:   jest.fn().mockResolvedValue({
      profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null },
      subscription: { plan: "free" },
    }),
    stats: jest.fn().mockResolvedValue({ thisWeekCount: 1 }),
  },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null },
    refreshProfile: jest.fn(async () => {}),
  }),
  useCanAccessFeature: () => true,
}));

jest.mock("@/components/ScoreRing", () => ({ ScoreRing: () => null }));
jest.mock("@/components/analysis/ScoreCard", () => ({
  ScoreCard:    () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader",        () => ({ SectionHeader:        () => null }));
jest.mock("@/components/analysis/NextFocusCard",        () => ({ NextFocusCard:        () => null }));
jest.mock("@/components/analysis/AnimatedLoadingState", () => ({ AnimatedLoadingState: () => null }));
jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:        () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

// Import the screen AFTER all mocks are registered.
import AnalysisDetailScreen from "../[id]";

// ─── Fixture data ──────────────────────────────────────────────────────────────

/** The analysis the screen is currently showing (id = "session-b"). */
const CURRENT_ANALYSIS = {
  id:               "session-b",
  title:            "Track Session",
  sport:            "running",
  status:           "complete",
  uploadedAt:       "2024-01-16T10:00:00Z",
  overallScore:     72,
  techniqueScore:   70,
  powerScore:       75,
  balanceScore:     68,
  consistencyScore: 65,
  mobilityScore:    80,
  speedScore:       74,
  jointAngles:      null,
  jointRisks:       null,
  biomechanicsApplied: false,
};

/**
 * Three complete sessions ordered so that "session-a" is newest and
 * "session-c" is oldest.  siblingIds will therefore be:
 *   index 0 → "session-a"
 *   index 1 → "session-b"  ← current session
 *   index 2 → "session-c"
 * Counter must read "2 of 3".
 */
const THREE_ANALYSES = [
  { id: "session-a", status: "complete", uploadedAt: "2024-01-17T12:00:00Z" },
  { id: "session-b", status: "complete", uploadedAt: "2024-01-16T10:00:00Z" },
  { id: "session-c", status: "complete", uploadedAt: "2024-01-15T08:00:00Z" },
];

/** Single-entry list: counter must be hidden. */
const ONE_ANALYSIS = [
  { id: "session-b", status: "complete", uploadedAt: "2024-01-16T10:00:00Z" },
];

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
  mockAnalysesGet.mockReset();
  mockAnalysesList.mockReset();

  // Default: current analysis loads as complete.
  mockAnalysesGet.mockResolvedValue({
    analysis:    CURRENT_ANALYSIS,
    tips:        [],
    injuryRisks: [],
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — session counter", () => {
  it("shows '2 of 3' when the current session is second in a list of three", async () => {
    mockAnalysesList.mockResolvedValue({ analyses: THREE_ANALYSES });

    const { queryByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    expect(queryByText("2 of 3")).not.toBeNull();
  });

  it("hides the counter when siblingIds has exactly one entry", async () => {
    mockAnalysesList.mockResolvedValue({ analyses: ONE_ANALYSIS });

    const { queryByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    // Neither "1 of 1" nor any "X of Y" pattern should be present.
    expect(queryByText(/\d+ of \d+/)).toBeNull();
  });

  it("carries accessibilityLabel='Session 2 of 3' when the current session is second in a list of three", async () => {
    mockAnalysesList.mockResolvedValue({ analyses: THREE_ANALYSES });

    const { getByLabelText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    expect(getByLabelText("Session 2 of 3")).not.toBeNull();
  });

  it("has no session-counter accessibility label when siblingIds has exactly one entry", async () => {
    mockAnalysesList.mockResolvedValue({ analyses: ONE_ANALYSIS });

    const { queryByLabelText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    expect(queryByLabelText(/^Session \d+ of \d+$/)).toBeNull();
  });
});
