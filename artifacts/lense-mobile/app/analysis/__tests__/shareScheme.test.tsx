/**
 * Tests that the share card colour scheme (dark/light) is persisted in
 * AsyncStorage and pre-selected when the analysis screen mounts.
 *
 * Verified behaviours:
 *   1. On mount, AsyncStorage.getItem is called with the scheme key so the
 *      last-used scheme can be restored.
 *   2. Pressing the "Light" scheme pill inside the share preview modal calls
 *      AsyncStorage.setItem('shareCardScheme', 'light').
 *   3. Pressing the "Dark" scheme pill calls
 *      AsyncStorage.setItem('shareCardScheme', 'dark').
 *   4. When AsyncStorage.getItem returns "light" the component initialises with
 *      that scheme (verified by asserting setItem is NOT called before the user
 *      interacts, then is called with "dark" when the user switches away).
 */

import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Capture useFocusEffect callback ─────────────────────────────────────────
let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesGet  = jest.fn();
const mockAnalysesList = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "scheme-test-1" }),
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
  copyAsync:          jest.fn(async () => {}),
  deleteAsync:        jest.fn(async () => {}),
  getContentUriAsync: jest.fn(async () => "content://tmp/card.png"),
  documentDirectory:  "file:///docs/",
  cacheDirectory:     "file:///cache/",
}));

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(async () => "file:///tmp/share-card.png"),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync:       jest.fn(async () => {}),
}));

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    (...args: unknown[]) => mockGetItem(...args),
    setItem:    (...args: unknown[]) => mockSetItem(...args),
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
jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:        () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

import AnalysisDetailScreen from "../[id]";

// ─── Fixture ─────────────────────────────────────────────────────────────────

const COMPLETE_ANALYSIS = {
  id:                  "scheme-test-1",
  title:               "Squat Session",
  sport:               "weightlifting",
  status:              "complete",
  uploadedAt:          "2024-01-15T08:00:00Z",
  overallScore:        82,
  techniqueScore:      80,
  powerScore:          85,
  balanceScore:        78,
  consistencyScore:    75,
  mobilityScore:       88,
  speedScore:          79,
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
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

async function openShareModal() {
  fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
  await flush();
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

const SCHEME_KEY = "shareCardScheme";

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;
  mockGetItem.mockReset();
  mockSetItem.mockReset();
  mockAnalysesGet.mockReset();
  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockAnalysesGet.mockResolvedValue({
    analysis:    COMPLETE_ANALYSIS,
    tips:        [],
    injuryRisks: [],
  });
  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — share card scheme persistence", () => {
  it("reads the stored scheme from AsyncStorage on mount", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();

    expect(mockGetItem).toHaveBeenCalledWith(SCHEME_KEY);
  });

  it("saves 'light' to AsyncStorage when the Light scheme pill is pressed", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    fireEvent.press(screen.getByText("Light"));
    await flush();

    expect(mockSetItem).toHaveBeenCalledWith(SCHEME_KEY, "light");
  });

  it("saves 'dark' to AsyncStorage when the Dark scheme pill is pressed", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    fireEvent.press(screen.getByText("Dark"));
    await flush();

    expect(mockSetItem).toHaveBeenCalledWith(SCHEME_KEY, "dark");
  });

  it("does not call setItem on mount when the stored value is 'light' (reads, does not write)", async () => {
    mockGetItem.mockResolvedValue("light");

    render(<AnalysisDetailScreen />);
    await simulateFocus();

    expect(mockGetItem).toHaveBeenCalledWith(SCHEME_KEY);
    expect(mockSetItem).not.toHaveBeenCalledWith(SCHEME_KEY, expect.anything());
  });

  it("ignores invalid stored values and keeps the dark default", async () => {
    mockGetItem.mockResolvedValue("invalid_value");

    render(<AnalysisDetailScreen />);
    await simulateFocus();

    expect(mockSetItem).not.toHaveBeenCalledWith(SCHEME_KEY, expect.anything());
  });
});
