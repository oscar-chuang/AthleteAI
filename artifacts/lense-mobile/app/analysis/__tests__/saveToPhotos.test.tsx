/**
 * Integration test: "Save to photos" requests the right permission and saves the card.
 *
 * Verified behaviours:
 *   1. Tapping "Save to photos" calls requestPermissionsAsync.
 *   2. When permission is granted, captureRef is called and saveToLibraryAsync
 *      is called with the captured URI.
 *   3. A success alert ("Saved!") is shown after a successful save.
 *   4. When permission is denied, saveToLibraryAsync is NOT called and a
 *      "Permission required" alert is shown instead.
 *
 * Strategy:
 *   - Render the real AnalysisDetailScreen with a complete analysis fixture.
 *   - expo-media-library is mocked via moduleNameMapper → __mocks__/expo-media-library.js
 *     (works for both static and dynamic imports; [id].tsx uses a dynamic import guarded
 *     by Platform.OS !== "web" so the module never loads on web).
 *   - react-native-view-shot captureRef is mocked.
 *   - Alert.alert is spied on to assert which dialog is presented.
 *   - useFocusEffect callback is captured to trigger data load.
 */

import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Platform, Alert } from "react-native";
import { SHARE_CARD_CAPTURE_OPTIONS } from "@/utils/shareCardCapture";

// ─── Capture useFocusEffect callback ──────────────────────────────────────────
let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Controlled mock functions ─────────────────────────────────────────────────
const mockAnalysesGet             = jest.fn();
const mockAnalysesList            = jest.fn();
const mockCaptureRef              = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSaveToLibraryAsync      = jest.fn();

// ─── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "save-test-1" }),
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

jest.mock("react-native-view-shot", () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

// [id].tsx imports from @/utils/mediaLibrary (a thin wrapper that lets Metro
// use mediaLibrary.web.ts on web without loading the native module). We mock
// that wrapper directly so the mock functions are the same instances both here
// and inside the component.
jest.mock("@/utils/mediaLibrary", () => ({
  requestPermissionsAsync: (...args: unknown[]) =>
    mockRequestPermissionsAsync(...args),
  saveToLibraryAsync: (...args: unknown[]) => mockSaveToLibraryAsync(...args),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
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
    stats: jest.fn(async () => ({ thisWeekCount: 1 })),
    get:   jest.fn(async () => ({
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
  id:                  "save-test-1",
  title:               "Sprint Session",
  sport:               "running",
  status:              "complete",
  uploadedAt:          "2024-03-10T10:00:00Z",
  overallScore:        88,
  techniqueScore:      86,
  powerScore:          90,
  balanceScore:        82,
  consistencyScore:    84,
  mobilityScore:       91,
  speedScore:          87,
  jointAngles:         null,
  jointRisks:          null,
  biomechanicsApplied: false,
};

const CAPTURED_URI = "file:///tmp/share-card-save.png";

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

/** Renders the screen, waits for data to load, opens the share preview modal. */
async function renderAndOpenShareModal() {
  render(<AnalysisDetailScreen />);
  await simulateFocus();

  fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
  await flush();

  expect(screen.getByText("Share your session")).toBeTruthy();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;

  mockAnalysesGet.mockReset();
  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockCaptureRef.mockReset();
  mockRequestPermissionsAsync.mockReset();
  mockSaveToLibraryAsync.mockReset();

  mockAnalysesGet.mockResolvedValue({
    analysis:    COMPLETE_ANALYSIS,
    tips:        [],
    injuryRisks: [],
  });
  mockCaptureRef.mockResolvedValue(CAPTURED_URI);
  mockSaveToLibraryAsync.mockResolvedValue(undefined);

  jest.spyOn(Alert, "alert");

  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — Save to photos", () => {
  it("tapping 'Save to photos' calls requestPermissionsAsync", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });

    await renderAndOpenShareModal();

    fireEvent.press(screen.getByText("Save to photos"));
    await flush();

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("saves the card via saveToLibraryAsync when permission is granted", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });

    await renderAndOpenShareModal();

    fireEvent.press(screen.getByText("Save to photos"));
    await flush();

    expect(mockCaptureRef).toHaveBeenCalledTimes(1);
    expect(mockSaveToLibraryAsync).toHaveBeenCalledWith(CAPTURED_URI);
  });

  it("captureRef is called with SHARE_CARD_CAPTURE_OPTIONS during Save to Photos", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });

    await renderAndOpenShareModal();

    fireEvent.press(screen.getByText("Save to photos"));
    await flush();

    expect(mockCaptureRef).toHaveBeenCalledTimes(1);
    expect(mockCaptureRef).toHaveBeenCalledWith(
      expect.anything(),
      SHARE_CARD_CAPTURE_OPTIONS,
    );
  });

  it("shows a success alert after the card is saved", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });

    await renderAndOpenShareModal();

    fireEvent.press(screen.getByText("Save to photos"));
    await flush();

    expect(Alert.alert).toHaveBeenCalledWith(
      "Saved!",
      "Your share card has been saved to your camera roll."
    );
  });

  it("shows a permission-denied alert and skips saving when permission is not granted", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: "denied" });

    await renderAndOpenShareModal();

    fireEvent.press(screen.getByText("Save to photos"));
    await flush();

    expect(Alert.alert).toHaveBeenCalledWith(
      "Permission required",
      "Please allow photo library access in your device settings to save images."
    );
    expect(mockCaptureRef).not.toHaveBeenCalled();
    expect(mockSaveToLibraryAsync).not.toHaveBeenCalled();
  });
});
