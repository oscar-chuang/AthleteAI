/**
 * Tests: share-card scheme preference is saved and restored via AsyncStorage.
 *
 * Verified behaviours:
 *   1. When AsyncStorage is pre-seeded with shareCardScheme = "light", the
 *      Light pill is visually pre-selected (primary text colour) when the
 *      share preview modal opens.
 *   2. Tapping the Dark pill calls AsyncStorage.setItem with the correct
 *      key ("shareCardScheme") and value ("dark").
 */

import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Platform, Alert } from "react-native";

// ─── Capture useFocusEffect callback ──────────────────────────────────────────
let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Controlled mock functions ─────────────────────────────────────────────────
const mockAnalysesGet             = jest.fn();
const mockAnalysesList            = jest.fn();
const mockCaptureRef              = jest.fn();
const mockIsAvailableAsync        = jest.fn();
const mockShareAsync              = jest.fn();
const mockStartActivityAsync      = jest.fn();
const mockGetContentUriAsync      = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSaveToLibraryAsync      = jest.fn();

// ─── AsyncStorage mock — controlled per test ───────────────────────────────────
const mockAsyncGetItem  = jest.fn<Promise<string | null>, [string]>();
const mockAsyncSetItem  = jest.fn<Promise<void>, [string, string]>();
const mockAsyncRemoveItem = jest.fn<Promise<void>, [string]>();

// ─── Module mocks ──────────────────────────────────────────────────────────────

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
  startActivityAsync: (...args: unknown[]) => mockStartActivityAsync(...args),
}));

jest.mock("expo-file-system", () => ({
  copyAsync:          jest.fn(async () => {}),
  deleteAsync:        jest.fn(async () => {}),
  getContentUriAsync: (...args: unknown[]) => mockGetContentUriAsync(...args),
  documentDirectory:  "file:///docs/",
  cacheDirectory:     "file:///cache/",
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
    getItem:    (key: string) => mockAsyncGetItem(key),
    setItem:    (key: string, val: string) => mockAsyncSetItem(key, val),
    removeItem: (key: string) => mockAsyncRemoveItem(key),
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

jest.mock("@/utils/mediaLibrary", () => ({
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  saveToLibraryAsync:      (...args: unknown[]) => mockSaveToLibraryAsync(...args),
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

// Import AFTER all mocks are registered.
import AnalysisDetailScreen from "../[id]";

// ─── Fixture ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

  mockCaptureRef.mockReset();
  mockIsAvailableAsync.mockReset();
  mockShareAsync.mockReset();
  mockStartActivityAsync.mockReset();
  mockGetContentUriAsync.mockReset();
  mockRequestPermissionsAsync.mockReset();
  mockSaveToLibraryAsync.mockReset();
  mockAnalysesGet.mockReset();
  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockAsyncGetItem.mockReset();
  mockAsyncSetItem.mockReset();
  mockAsyncRemoveItem.mockReset();

  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockResolvedValue("file:///tmp/share-card.png");
  mockShareAsync.mockResolvedValue(undefined);
  mockGetContentUriAsync.mockResolvedValue("content://tmp/share-card.png");
  mockStartActivityAsync.mockResolvedValue(undefined);
  mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });
  mockSaveToLibraryAsync.mockResolvedValue(undefined);

  mockAnalysesGet.mockResolvedValue({
    analysis:    COMPLETE_ANALYSIS,
    tips:        [],
    injuryRisks: [],
  });

  // Default: no stored scheme preference.
  mockAsyncGetItem.mockResolvedValue(null);
  mockAsyncSetItem.mockResolvedValue(undefined);
  mockAsyncRemoveItem.mockResolvedValue(undefined);

  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  alertSpy.mockRestore();
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — scheme preference persistence", () => {
  it("restores a saved 'light' scheme so the Light pill is pre-selected when the share sheet opens", async () => {
    // Pre-seed AsyncStorage with the light preference.
    mockAsyncGetItem.mockImplementation(async (key) => {
      if (key === "shareCardScheme") return "light";
      return null;
    });

    render(<AnalysisDetailScreen />);
    // Allow the mount useEffect (AsyncStorage.getItem) to settle.
    await flush();
    await simulateFocus();

    // Open the share preview modal.
    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    expect(screen.getByText("Share your session")).toBeTruthy();

    // The load path must have been exercised with the correct storage key.
    expect(mockAsyncGetItem).toHaveBeenCalledWith("shareCardScheme");

    // The Light pill label uses the primary colour when selected and the muted
    // colour when not selected.  Primary = #6c63ff, muted = #888888 (from the
    // useColors mock above).
    expect(screen.getByText("Light")).toHaveStyle({ color: "#6c63ff" });
    expect(screen.getByText("Dark")).toHaveStyle({ color: "#888888" });
  });

  it("persists the chosen scheme when the user taps Dark", async () => {
    // No stored preference → component defaults to "dark".
    mockAsyncGetItem.mockResolvedValue(null);

    render(<AnalysisDetailScreen />);
    await flush();
    await simulateFocus();

    // Open the share preview modal.
    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    expect(screen.getByText("Share your session")).toBeTruthy();

    // Tap the Dark scheme pill.
    fireEvent.press(screen.getByText("Dark"));
    await flush();

    // setItem must have been called with the correct key and value.
    expect(mockAsyncSetItem).toHaveBeenCalledWith("shareCardScheme", "dark");
  });
});
