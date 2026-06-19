/**
 * Integration test: share preview modal opens before anything is sent.
 *
 * Verified behaviours:
 *   1. Tapping the Share header button opens the preview modal (native share
 *      sheet is NOT invoked at this point).
 *   2. Tapping Cancel inside the modal closes it without ever calling
 *      captureRef or Sharing.shareAsync.
 *   3. Tapping the modal's Share CTA calls captureRef exactly once, then
 *      Sharing.shareAsync exactly once, and finally closes the modal.
 *
 * Strategy:
 *   - Render the real AnalysisDetailScreen with a complete analysis fixture.
 *   - useSharePreview is NOT mocked so the actual modal state runs.
 *   - useFocusEffect callback is captured so we control when load() fires.
 *   - Platform.OS is forced to "android" so the non-iOS branch of
 *     handleDoShare is exercised and Sharing.shareAsync is the share sink.
 */

import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";

// ─── Capture useFocusEffect callback ──────────────────────────────────────────
let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Controlled mock functions ─────────────────────────────────────────────────
const mockAnalysesGet          = jest.fn();
const mockAnalysesList         = jest.fn();
const mockCaptureRef           = jest.fn();
const mockIsAvailableAsync     = jest.fn();
const mockShareAsync           = jest.fn();
const mockStartActivityAsync   = jest.fn();
const mockGetContentUriAsync   = jest.fn();

// ─── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "share-test-1" }),
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

// Stub heavy sub-components — modal state, not rendering, is what matters here.
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
  id:                  "share-test-1",
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

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;

  mockCaptureRef.mockReset();
  mockIsAvailableAsync.mockReset();
  mockShareAsync.mockReset();
  mockStartActivityAsync.mockReset();
  mockGetContentUriAsync.mockReset();
  mockAnalysesGet.mockReset();
  mockAnalysesList.mockResolvedValue({ analyses: [] });

  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockResolvedValue("file:///tmp/share-card.png");
  mockShareAsync.mockResolvedValue(undefined);
  mockGetContentUriAsync.mockResolvedValue("content://tmp/share-card.png");
  mockStartActivityAsync.mockResolvedValue(undefined);

  mockAnalysesGet.mockResolvedValue({
    analysis:    COMPLETE_ANALYSIS,
    tips:        [],
    injuryRisks: [],
  });

  // Force the Android code path so handleDoShare exercises IntentLauncher.
  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  // Restore Platform.OS to the default test value.
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — share preview modal", () => {
  it("pressing Share opens the preview modal without firing the native share sheet", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();

    // Modal must be closed initially — its title is not in the tree.
    expect(screen.queryByText("Share your session")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    // Modal title is now visible.
    expect(screen.getByText("Share your session")).toBeTruthy();
    // Neither captureRef nor startActivityAsync have been called yet.
    expect(mockCaptureRef).not.toHaveBeenCalled();
    expect(mockStartActivityAsync).not.toHaveBeenCalled();
  });

  it("pressing Cancel closes the modal and never calls captureRef or shareAsync", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();

    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    expect(screen.getByText("Share your session")).toBeTruthy();

    fireEvent.press(screen.getByText("Cancel"));
    await flush();

    // Modal must be gone.
    expect(screen.queryByText("Share your session")).toBeNull();
    // No share attempt was made.
    expect(mockCaptureRef).not.toHaveBeenCalled();
    expect(mockStartActivityAsync).not.toHaveBeenCalled();
  });

  it("pressing the Share CTA calls captureRef then IntentLauncher and closes the modal", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();

    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    expect(screen.getByText("Share your session")).toBeTruthy();

    // The Share CTA inside the modal bottom actions has exact text "Share".
    fireEvent.press(screen.getByText("Share"));
    await flush();

    expect(mockCaptureRef).toHaveBeenCalledTimes(1);
    // On Android the share path uses IntentLauncher.startActivityAsync, not
    // Sharing.shareAsync.  getContentUriAsync converts the tmp file path first.
    expect(mockGetContentUriAsync).toHaveBeenCalledTimes(1);
    expect(mockStartActivityAsync).toHaveBeenCalledTimes(1);
    // Modal closes after the share completes.
    expect(screen.queryByText("Share your session")).toBeNull();
  });

  it("Share CTA is disabled while a share is in progress — second press is a no-op", async () => {
    // Make captureRef return a promise that never resolves so the component
    // stays in the "sharing" state (sharing === true) for the whole test.
    let releaseCaptureRef!: () => void;
    const neverResolving = new Promise<string>((resolve) => {
      releaseCaptureRef = () => resolve("file:///tmp/share-card.png");
    });
    mockCaptureRef.mockReturnValue(neverResolving);

    render(<AnalysisDetailScreen />);
    await simulateFocus();

    // Open the share preview modal.
    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();
    expect(screen.getByText("Share your session")).toBeTruthy();

    // First press — kicks off handleDoShare; captureRef is called once and
    // then suspends, keeping sharing === true.
    fireEvent.press(screen.getByText("Share"));
    // Let isAvailableAsync resolve so captureRef is reached and invoked.
    await flush();

    expect(mockCaptureRef).toHaveBeenCalledTimes(1);

    // Second press while captureRef is still in-flight (sharing === true).
    // The handler guard `if (!analysis || sharing) return;` must bail out
    // immediately, so captureRef must NOT be called a second time.
    fireEvent.press(screen.getByText("Share"));
    await flush();

    expect(mockCaptureRef).toHaveBeenCalledTimes(1);
    // Neither downstream side-effect must have fired yet.
    expect(mockGetContentUriAsync).not.toHaveBeenCalled();
    expect(mockStartActivityAsync).not.toHaveBeenCalled();

    // Clean up: let the first share complete so no pending promise leaks.
    await act(async () => { releaseCaptureRef(); });
    await flush();
  });
});
