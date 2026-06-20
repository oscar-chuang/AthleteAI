/**
 * Regression test: deleting an analysis removes its `frameTicks_<id>` entry
 * from AsyncStorage so stale local data does not accumulate.
 *
 * Behaviour verified:
 *   1. After a successful DELETE /analyses/:id call, AsyncStorage.removeItem is
 *      called with the key `frameTicks_<id>`.
 *   2. If the server call fails, removeItem is NOT called (the entry is kept).
 *
 * Mocking strategy:
 *   - Alert.alert is spied on in beforeEach so that when handleDelete calls it,
 *     the "Delete" button's onPress is captured. Tests then call it manually
 *     inside act() to drive the async delete flow.
 *   - analysesApi.delete is a jest.fn() controlled per test.
 *   - AsyncStorage.removeItem is a jest.fn() whose calls are inspected.
 *   - All heavy sub-components and native deps are stubbed to null.
 */

import React from "react";
import { Alert } from "react-native";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mock state ───────────────────────────────────────────────────

const ANALYSIS_ID = "analysis-to-delete";

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockRouterBack    = jest.fn();
const mockRouterPush    = jest.fn();
const mockRouterReplace = jest.fn();

const mockAnalysesGet    = jest.fn();
const mockAnalysesList   = jest.fn();
const mockAnalysesDelete = jest.fn();

const mockAsyncStorageGetItem    = jest.fn<Promise<string | null>, [string]>(async () => null);
const mockAsyncStorageSetItem    = jest.fn<Promise<void>, [string, string]>(async () => {});
const mockAsyncStorageRemoveItem = jest.fn<Promise<void>, [string]>(async () => {});

// Set in beforeEach: captures the "Delete" button's onPress each time
// Alert.alert is invoked so tests can call it manually inside act().
let capturedDeleteOnPress: (() => void | Promise<void>) | null = null;

// ─── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: ANALYSIS_ID }),
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

jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn(async () => {}),
}));

jest.mock("expo-file-system", () => ({
  getContentUriAsync: jest.fn(async () => "content://mock/uri"),
}));

jest.mock("expo-haptics", () => ({
  impactAsync:              jest.fn(async () => {}),
  notificationAsync:        jest.fn(async () => {}),
  ImpactFeedbackStyle:      { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    (key: string) => mockAsyncStorageGetItem(key),
    setItem:    (key: string, val: string) => mockAsyncStorageSetItem(key, val),
    removeItem: (key: string) => mockAsyncStorageRemoveItem(key),
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

jest.mock("@/utils/shareUtils", () => ({
  buildGoalShareMessage:    jest.fn(() => ""),
  buildSessionDeepLink:     jest.fn(() => ""),
  buildSessionShareMessage: jest.fn(() => ""),
  buildSessionSharePayload: jest.fn(() => ({ message: "", url: "" })),
  SESSION_DEEP_LINK_SCHEME: "athleteai://analysis",
}));

jest.mock("@/utils/swipeNavigation", () => ({
  SWIPE_THRESHOLD:          60,
  SWIPE_VELOCITY_THRESHOLD: 0.4,
  resolveAdjacentIds:       jest.fn(() => ({ currIndex: 0, prevId: null, nextId: null })),
  shouldActivateSwipe:      jest.fn(() => false),
  resolveSwipeDirection:    jest.fn(() => "none"),
  resolveSwipeTranslation:  jest.fn(() => 0),
}));

jest.mock("@/hooks/useCardStagger", () => ({
  useCardStagger: jest.fn(() => []),
}));

jest.mock("@/lib/api", () => ({
  analyses: {
    get:    (...args: unknown[]) => mockAnalysesGet(...args),
    list:   (...args: unknown[]) => mockAnalysesList(...args),
    delete: (...args: unknown[]) => mockAnalysesDelete(...args),
  },
  profile: {
    stats:  jest.fn().mockResolvedValue({ thisWeekCount: 0 }),
    get:    jest.fn().mockResolvedValue({ profile: { weeklyGoal: 3, sport: "running" } }),
    update: jest.fn().mockResolvedValue({
      profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null, weeklyGoalCelebratedAt: null },
    }),
  },
  jointTrends: { get: jest.fn().mockResolvedValue({ joints: {} }) },
  movementSummaryHistory: { get: jest.fn().mockResolvedValue({ history: [] }) },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile:        { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null },
    refreshProfile: jest.fn(async () => {}),
  }),
  useCanAccessFeature: () => true,
}));

jest.mock("@/components/ScoreRing",                     () => ({ ScoreRing: () => null }));
jest.mock("@/components/analysis/ScoreCard",            () => ({
  ScoreCard:    () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader",        () => ({ SectionHeader:        () => null }));
jest.mock("@/components/analysis/NextFocusCard",        () => ({ NextFocusCard:        () => null }));
jest.mock("@/components/analysis/AnimatedLoadingState", () => ({ AnimatedLoadingState: () => null }));
jest.mock("@/components/analysis/ShareCard",            () => ({
  ShareCard:        () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));
jest.mock("@/components/JointHistorySheet", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ConfettiBurst",     () => ({ ConfettiBurst: () => null }));
jest.mock("@/components/ui",                () => ({ EmptyState: () => null }));

jest.mock("@/utils/mediaLibrary", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  saveToLibraryAsync:      jest.fn(async () => {}),
}));

// Import the screen AFTER all mocks are registered.
import AnalysisDetailScreen from "../[id]";

// ─── Fixture data ──────────────────────────────────────────────────────────────

const COMPLETE_ANALYSIS = {
  id:                  ANALYSIS_ID,
  title:               "Morning Run",
  sport:               "running",
  status:              "complete",
  uploadedAt:          "2024-01-15T08:00:00Z",
  overallScore:        78,
  techniqueScore:      75,
  powerScore:          80,
  balanceScore:        72,
  consistencyScore:    68,
  mobilityScore:       82,
  speedScore:          77,
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
  mockFocusCallback     = null;
  capturedDeleteOnPress = null;

  // Spy on Alert.alert and capture the "Delete" button's onPress so tests can
  // invoke it manually inside act().
  jest.spyOn(Alert, "alert").mockImplementation(
    (_title: string, _message?: string, buttons: Array<{ text?: string; onPress?: () => void }> = []) => {
      capturedDeleteOnPress = buttons.find(b => b.text === "Delete")?.onPress ?? null;
    },
  );

  mockAnalysesGet.mockResolvedValue({
    analysis:     COMPLETE_ANALYSIS,
    tips:         [],
    injuryRisks:  [],
  });
  mockAnalysesList.mockResolvedValue({ analyses: [COMPLETE_ANALYSIS] });
  mockAnalysesDelete.mockResolvedValue({});

  mockAsyncStorageGetItem.mockClear();
  mockAsyncStorageSetItem.mockClear();
  mockAsyncStorageRemoveItem.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Analysis delete — frameTicks cleanup", () => {
  it("removes frameTicks_<id> from AsyncStorage after a successful delete", async () => {
    const { getByLabelText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    // Press the delete icon — triggers handleDelete() → Alert.alert → spy
    // captures the "Delete" button's onPress in capturedDeleteOnPress.
    await act(async () => {
      fireEvent.press(getByLabelText("Delete analysis"));
    });

    // Confirm the confirmation dialog was triggered.
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(capturedDeleteOnPress).not.toBeNull();

    // Invoke the confirmed delete handler and drain all microtasks.
    await act(async () => {
      await capturedDeleteOnPress?.();
    });
    await flush(8);

    expect(mockAnalysesDelete).toHaveBeenCalledWith(ANALYSIS_ID);
    expect(mockAsyncStorageRemoveItem).toHaveBeenCalledWith(
      `frameTicks_${ANALYSIS_ID}`,
    );
  });

  it("does NOT remove frameTicks_<id> when the delete API call fails", async () => {
    mockAnalysesDelete.mockRejectedValueOnce(new Error("network error"));

    const { getByLabelText } = render(<AnalysisDetailScreen />);
    await simulateFocus();

    await act(async () => {
      fireEvent.press(getByLabelText("Delete analysis"));
    });

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(capturedDeleteOnPress).not.toBeNull();

    await act(async () => {
      await capturedDeleteOnPress?.();
    });
    await flush(8);

    expect(mockAnalysesDelete).toHaveBeenCalledWith(ANALYSIS_ID);
    expect(mockAsyncStorageRemoveItem).not.toHaveBeenCalledWith(
      `frameTicks_${ANALYSIS_ID}`,
    );
  });
});
