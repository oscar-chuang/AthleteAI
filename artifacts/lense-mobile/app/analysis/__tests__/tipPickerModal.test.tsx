/**
 * Test: tip picker inside the share preview modal.
 *
 * Verified behaviours:
 *   1. When the analysis has multiple tips, the picker is visible and lists all
 *      tip titles.
 *   2. Tapping a non-default tip updates the tip text passed to ShareCard.
 *   3. When the analysis has only one tip, the picker is not rendered.
 */

import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";

// ─── Capture useFocusEffect callback ─────────────────────────────────────────
let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Controlled mock functions ────────────────────────────────────────────────
const mockAnalysesGet  = jest.fn();
const mockAnalysesList = jest.fn();
const mockCaptureRef   = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync   = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "tip-picker-test-1" }),
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

jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn(async () => {}),
}));

jest.mock("expo-file-system", () => ({
  copyAsync:            jest.fn(async () => {}),
  deleteAsync:          jest.fn(async () => {}),
  getContentUriAsync:   jest.fn(async (uri: string) => `content://${uri}`),
  documentDirectory:    "file:///docs/",
  cacheDirectory:       "file:///cache/",
}));

jest.mock("react-native-view-shot", () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync:       (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
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
    delete: jest.fn(async () => ({ success: true })),
    update: jest.fn(async () => ({ success: true })),
  },
  profile: {
    stats:  jest.fn(async () => ({ thisWeekCount: 1 })),
    get:    jest.fn(async () => ({
      profile: {
        weeklyGoal: 5, sport: "running", level: "beginner",
        name: "Tester", avatarUrl: null, weeklyGoalCelebratedAt: null,
      },
      subscription: { id: "free", userId: "1", tier: "free", status: "active" },
    })),
    update: jest.fn(async () => ({ profile: { weeklyGoal: 5 } })),
  },
  jointTrends: { get: jest.fn().mockResolvedValue({ joints: {} }) },
  movementSummaryHistory: { get: jest.fn().mockResolvedValue({ history: [] }) },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile: {
      weeklyGoal: 5, sport: "running", level: "beginner",
      name: "Tester", avatarUrl: null,
    },
    refreshProfile: jest.fn(async () => {}),
  }),
  useCanAccessFeature: () => true,
}));

jest.mock("@/utils/notifications", () => ({
  scheduleImprovementNotification: jest.fn(async () => {}),
}));

jest.mock("@/components/ScoreRing",                     () => ({ ScoreRing:            () => null }));
jest.mock("@/components/analysis/ScoreCard",            () => ({
  ScoreCard:    () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader",        () => ({ SectionHeader:        () => null }));
jest.mock("@/components/analysis/NextFocusCard",        () => ({ NextFocusCard:        () => null }));
jest.mock("@/components/analysis/AnimatedLoadingState", () => ({ AnimatedLoadingState: () => null }));

// ShareCard renders `topTip` as text so we can assert which tip is featured.
jest.mock("@/components/analysis/ShareCard", () => {
  const { Text } = require("react-native");
  return {
    ShareCard: ({ topTip }: { topTip?: string }) =>
      topTip ? <Text testID="share-card-tip">{topTip}</Text> : null,
    SHARE_CARD_DARK:  {},
    SHARE_CARD_LIGHT: {},
  };
});

// Import AFTER all mocks are registered.
import AnalysisDetailScreen from "../[id]";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_ANALYSIS = {
  id:                  "tip-picker-test-1",
  title:               "Sprint Session",
  sport:               "running",
  status:              "complete",
  uploadedAt:          "2024-03-10T09:00:00Z",
  overallScore:        75,
  techniqueScore:      70,
  powerScore:          80,
  balanceScore:        72,
  consistencyScore:    68,
  mobilityScore:       76,
  speedScore:          82,
  jointAngles:         null,
  jointRisks:          null,
  biomechanicsApplied: false,
};

// Three tips sorted by severity (critical → warning → info).
const TIPS_MULTI = [
  {
    id: "tip-a",
    title: "Fix knee alignment",
    description: "Your knee is caving inward.",
    severity: "critical",
    category: "Technique",
    joints: [],
    drill: null,
    source: null,
    videoObservation: null,
    whyItMatters: null,
  },
  {
    id: "tip-b",
    title: "Improve hip extension",
    description: "Extend hips fully at push-off.",
    severity: "warning",
    category: "Power",
    joints: [],
    drill: null,
    source: null,
    videoObservation: null,
    whyItMatters: null,
  },
  {
    id: "tip-c",
    title: "Relax your shoulders",
    description: "Tension in shoulders wastes energy.",
    severity: "info",
    category: "Efficiency",
    joints: [],
    drill: null,
    source: null,
    videoObservation: null,
    whyItMatters: null,
  },
];

const TIPS_SINGLE = [TIPS_MULTI[0]!];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

async function openShareModal() {
  fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;

  mockCaptureRef.mockReset();
  mockIsAvailableAsync.mockReset();
  mockShareAsync.mockReset();
  mockAnalysesGet.mockReset();
  mockAnalysesList.mockResolvedValue({ analyses: [] });

  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockResolvedValue("file:///tmp/share-card.png");
  mockShareAsync.mockResolvedValue(undefined);

  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — tip picker in share modal", () => {
  it("shows the picker with all tip titles when there are multiple tips", async () => {
    mockAnalysesGet.mockResolvedValue({
      analysis:    BASE_ANALYSIS,
      tips:        TIPS_MULTI,
      injuryRisks: [],
    });

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    // The picker section label should be visible.
    expect(screen.getByText("Choose which tip to feature")).toBeTruthy();

    // Every tip title must appear in the picker list.
    // "Fix knee alignment" is the default tip so it also appears in the
    // ShareCard — use getAllByText and assert at least one element is present.
    expect(screen.getAllByText("Fix knee alignment").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Improve hip extension").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Relax your shoulders").length).toBeGreaterThanOrEqual(1);
  });

  it("defaults the ShareCard preview to the top (critical) tip", async () => {
    mockAnalysesGet.mockResolvedValue({
      analysis:    BASE_ANALYSIS,
      tips:        TIPS_MULTI,
      injuryRisks: [],
    });

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    // The critical tip is first — it should be featured by default.
    // Two ShareCard instances render (hidden capture + visible preview), both
    // receive the same topTip prop, so we check that every card shows it.
    const cards = screen.getAllByTestId("share-card-tip");
    expect(cards.length).toBeGreaterThanOrEqual(1);
    cards.forEach((card) =>
      expect(card.props.children).toBe("Fix knee alignment"),
    );
  });

  it("updates the ShareCard preview when a different tip is tapped", async () => {
    mockAnalysesGet.mockResolvedValue({
      analysis:    BASE_ANALYSIS,
      tips:        TIPS_MULTI,
      injuryRisks: [],
    });

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    // Default is the critical tip.
    screen
      .getAllByTestId("share-card-tip")
      .forEach((card) =>
        expect(card.props.children).toBe("Fix knee alignment"),
      );

    // Tap the warning tip in the picker (getAllByText because ShareCard also
    // renders the tip title once selected — take the first match, which is
    // always the picker row).
    fireEvent.press(screen.getAllByText("Improve hip extension")[0]!);
    await flush();

    // Both ShareCard instances should now show the warning tip.
    screen
      .getAllByTestId("share-card-tip")
      .forEach((card) =>
        expect(card.props.children).toBe("Improve hip extension"),
      );
  });

  it("does not render the picker when there is only one tip", async () => {
    mockAnalysesGet.mockResolvedValue({
      analysis:    BASE_ANALYSIS,
      tips:        TIPS_SINGLE,
      injuryRisks: [],
    });

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    // The picker label must not appear for a single tip.
    expect(screen.queryByText("Choose which tip to feature")).toBeNull();
  });
});
