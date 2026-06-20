/**
 * Tests confirming the swipe-hint pill only appears once.
 *
 * The hint has two dismissal paths:
 *   1. Auto-timeout — 700 ms delay to show, then 2 000 ms auto-dismiss.
 *   2. First successful swipe — dismisses immediately via dismissHintRef.
 *
 * Both paths write `swipe_hint_seen = "true"` to AsyncStorage so the hint
 * never appears on a subsequent mount.
 *
 * Tests:
 *   1. Hint becomes visible (AsyncStorage checked, then key written after
 *      auto-dismiss) when `swipe_hint_seen` is absent and ≥2 siblings exist.
 *   2. Hint never appears (no `setItem` call) when the key is already set.
 *   3. A pan-gesture that crosses the swipe threshold writes the key
 *      immediately — before the 2 s auto-dismiss would fire.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Constants ────────────────────────────────────────────────────────────────

const SWIPE_HINT_SEEN_KEY = "swipe_hint_seen";

// ─── Module-level mock state ───────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;
let mockStorageStore: Record<string, string | null> = {};

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

// ─── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "session-1" }),
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
}));

jest.mock("@/lib/authContext", () => ({
  useAuth:            (...args: unknown[]) => mockUseAuth(...args),
  useCanAccessFeature: () => true,
}));

jest.mock("@/components/ScoreRing", () => ({ ScoreRing: () => null }));
jest.mock("@/components/analysis/ScoreCard", () => ({
  ScoreCard:    () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader",      () => ({ SectionHeader:      () => null }));
jest.mock("@/components/analysis/NextFocusCard",      () => ({ NextFocusCard:      () => null }));
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
  uploadedAt:       "2024-06-01T08:00:00Z",
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

// Three analyses so that "session-1" has neighbours on both sides.
const SIBLING_LIST = [
  { ...COMPLETE_ANALYSIS, id: "session-0", uploadedAt: "2024-06-03T08:00:00Z" },
  { ...COMPLETE_ANALYSIS, id: "session-1", uploadedAt: "2024-06-02T08:00:00Z" },
  { ...COMPLETE_ANALYSIS, id: "session-2", uploadedAt: "2024-06-01T08:00:00Z" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => {
    mockFocusCallback?.();
  });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();

  mockFocusCallback = null;
  mockStorageStore  = {};

  mockAnalysesGet.mockResolvedValue({
    analysis: COMPLETE_ANALYSIS,
    tips:     [],
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

  // Default: current session is in the middle — has both prev and next.
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

describe("Swipe hint — one-time appearance", () => {

  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("shows the hint when swipe_hint_seen is absent and the session has neighbours", async () => {
    // swipe_hint_seen not in store → getItem returns null.
    render(<AnalysisDetailScreen />);

    // Trigger focus so the component loads sibling IDs.
    await simulateFocus();

    // The siblingIds effect fires after the list resolves. Flush to let it run.
    await flush();

    // The hint effect reads the AsyncStorage key after siblingIds are set.
    // Advance the 700 ms show-delay timer so the opacity animation fires.
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    await flush();

    // The component must have checked the key.
    const getCalls = mockAsyncStorageGetItem.mock.calls.filter(
      ([key]) => key === SWIPE_HINT_SEEN_KEY,
    );
    expect(getCalls.length).toBeGreaterThan(0);

    // Auto-dismiss fires 2 000 ms after the show animation starts.
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    await flush();

    // The key must now be written — confirms the hint was shown and dismissed.
    const setCalls = mockAsyncStorageSetItem.mock.calls.filter(
      ([key, val]) => key === SWIPE_HINT_SEEN_KEY && val === "true",
    );
    expect(setCalls).toHaveLength(1);
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("never shows the hint when swipe_hint_seen is already set", async () => {
    // Pre-seed the store so getItem returns "true" immediately.
    mockStorageStore[SWIPE_HINT_SEEN_KEY] = "true";

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await flush();

    // Advance well past both timers.
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await flush();

    // setItem must never have been called with the hint key.
    const setCalls = mockAsyncStorageSetItem.mock.calls.filter(
      ([key]) => key === SWIPE_HINT_SEEN_KEY,
    );
    expect(setCalls).toHaveLength(0);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("writes the key immediately when the user swipes past the threshold", async () => {
    // Key absent → hint will become visible after 700 ms.
    const { getByTestId } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await flush();

    // Advance show-delay so swipeHintVisible becomes true.
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    await flush();

    // Simulate a successful left-swipe that crosses the threshold.
    // mockResolveSwipeDirection returns "none" by default; override to "next".
    mockResolveSwipeDirection.mockReturnValue("next");

    const swipeContainer = getByTestId("swipe-container");

    // Fire the responder-release event with gestureState that exceeds threshold.
    await act(async () => {
      swipeContainer.props.onResponderRelease?.(
        { nativeEvent: {} },
        { dx: -100, dy: 0, vx: -1.2, vy: 0, moveX: 0, moveY: 0, x0: 0, y0: 0 },
      );
    });
    await flush();

    // Key must be written before the 2 000 ms auto-dismiss timer would have fired.
    const setCalls = mockAsyncStorageSetItem.mock.calls.filter(
      ([key, val]) => key === SWIPE_HINT_SEEN_KEY && val === "true",
    );
    expect(setCalls).toHaveLength(1);
  });
});
