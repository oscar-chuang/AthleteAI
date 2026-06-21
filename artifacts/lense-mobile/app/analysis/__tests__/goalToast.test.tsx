/**
 * Regression test: 'Weekly goal reached!' toast fires exactly once when the
 * weekly goal is crossed during the processing → complete status transition on
 * the Analysis Detail screen.
 *
 * Key behaviours verified:
 *   1. Toast renders with text "Weekly goal reached!" the first time the
 *      analysis status flips from 'processing' → 'complete' and stats show
 *      thisWeekCount >= weeklyGoal with a "just crossed" signal in AsyncStorage.
 *   2. The `confetti_celebrated_<weekKey>` key is written to AsyncStorage after
 *      the toast fires — this is the guard that prevents re-appearance.
 *   3. Toast does NOT fire when the celebrated key is already set (same week,
 *      second analysis completing).
 *
 * Mocking strategy:
 *   - expo-router's useFocusEffect is captured so we control exactly when
 *     load() fires and can simulate two separate load cycles.
 *   - analysesApi.get is a jest.fn() that returns 'processing' then 'complete'.
 *   - profileApi.stats is a jest.fn() returning thisWeekCount = 3.
 *   - useAuth provides a profile with weeklyGoal = 3 so the threshold is met.
 *   - AsyncStorage is a controlled jest.fn() implementation:
 *       celebratedKey → null (test 1) or "true" (test 3)
 *       pendingKey    → "1"   (signals "just crossed")
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Week key helper (mirrors the component exactly) ──────────────────────────

function getExpectedWeekKey(): string {
  const d = new Date();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split("T")[0]!;
}

const WEEK_KEY       = getExpectedWeekKey();
const CELEBRATED_KEY = `confetti_celebrated_${WEEK_KEY}`;
const PENDING_KEY    = `confetti_pending_${WEEK_KEY}`;
const PREV_COUNT_KEY = `confetti_prev_count_${WEEK_KEY}`;

// ─── Module-level mock state ───────────────────────────────────────────────────

// Capture useFocusEffect callback so we control when focus/load fires.
let mockFocusCallback: (() => (() => void) | void) | null = null;

// AsyncStorage key→value store; tests override entries as needed.
let mockStorageStore: Record<string, string | null> = {};

// Controls what analysesApi.get resolves to for each call.
const mockAnalysesGet  = jest.fn();
const mockAnalysesList = jest.fn();
const mockProfileStats = jest.fn();

// Configurable useAuth return value — lets individual tests vary the cached weeklyGoal.
const mockUseAuth = jest.fn();

const mockAsyncStorageGetItem    = jest.fn((key: string) => Promise.resolve(mockStorageStore[key] ?? null));
const mockAsyncStorageSetItem    = jest.fn((key: string, value: string) => {
  mockStorageStore[key] = value;
  return Promise.resolve();
});
const mockAsyncStorageRemoveItem = jest.fn((key: string) => {
  delete mockStorageStore[key];
  return Promise.resolve();
});

// ─── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "test-analysis-1" }),
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
  shareAsync: jest.fn(),
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
    background:       "#0a0a0a",
    foreground:       "#f5f5f5",
    card:             "#1a1a1a",
    border:           "#2a2a2a",
    primary:          "#6c63ff",
    mutedForeground:  "#888888",
    muted:            "#333333",
    success:          "#22c55e",
    destructive:      "#ff4d6d",
    warning:          "#f59e0b",
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

const mockProfileGet = jest.fn();

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
      profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null, weeklyGoalCelebratedAt: null },
    }),
  },
  jointTrends: { get: jest.fn().mockResolvedValue({ joints: {} }) },
  movementSummaryHistory: { get: jest.fn().mockResolvedValue({ history: [] }) },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
  useCanAccessFeature: () => true,
}));

// Stub heavy sub-components — we're testing toast logic, not their rendering.
jest.mock("@/components/ScoreRing", () => ({ ScoreRing: () => null }));
jest.mock("@/components/analysis/ScoreCard", () => ({
  ScoreCard:    () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader",     () => ({ SectionHeader:     () => null }));
jest.mock("@/components/analysis/NextFocusCard",     () => ({ NextFocusCard:     () => null }));
jest.mock("@/components/analysis/AnimatedLoadingState", () => ({
  AnimatedLoadingState: () => null,
}));
jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:       () => null,
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
  resolveAdjacentIds:       jest.fn(() => ({ prevId: null, nextId: null })),
  shouldActivateSwipe:      jest.fn(() => false),
  resolveSwipeDirection:    jest.fn(() => "none"),
  resolveSwipeTranslation:  jest.fn(() => 0),
}));

jest.mock("@/hooks/useCardStagger", () => ({
  useCardStagger: jest.fn(() => ({
    cardAnims:    [],
    startStagger: jest.fn(),
  })),
}));

jest.mock("@/utils/shareUtils", () => ({
  buildGoalShareMessage:    jest.fn(() => "Share message"),
  buildSessionDeepLink:     jest.fn(() => "athleteai://analysis/test"),
  buildSessionShareMessage: jest.fn(() => "Session share"),
  buildSessionSharePayload: jest.fn(() => ({ message: "", url: "" })),
  SESSION_DEEP_LINK_SCHEME: "athleteai://analysis",
}));

// Import the screen AFTER all mocks are registered.
import AnalysisDetailScreen from "../[id]";

// ─── Fixture data ──────────────────────────────────────────────────────────────

const BASE_ANALYSIS = {
  id:               "test-analysis-1",
  title:            "Morning Run",
  sport:            "running",
  uploadedAt:       "2024-01-15T08:00:00Z",
  overallScore:     78,
  techniqueScore:   75,
  powerScore:       80,
  balanceScore:     72,
  consistencyScore: 68,
  mobilityScore:    82,
  speedScore:       77,
  jointAngles:      null,
  jointRisks:       null,
  biomechanicsApplied: false,
};

const PROCESSING_ANALYSIS = { ...BASE_ANALYSIS, status: "processing" };
const COMPLETE_ANALYSIS    = { ...BASE_ANALYSIS, status: "complete" };

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Flush all pending microtasks and React state updates. */
async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

/** Simulate the screen gaining focus, which triggers load(). */
async function simulateFocus() {
  await act(async () => {
    mockFocusCallback?.();
  });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback = null;
  mockStorageStore  = {};

  // Default: pending flag set (signals "just crossed"), nothing celebrated yet.
  mockStorageStore[PENDING_KEY] = "1";

  mockAnalysesGet.mockReset();
  mockAnalysesList.mockResolvedValue({ analyses: [] });
  mockProfileStats.mockResolvedValue({ thisWeekCount: 3 });
  mockProfileGet.mockResolvedValue({ profile: { weeklyGoal: 3, sport: "running" } });

  // Default cached context: weeklyGoal = 3.
  mockUseAuth.mockReturnValue({
    profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null },
    refreshProfile: jest.fn(async () => {}),
  });

  mockAsyncStorageGetItem.mockClear();
  mockAsyncStorageSetItem.mockClear();
  mockAsyncStorageRemoveItem.mockClear();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — 'Weekly goal reached!' toast", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("shows 'Weekly goal reached!' when status transitions processing → complete and goal is met", async () => {
    // First load → processing; second load → complete.
    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);

    // First focus: loads 'processing'. prevStatusRef is now "processing".
    await simulateFocus();

    // Toast must not appear yet (processing state).
    expect(queryByText("Weekly goal reached!")).toBeNull();

    // Second focus: loads 'complete'. prevStatusRef was "processing" → triggers checkGoalToast.
    await simulateFocus();

    expect(queryByText("Weekly goal reached!")).not.toBeNull();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("writes the celebrated key to AsyncStorage so the toast cannot fire again this week", async () => {
    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    render(<AnalysisDetailScreen />);
    await simulateFocus();
    await simulateFocus();

    // Exactly one write of "true" to the celebrated key must have happened.
    const celebrateCalls = mockAsyncStorageSetItem.mock.calls.filter(
      ([key, val]) => key === CELEBRATED_KEY && val === "true"
    );
    expect(celebrateCalls).toHaveLength(1);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("does NOT show the toast when the celebrated key is already set (same week, second analysis)", async () => {
    // Simulate: user has already seen the toast once this week.
    mockStorageStore[CELEBRATED_KEY] = "true";

    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await simulateFocus();

    expect(queryByText("Weekly goal reached!")).toBeNull();
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("does NOT show the toast when stats show count is below the weekly goal", async () => {
    // User has only completed 1 session but their goal is 3.
    mockProfileStats.mockResolvedValue({ thisWeekCount: 1 });

    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await simulateFocus();

    expect(queryByText("Weekly goal reached!")).toBeNull();
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────

  it("does NOT show the toast when no 'just crossed' signal exists in AsyncStorage", async () => {
    // Neither a pending flag nor a prev-count below goal — user is re-reviewing
    // an old session that was already counted.
    delete mockStorageStore[PENDING_KEY]; // no pending flag
    // No prevCountKey set either → prevCount will be null → justCrossed = false.

    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await simulateFocus();

    expect(queryByText("Weekly goal reached!")).toBeNull();
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────

  it("shows the toast when justCrossed is signalled by prevCount < weeklyGoal (no pending flag needed)", async () => {
    // Replace the pending flag with a prev-count snapshot that is below the goal.
    delete mockStorageStore[PENDING_KEY];
    mockStorageStore[PREV_COUNT_KEY] = "2"; // prev count 2, goal 3 → just crossed

    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await simulateFocus();

    expect(queryByText("Weekly goal reached!")).not.toBeNull();
  });

  // ── Test 7 — mid-week goal change: API goal raised above count ───────────────

  it("does NOT fire when the server returns a higher goal than the cached context (count below new goal)", async () => {
    // Scenario: user raised their weekly goal mid-week in Settings.
    //   Cached context (useAuth): weeklyGoal = 3  (stale)
    //   Server API (profileApi.get): weeklyGoal = 5  (fresh)
    //   thisWeekCount = 4
    // The component must use the fresh API value (5), so 4 < 5 → toast should NOT fire.
    // If it mistakenly used the cached value (3), 4 >= 3 would fire the toast incorrectly.
    mockProfileStats.mockResolvedValue({ thisWeekCount: 4 });
    mockProfileGet.mockResolvedValue({ profile: { weeklyGoal: 5, sport: "running" } });
    // Cached context still says goal = 3.
    mockUseAuth.mockReturnValue({
      profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null },
      refreshProfile: jest.fn(async () => {}),
    });

    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await simulateFocus();

    expect(queryByText("Weekly goal reached!")).toBeNull();
  });

  // ── Test 8 — mid-week goal change: API goal lowered below count ──────────────

  it("fires when the server returns a lower goal than the cached context (count meets new goal)", async () => {
    // Scenario: user lowered their weekly goal mid-week in Settings.
    //   Cached context (useAuth): weeklyGoal = 5  (stale)
    //   Server API (profileApi.get): weeklyGoal = 3  (fresh)
    //   thisWeekCount = 4
    // The component must use the fresh API value (3), so 4 >= 3 → toast SHOULD fire.
    // If it mistakenly used the cached value (5), 4 < 5 would suppress the toast incorrectly.
    mockProfileStats.mockResolvedValue({ thisWeekCount: 4 });
    mockProfileGet.mockResolvedValue({ profile: { weeklyGoal: 3, sport: "running" } });
    // Cached context says the old (higher) goal = 5.
    mockUseAuth.mockReturnValue({
      profile: { weeklyGoal: 5, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null },
      refreshProfile: jest.fn(async () => {}),
    });

    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);
    await simulateFocus();
    await simulateFocus();

    expect(queryByText("Weekly goal reached!")).not.toBeNull();
  });

});

// ── Tests 9 & 10 — timer-controlled dismiss behaviours ───────────────────────
// These tests control the 4 s polling clock and the 3.5 s auto-dismiss timer
// with fake timers.  The beforeEach/afterEach here mirror the pattern used in
// the "Polling path" describe block at the bottom of this file: fake timers
// are set up at the describe level (not inside the test body) to keep React's
// scheduler stable across all await/act calls.
describe("AnalysisDetailScreen — toast dismiss behaviours (fake timers)", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["MessageChannel" as "nextTick"] });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  /**
   * Drain pending microtasks only — no setTimeout — so this helper is safe
   * inside a fake-timer context where await act(async()=>{}) would hang
   * (React 18 scheduler internally uses setTimeout(0) which fake timers capture).
   */
  async function flushMicrotasksOnly(rounds = 8) {
    for (let i = 0; i < rounds; i++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  }

  // ── Test 10 — auto-dismiss after 3.5 s ──────────────────────────────────

  it("automatically dismisses the toast after 3.5 s without any user interaction", async () => {
    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);

    // First focus: loads 'processing'. isProcessing → true, polling setInterval starts.
    // Use the same simulateFocus() as the polling test (Test 11) — it works correctly
    // with doNotFake:["MessageChannel"] because Promise-based microtasks still drain.
    await simulateFocus();
    expect(queryByText("Weekly goal reached!")).toBeNull();

    // Advance one poll interval — the setInterval fires load(), which returns
    // COMPLETE_ANALYSIS.  prevStatusRef was "processing" → toast appears.
    // Use synchronous act() + flush() mirroring the pattern used in Test 11.
    act(() => { jest.advanceTimersByTime(4000); });
    await flush();

    // Toast must be visible immediately after the status transition.
    expect(queryByText("Weekly goal reached!")).not.toBeNull();

    // Advance past the 3.5 s auto-dismiss timer and the 250 ms fade-out
    // animation so the Animated.timing completion callback fires and sets
    // goalToast to null.
    act(() => { jest.advanceTimersByTime(3500 + 300); });
    await flush();

    // Toast must be gone after the auto-dismiss timer + animation elapse.
    expect(queryByText("Weekly goal reached!")).toBeNull();
  });

  // ── Test 9 — tapping the toast body dismisses it ─────────────────────────

  it("dismisses the toast when the toast body is tapped (not just the ✕ icon)", async () => {
    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);

    // First focus: loads 'processing'.
    await simulateFocus();
    expect(queryByText("Weekly goal reached!")).toBeNull();

    // Poll fires → 'complete' → toast appears.
    act(() => { jest.advanceTimersByTime(4000); });
    await flush();

    // Confirm the toast is visible before we tap it.
    expect(queryByText("Weekly goal reached!")).not.toBeNull();

    // Tap the toast title text — inside the TouchableOpacity that covers the
    // entire toast body (onPress={dismissToast}).  dismissToast() starts a
    // 250 ms fade-out animation whose completion callback sets goalToast to null.
    act(() => {
      fireEvent.press(queryByText("Weekly goal reached!")!);
      jest.advanceTimersByTime(300);
    });
    await flush();

    // After the animation completes, goalToast is null → toast must be gone.
    expect(queryByText("Weekly goal reached!")).toBeNull();
  });
});

// ─── Polling path ─────────────────────────────────────────────────────────────

describe("AnalysisDetailScreen — toast fires from the 4 s polling path", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["MessageChannel" as "nextTick"] });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("shows 'Weekly goal reached!' when the 4 s poll tick (not a re-focus) drives the processing → complete transition", async () => {
    // First call (via useFocusEffect) → processing; second call (via setInterval) → complete.
    mockAnalysesGet
      .mockResolvedValueOnce({ analysis: PROCESSING_ANALYSIS, tips: [], injuryRisks: [] })
      .mockResolvedValueOnce({ analysis: COMPLETE_ANALYSIS,   tips: [], injuryRisks: [] });

    const { queryByText } = render(<AnalysisDetailScreen />);

    // Trigger the focus callback: loads 'processing'.
    // isProcessing becomes true → the polling useEffect starts a 4 s setInterval.
    await simulateFocus();

    // Toast must not be visible yet.
    expect(queryByText("Weekly goal reached!")).toBeNull();

    // Advance fake clock by exactly one poll interval — the setInterval fires load(),
    // which returns COMPLETE_ANALYSIS.  prevStatusRef was "processing" → checkGoalToast runs.
    // Use synchronous act() to avoid React 18's internal setTimeout(0) scheduler
    // being captured by fake timers and causing act() to hang indefinitely.
    act(() => { jest.advanceTimersByTime(4000); });

    // Settle all async state updates triggered by the poll.
    await flush();

    expect(queryByText("Weekly goal reached!")).not.toBeNull();
  });
});
