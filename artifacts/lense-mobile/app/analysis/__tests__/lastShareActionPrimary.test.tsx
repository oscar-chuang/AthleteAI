/**
 * Tests that the share modal highlights the last-used action as the primary
 * (filled/coloured) button, persists the choice in AsyncStorage, and restores
 * it on subsequent mounts.
 *
 * Verified behaviours:
 *   1. When AsyncStorage has no stored value, "Share" receives the primary
 *      style (white label text) and "Save to photos" is secondary.
 *   2. When AsyncStorage returns "save" for the lastShareAction key, "Save to
 *      photos" receives the primary style and "Share" is secondary.
 *   3. After a successful save-to-photos, AsyncStorage.setItem is called with
 *      ("lastShareAction", "save").
 *   4. After a successful share, AsyncStorage.setItem is called with
 *      ("lastShareAction", "share").
 *
 * Strategy:
 *   The primary style is implemented by giving the active button label
 *   `color: "#fff"` while the inactive label uses `colors.foreground`
 *   ("#f5f5f5" in the mock). These tests use that text-colour contrast as a
 *   proxy for the filled/primary state — it is driven by exactly the same
 *   `lastShareAction` state that controls the button backgroundColor, so the
 *   coupling is tight.
 */

import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Capture useFocusEffect callback ─────────────────────────────────────────
let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesGet             = jest.fn();
const mockAnalysesList            = jest.fn();
const mockGetItem                 = jest.fn();
const mockSetItem                 = jest.fn();
const mockCaptureRef              = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSaveToLibraryAsync      = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "action-pref-test-1" }),
  useRouter:            () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect:       (cb: () => (() => void) | void) => { mockFocusCallback = cb; },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("expo-image",          () => ({ Image:  () => null }));

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
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync:       jest.fn(async () => {}),
}));

jest.mock("@/utils/mediaLibrary", () => ({
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  saveToLibraryAsync:      (...args: unknown[]) => mockSaveToLibraryAsync(...args),
}));

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

jest.mock("@/utils/shareUtils", () => ({
  buildSessionSharePayload: jest.fn(() => ({
    url:     "https://athleteai.app/session/action-pref-test-1",
    message: "Check out my session!",
  })),
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
jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:        () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

import AnalysisDetailScreen from "../[id]";

// ─── Fixture ──────────────────────────────────────────────────────────────────

const COMPLETE_ANALYSIS = {
  id:                  "action-pref-test-1",
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

const CAPTURED_URI = "file:///tmp/share-card-action.png";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
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
  expect(screen.getByText("Share your session")).toBeTruthy();
}

/**
 * Returns true when the given Text element's style array contains a color
 * entry equal to `color`.  This mirrors how the component sets a white label
 * on the active/primary button and `colors.foreground` on the inactive one.
 */
function textHasColor(textElement: { props: { style: unknown } }, color: string): boolean {
  const style = textElement.props.style;
  if (!style) return false;
  const styleArray = Array.isArray(style) ? style.flat(Infinity) : [style];
  return styleArray.some(
    (s: unknown) =>
      s !== null &&
      typeof s === "object" &&
      (s as Record<string, unknown>).color === color,
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAST_SHARE_ACTION_KEY = "lastShareAction";
const PRIMARY_TEXT_COLOR    = "#fff";
const SECONDARY_TEXT_COLOR  = "#f5f5f5"; // colors.foreground in the mock

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  mockFocusCallback = null;

  mockGetItem.mockReset();
  mockSetItem.mockReset();
  mockAnalysesGet.mockReset();
  mockCaptureRef.mockReset();
  mockRequestPermissionsAsync.mockReset();
  mockSaveToLibraryAsync.mockReset();

  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockAnalysesList.mockResolvedValue({ analyses: [] });
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

describe("AnalysisDetailScreen — lastShareAction primary button", () => {
  it("defaults to 'Share' as the primary button when no preference is stored", async () => {
    mockGetItem.mockResolvedValue(null);

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    const shareLabel   = screen.getByText("Share");
    const saveLabel    = screen.getByText("Save to photos");

    expect(textHasColor(shareLabel, PRIMARY_TEXT_COLOR)).toBe(true);
    expect(textHasColor(saveLabel,  PRIMARY_TEXT_COLOR)).toBe(false);
    expect(textHasColor(saveLabel,  SECONDARY_TEXT_COLOR)).toBe(true);
  });

  it("promotes 'Save to photos' to primary when AsyncStorage returns 'save'", async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === LAST_SHARE_ACTION_KEY) return "save";
      return null;
    });

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    const shareLabel = screen.getByText("Share");
    const saveLabel  = screen.getByText("Save to photos");

    expect(textHasColor(saveLabel,  PRIMARY_TEXT_COLOR)).toBe(true);
    expect(textHasColor(shareLabel, PRIMARY_TEXT_COLOR)).toBe(false);
    expect(textHasColor(shareLabel, SECONDARY_TEXT_COLOR)).toBe(true);
  });

  it("writes 'save' to AsyncStorage after a successful save-to-photos", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    fireEvent.press(screen.getByText("Save to photos"));
    await flush();

    expect(mockSetItem).toHaveBeenCalledWith(LAST_SHARE_ACTION_KEY, "save");
  });

  it("writes 'share' to AsyncStorage after a successful share", async () => {
    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    fireEvent.press(screen.getByTestId("share-cta-btn"));
    await flush();

    expect(mockSetItem).toHaveBeenCalledWith(LAST_SHARE_ACTION_KEY, "share");
  });

  it("ignores an invalid stored value and keeps 'Share' as the primary button", async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === LAST_SHARE_ACTION_KEY) return "invalid_value";
      return null;
    });

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await openShareModal();

    const shareLabel = screen.getByText("Share");

    expect(textHasColor(shareLabel, PRIMARY_TEXT_COLOR)).toBe(true);
  });
});
