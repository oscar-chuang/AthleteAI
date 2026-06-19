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
import { render, act } from "@testing-library/react-native";

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
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile: { weeklyGoal: 3, sport: "running", level: "intermediate", name: "Test Athlete", avatarUrl: null },
    refreshProfile: jest.fn(async () => {}),
  }),
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
});
