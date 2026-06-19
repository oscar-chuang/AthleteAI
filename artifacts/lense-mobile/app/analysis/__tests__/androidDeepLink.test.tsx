/**
 * Integration test: Android ACTION_SEND intent includes the session deep link.
 *
 * Verified behaviours:
 *   1. On Android, handleDoShare() fires IntentLauncher.startActivityAsync with
 *      action "android.intent.action.SEND", EXTRA_STREAM set to the content URI
 *      returned by FileSystem.getContentUriAsync, and EXTRA_TEXT containing
 *      "athleteai://analysis/<id>" so the recipient can open the session directly.
 *   2. On iOS, Share.share() is called with both a url (image) and a message that
 *      also contains the deep link.
 *
 * Strategy:
 *   - Render the real AnalysisDetailScreen with a complete analysis fixture.
 *   - Platform.OS is swapped per-test to exercise each branch of handleDoShare().
 *   - captureRef, getContentUriAsync, startActivityAsync, and Share.share are
 *     controlled mocks so we can inspect the exact arguments passed to them.
 */

import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Platform, Share, Alert } from "react-native";

// ─── Capture useFocusEffect callback ─────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Controlled mock functions ────────────────────────────────────────────────

const mockAnalysesGet          = jest.fn();
const mockAnalysesList         = jest.fn();
const mockCaptureRef           = jest.fn();
const mockIsAvailableAsync     = jest.fn();
const mockShareAsync           = jest.fn();
const mockStartActivityAsync   = jest.fn();
const mockGetContentUriAsync   = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSaveToLibraryAsync   = jest.fn();
const mockNativeShare          = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "deep-link-test-1" }),
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYSIS_ID       = "deep-link-test-1";
const CONTENT_URI       = "content://tmp/share-card.png";
const CAPTURED_FILE_URI = "file:///tmp/share-card.png";
const EXPECTED_DEEP_LINK = `athleteai://analysis/${ANALYSIS_ID}`;

// ─── Fixture ─────────────────────────────────────────────────────────────────

const COMPLETE_ANALYSIS = {
  id:                  ANALYSIS_ID,
  title:               "Sprint Session",
  sport:               "running",
  status:              "complete",
  uploadedAt:          "2024-03-10T09:00:00Z",
  overallScore:        88,
  techniqueScore:      85,
  powerScore:          90,
  balanceScore:        82,
  consistencyScore:    80,
  mobilityScore:       86,
  speedScore:          91,
  jointAngles:         null,
  jointRisks:          null,
  biomechanicsApplied: false,
};

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

async function openModalAndShare() {
  fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
  await flush();
  expect(screen.getByText("Share your session")).toBeTruthy();
  fireEvent.press(screen.getByText("Share"));
  await flush();
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

let alertSpy: jest.SpyInstance;
let shareSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  shareSpy = jest.spyOn(Share, "share").mockImplementation(mockNativeShare);

  mockCaptureRef.mockReset();
  mockIsAvailableAsync.mockReset();
  mockShareAsync.mockReset();
  mockStartActivityAsync.mockReset();
  mockGetContentUriAsync.mockReset();
  mockRequestPermissionsAsync.mockReset();
  mockSaveToLibraryAsync.mockReset();
  mockAnalysesGet.mockReset();
  mockAnalysesList.mockReset();
  mockNativeShare.mockReset();

  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockResolvedValue(CAPTURED_FILE_URI);
  mockShareAsync.mockResolvedValue(undefined);
  mockGetContentUriAsync.mockResolvedValue(CONTENT_URI);
  mockStartActivityAsync.mockResolvedValue(undefined);
  mockNativeShare.mockResolvedValue({ action: "sharedAction" });

  mockAnalysesGet.mockResolvedValue({
    analysis:    COMPLETE_ANALYSIS,
    tips:        [],
    injuryRisks: [],
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  alertSpy.mockRestore();
  shareSpy.mockRestore();
  // Restore Platform.OS to ios after each test.
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("handleDoShare — Android: session deep link in ACTION_SEND intent", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
  });

  it("calls startActivityAsync with action android.intent.action.SEND", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    expect(mockStartActivityAsync).toHaveBeenCalledTimes(1);
    expect(mockStartActivityAsync).toHaveBeenCalledWith(
      "android.intent.action.SEND",
      expect.anything(),
    );
  });

  it("passes EXTRA_STREAM set to the content URI from getContentUriAsync", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    expect(mockGetContentUriAsync).toHaveBeenCalledWith(CAPTURED_FILE_URI);

    const [, params] = mockStartActivityAsync.mock.calls[0] as [string, Record<string, unknown>];
    const extras = params.extra as Record<string, string>;
    expect(extras["android.intent.extra.STREAM"]).toBe(CONTENT_URI);
  });

  it("passes EXTRA_TEXT containing the athleteai:// deep link for this analysis", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    const [, params] = mockStartActivityAsync.mock.calls[0] as [string, Record<string, unknown>];
    const extras = params.extra as Record<string, string>;
    expect(extras["android.intent.extra.TEXT"]).toContain(EXPECTED_DEEP_LINK);
  });

  it("EXTRA_TEXT contains the exact analysis ID embedded in the deep link", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    const [, params] = mockStartActivityAsync.mock.calls[0] as [string, Record<string, unknown>];
    const extras = params.extra as Record<string, string>;
    expect(extras["android.intent.extra.TEXT"]).toContain(ANALYSIS_ID);
    expect(extras["android.intent.extra.TEXT"]).toContain("athleteai://");
  });

  it("does NOT call the iOS Share.share on Android", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    expect(mockNativeShare).not.toHaveBeenCalled();
  });
});

describe("handleDoShare — iOS: Share.share called with url and message containing deep link", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  });

  it("calls Share.share (not startActivityAsync) on iOS", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    expect(mockNativeShare).toHaveBeenCalledTimes(1);
    expect(mockStartActivityAsync).not.toHaveBeenCalled();
  });

  it("passes the captured image URI as the url field to Share.share", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    expect(mockNativeShare).toHaveBeenCalledWith(
      expect.objectContaining({ url: CAPTURED_FILE_URI }),
    );
  });

  it("message field passed to Share.share contains the athleteai:// deep link", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    expect(mockNativeShare).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(EXPECTED_DEEP_LINK),
      }),
    );
  });

  it("message field contains the analysis ID in the deep link", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openModalAndShare();

    const [payload] = mockNativeShare.mock.calls[0] as [{ url: string; message: string }];
    expect(payload.message).toContain(ANALYSIS_ID);
    expect(payload.message).toContain("athleteai://");
  });
});
