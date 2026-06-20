/**
 * Tests confirming that tapping the swipe-hint pill navigates to the correct
 * adjacent session and cancels the auto-dismiss timer.
 *
 * Three scenarios:
 *   1. nextId present — tap navigates to nextId via router.replace.
 *   2. nextId absent, prevId present (prev-only case) — pill shows only a
 *      left-arrow icon and tap navigates to prevId.
 *   3. Tap cancels the auto-dismiss timer and writes swipe_hint_seen="true"
 *      to AsyncStorage immediately (before the 2 s timer fires).
 *
 * Setup mirrors swipeHint.test.tsx:
 *   - expo-router is mocked so we capture the router.replace spy.
 *   - useFocusEffect is captured so we can fire the load cycle.
 *   - Fake timers let us advance past the 700 ms show-delay without waiting.
 *   - resolveAdjacentIds is mocked to control prevId / nextId per test.
 *   - AsyncStorage is a minimal in-memory store.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Constants ────────────────────────────────────────────────────────────────

const SWIPE_HINT_SEEN_KEY = "swipe_hint_seen";

// ─── Module-level mock state ───────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;
let mockStorageStore: Record<string, string | null> = {};

const mockRouterReplace = jest.fn();

const mockAnalysesGet  = jest.fn();
const mockAnalysesList = jest.fn();
const mockProfileStats = jest.fn();
const mockProfileGet   = jest.fn();
const mockUseAuth      = jest.fn();

const mockResolveAdjacentIds    = jest.fn();
const mockResolveSwipeDirection = jest.fn();

const mockAsyncStorageGetItem = jest.fn(
  (key: string) => Promise.resolve(mockStorageStore[key] ?? null),
);
const mockAsyncStorageSetItem = jest.fn((key: string, value: string) => {
  mockStorageStore[key] = value;
  return Promise.resolve();
});
const mockAsyncStorageRemoveItem = jest.fn((key: string) => {
  delete mockStorageStore[key];
  return Promise.resolve();
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "session-1" }),
  useRouter: () => ({
    push:    jest.fn(),
    back:    jest.fn(),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
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

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    (...args: [string]) => mockAsyncStorageGetItem(...args),
    setItem:    (...args: [string, string]) => mockAsyncStorageSetItem(...args),
    removeItem: (...args: [string]) => mockAsyncStorageRemoveItem(...args),
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
    stats:  (...args: unknown[]) => mockProfileStats(...args),
    get:    (...args: unknown[]) => mockProfileGet(...args),
    update: jest.fn().mockResolvedValue({
      profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test", avatarUrl: null },
    }),
  },
  jointTrends: { get: jest.fn().mockResolvedValue({ joints: {} }) },
  movementSummaryHistory: { get: jest.fn().mockResolvedValue({ history: [] }) },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth:             (...args: unknown[]) => mockUseAuth(...args),
  useCanAccessFeature: () => true,
}));

jest.mock("@/components/ScoreRing", () => ({ ScoreRing: () => null }));
jest.mock("@/components/analysis/ScoreCard", () => ({
  ScoreCard:    () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader",        () => ({ SectionHeader:        () => null }));
jest.mock("@/components/analysis/NextFocusCard",        () => ({ NextFocusCard:        () => null }));
jest.mock("@/components/analysis/AnimatedLoadingState", () => ({
  AnimatedLoadingState: () => null,
}));
jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:        () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn(async () => {}),
}));

jest.mock("expo-file-system", () => ({
  getContentUriAsync: jest.fn(async () => "content://mock/uri"),
}));

jest.mock("@/utils/swipeNavigation", () => ({
  SWIPE_THRESHOLD:          60,
  SWIPE_VELOCITY_THRESHOLD: 0.4,
  resolveAdjacentIds:       (...args: unknown[]) => mockResolveAdjacentIds(...args),
  shouldActivateSwipe:      jest.fn(() => false),
  resolveSwipeDirection:    (...args: unknown[]) => mockResolveSwipeDirection(...args),
  resolveSwipeTranslation:  jest.fn(() => 0),
}));

jest.mock("@/hooks/useCardStagger", () => ({
  useCardStagger: jest.fn(() => []),
}));

jest.mock("@/utils/shareUtils", () => ({
  buildGoalShareMessage:    jest.fn(() => ""),
  buildSessionDeepLink:     jest.fn(() => "athleteai://analysis/session-1"),
  buildSessionShareMessage: jest.fn(() => ""),
  buildSessionSharePayload: jest.fn(() => ({ message: "", url: "" })),
  SESSION_DEEP_LINK_SCHEME: "athleteai://analysis",
}));

import AnalysisDetailScreen from "../[id]";

// ─── Fixture data ──────────────────────────────────────────────────────────────

const COMPLETE_ANALYSIS = {
  id:               "session-1",
  title:            "Morning Run",
  sport:            "running",
  status:           "complete",
  uploadedAt:       "2024-06-02T08:00:00Z",
  overallScore:     80,
  techniqueScore:   80,
  powerScore:       80,
  balanceScore:     80,
  consistencyScore: 80,
  mobilityScore:    80,
  speedScore:       80,
  jointAngles:      null,
  jointRisks:       null,
  biomechanicsApplied: false,
};

const SIBLING_LIST = [
  { ...COMPLETE_ANALYSIS, id: "session-0", uploadedAt: "2024-06-03T08:00:00Z" },
  { ...COMPLETE_ANALYSIS, id: "session-1", uploadedAt: "2024-06-02T08:00:00Z" },
  { ...COMPLETE_ANALYSIS, id: "session-2", uploadedAt: "2024-06-01T08:00:00Z" },
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

/** Advance timers past the 700 ms show-delay so swipeHintVisible becomes true. */
async function showHint() {
  await act(async () => {
    jest.advanceTimersByTime(800);
  });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();

  mockFocusCallback = null;
  mockStorageStore  = {};
  mockRouterReplace.mockClear();

  mockAnalysesGet.mockResolvedValue({
    analysis:    COMPLETE_ANALYSIS,
    tips:        [],
    injuryRisks: [],
  });
  mockAnalysesList.mockResolvedValue({ analyses: SIBLING_LIST });
  mockProfileStats.mockResolvedValue({ thisWeekCount: 0 });
  mockProfileGet.mockResolvedValue({
    profile: { weeklyGoal: 3, sport: "running" },
  });

  mockUseAuth.mockReturnValue({
    profile:        { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test", avatarUrl: null },
    refreshProfile: jest.fn(async () => {}),
  });

  // Default: session-1 is in the middle — has both prev and next.
  mockResolveAdjacentIds.mockReturnValue({
    currIndex: 1,
    prevId:    "session-0",
    nextId:    "session-2",
  });
  mockResolveSwipeDirection.mockReturnValue("none");

  mockAsyncStorageGetItem.mockClear();
  mockAsyncStorageSetItem.mockClear();
  mockAsyncStorageRemoveItem.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Swipe hint pill — tap navigation", () => {

  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("tapping the pill navigates to nextId when nextId is defined", async () => {
    // nextId = "session-2" (default mock)
    const { getByTestId } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await showHint();

    await act(async () => {
      fireEvent.press(getByTestId("swipe-hint-button"));
    });
    await flush();

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining("session-2"),
    );
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("tapping the pill navigates to prevId when nextId is absent (prev-only case)", async () => {
    // Arrange: session is the newest — only a prevId exists.
    mockResolveAdjacentIds.mockReturnValue({
      currIndex: 0,
      prevId:    "session-0",
      nextId:    null,
    });

    const { getByTestId } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await showHint();

    await act(async () => {
      fireEvent.press(getByTestId("swipe-hint-button"));
    });
    await flush();

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining("session-0"),
    );
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("writes swipe_hint_seen='true' immediately on tap — before the 2 s auto-dismiss fires", async () => {
    // Key absent → hint becomes visible after show-delay.
    const { getByTestId } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await showHint();

    // Tap the pill — this should call dismissSwipeHint() which writes the key.
    await act(async () => {
      fireEvent.press(getByTestId("swipe-hint-button"));
    });
    await flush();

    // The key must be written at this point — well before the 2 s auto-timer.
    const setCalls = mockAsyncStorageSetItem.mock.calls.filter(
      ([key, val]) => key === SWIPE_HINT_SEEN_KEY && val === "true",
    );
    expect(setCalls).toHaveLength(1);

    // Advance past the 2 s auto-dismiss; the key must NOT be written a second time.
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flush();

    const allSetCalls = mockAsyncStorageSetItem.mock.calls.filter(
      ([key, val]) => key === SWIPE_HINT_SEEN_KEY && val === "true",
    );
    expect(allSetCalls).toHaveLength(1);
  });
});
