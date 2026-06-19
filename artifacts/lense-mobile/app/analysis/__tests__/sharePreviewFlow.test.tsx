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
import { Platform, Alert } from "react-native";

// ─── Capture useFocusEffect callback ──────────────────────────────────────────
let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Controlled mock functions ─────────────────────────────────────────────────
const mockAnalysesGet              = jest.fn();
const mockAnalysesList             = jest.fn();
const mockCaptureRef               = jest.fn();
const mockIsAvailableAsync         = jest.fn();
const mockShareAsync               = jest.fn();
const mockStartActivityAsync       = jest.fn();
const mockGetContentUriAsync       = jest.fn();
const mockRequestPermissionsAsync  = jest.fn();
const mockSaveToLibraryAsync       = jest.fn();

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

// Stub heavy sub-components — modal state, not rendering, is what matters here.
jest.mock("@/components/ScoreRing", () => ({ ScoreRing: () => null }));
jest.mock("@/components/analysis/ScoreCard", () => ({
  ScoreCard:    () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader",        () => ({ SectionHeader:        () => null }));
jest.mock("@/components/analysis/NextFocusCard",        () => ({ NextFocusCard:        () => null }));
jest.mock("@/components/analysis/AnimatedLoadingState", () => ({ AnimatedLoadingState: () => null }));
// Track the most-recent topTip prop passed to ShareCard so tests can assert
// which coaching tip the share card will display without mounting the full card.
let lastShareCardTopTip: string | undefined = undefined;
jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard: ({ topTip }: { topTip?: string }) => {
    // Capture every render so assertions can check the latest value.
    lastShareCardTopTip = topTip;
    return null;
  },
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

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;
  lastShareCardTopTip = undefined;
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

  // Force the Android code path so handleDoShare exercises IntentLauncher.
  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  alertSpy.mockRestore();
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
    // At this point the button text is replaced by an ActivityIndicator, so we
    // find it by testID. The handler guard `if (!analysis || sharing) return;`
    // must bail out immediately, so captureRef must NOT be called a second time.
    fireEvent.press(screen.getByTestId("share-cta-btn"));
    await flush();

    expect(mockCaptureRef).toHaveBeenCalledTimes(1);
    // Neither downstream side-effect must have fired yet.
    expect(mockGetContentUriAsync).not.toHaveBeenCalled();
    expect(mockStartActivityAsync).not.toHaveBeenCalled();

    // Clean up: let the first share complete so no pending promise leaks.
    await act(async () => { releaseCaptureRef(); });
    await flush();
  });

  it("pressing Save to photos calls captureRef and saveToLibraryAsync once, and the modal stays open", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();

    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    // Modal is open.
    expect(screen.getByText("Share your session")).toBeTruthy();

    // Tap the Save to photos button.
    fireEvent.press(screen.getByText("Save to photos"));
    await flush();

    // captureRef must have been called exactly once to capture the card.
    expect(mockCaptureRef).toHaveBeenCalledTimes(1);
    // saveToLibraryAsync must have been called exactly once with the captured URI.
    expect(mockSaveToLibraryAsync).toHaveBeenCalledTimes(1);
    expect(mockSaveToLibraryAsync).toHaveBeenCalledWith("file:///tmp/share-card.png");
    // The modal must still be visible — Save to photos does not close it.
    expect(screen.getByText("Share your session")).toBeTruthy();
    // The native share sheet was not invoked.
    expect(mockStartActivityAsync).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it("shows the unavailability banner and keeps the modal open when sharing is unsupported", async () => {
    // Simulate a device where expo-sharing is unavailable.
    mockIsAvailableAsync.mockResolvedValue(false);

    render(<AnalysisDetailScreen />);
    await simulateFocus();

    // Open the share preview modal.
    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    expect(screen.getByText("Share your session")).toBeTruthy();

    // Banner must NOT be visible yet (sharing hasn't been attempted).
    expect(
      screen.queryByText("Sharing isn't supported on this device. Save to photos instead."),
    ).toBeNull();

    // Tap the Share CTA — this triggers handleDoShare which calls isAvailableAsync.
    fireEvent.press(screen.getByText("Share"));
    await flush();

    // The unavailability banner must now be visible.
    expect(
      screen.getByText("Sharing isn't supported on this device. Save to photos instead."),
    ).toBeTruthy();

    // The modal must still be open — the Share CTA must NOT have closed it.
    expect(screen.getByText("Share your session")).toBeTruthy();

    // captureRef and any share sinks must never have been called.
    expect(mockCaptureRef).not.toHaveBeenCalled();
    expect(mockStartActivityAsync).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it("tip picker remembers the last-chosen tip when the share preview is reopened", async () => {
    // Provide two tips so the tip picker renders (requires sortedTips.length > 1).
    mockAnalysesGet.mockResolvedValue({
      analysis:    COMPLETE_ANALYSIS,
      tips: [
        {
          id:          "tip-critical",
          tipType:     "performance",
          category:    "form",
          severity:    "critical",
          title:       "Fix your knee alignment",
          description: "Your knee tracks inward during the squat.",
        },
        {
          id:          "tip-warning",
          tipType:     "injury",
          category:    "safety",
          severity:    "warning",
          title:       "Watch your lower back",
          description: "Slight rounding detected in the lumbar region.",
        },
      ],
      injuryRisks: [],
    });

    render(<AnalysisDetailScreen />);
    await simulateFocus();

    // Open the share preview modal.
    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    expect(screen.getByText("Share your session")).toBeTruthy();

    // Tip picker must be visible (two tips available).
    expect(screen.getByText("Choose which tip to feature")).toBeTruthy();
    // Tip picker items are targeted by testID (tip-picker-<id>) to avoid ambiguity
    // with the coaching-tips section that also renders the same tip titles.
    expect(screen.getByTestId("tip-picker-tip-critical")).toBeTruthy();
    expect(screen.getByTestId("tip-picker-tip-warning")).toBeTruthy();

    // On first open the critical tip drives the share card (highest severity = default).
    expect(lastShareCardTopTip).toBe("Fix your knee alignment");

    // User picks the warning tip from the picker.
    fireEvent.press(screen.getByTestId("tip-picker-tip-warning"));
    await flush();

    // ShareCard must now reflect the warning tip.
    expect(lastShareCardTopTip).toBe("Watch your lower back");

    // Cancel the modal.
    fireEvent.press(screen.getByText("Cancel"));
    await flush();

    expect(screen.queryByText("Share your session")).toBeNull();

    // Reopen the share preview — tip memory must restore the warning tip.
    fireEvent.press(screen.getByRole("button", { name: "Share analysis" }));
    await flush();

    expect(screen.getByText("Share your session")).toBeTruthy();

    // After reopen the ShareCard must still receive the remembered (warning) tip,
    // not fall back to the default critical tip.
    expect(lastShareCardTopTip).toBe("Watch your lower back");
  });
});
