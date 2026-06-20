/**
 * Unit tests: week-over-week comparison display on the Progress screen.
 *
 * The summary card shows:
 *   - `{stats.thisWeekCount}` as the numeric value
 *   - `"This week"` as the static label
 *   - A computed delta line when lastWeekCount > 0:
 *       positive  → "↑ N from last week"  (green)
 *       negative  → "↓ N from last week"  (amber)
 *       zero      → "same as last week"   (muted)
 *   - No delta line when lastWeekCount === 0 (no prior-week data)
 *
 * The three canonical delta cases are:
 *   1. Positive delta — thisWeekCount > lastWeekCount  (5 vs 3  → "↑ 2 from last week")
 *   2. Negative delta — thisWeekCount < lastWeekCount  (2 vs 5  → "↓ 3 from last week")
 *   3. Zero delta     — thisWeekCount === lastWeekCount (3 vs 3 → "same as last week")
 *   4. lastWeekCount === 0 — no delta line rendered at all
 *   5. Stats API failure — entire week-count block is absent
 *
 * Mocking strategy mirrors mostImprovedCard.test.tsx:
 *   - useFocusEffect is captured so tests control when focus fires.
 *   - @/lib/api mocks give full control over profile.stats().
 *   - react-native-svg is stubbed to null (crashes in jsdom otherwise).
 */

import React from "react";
import { render, act, waitFor } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProfileStats     = jest.fn();
const mockProgressList     = jest.fn();
const mockAchievementsList = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter:            () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect:       (cb: () => (() => void) | void) => { mockFocusCallback = cb; },
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default:  () => null,
  Svg:      () => null,
  Line:     () => null,
  Path:     () => null,
  Polyline: () => null,
  Circle:   () => null,
  Text:     () => null,
  Rect:     () => null,
  G:        () => null,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(async () => {}),
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
    warning:         "#f59e0b",
    destructive:     "#ff4d6d",
    radius:          12,
  }),
}));

jest.mock("@/lib/api", () => ({
  progress: {
    list:            (...args: any[]) => mockProgressList(...args),
    sports:          jest.fn().mockResolvedValue({ sports: [] }),
    personalRecords: jest.fn().mockResolvedValue({ records: {} }),
    summary:         jest.fn().mockResolvedValue({ summary: "" }),
  },
  achievements: {
    list: (...args: any[]) => mockAchievementsList(...args),
  },
  profile: {
    stats: (...args: any[]) => mockProfileStats(...args),
  },
  jointTrends: {
    get: jest.fn().mockRejectedValue(new Error("not needed")),
  },
  movementSummaryHistory: {
    get: jest.fn().mockResolvedValue({ history: [] }),
  },
  analyses: {
    get: jest.fn().mockResolvedValue({ analysis: {}, tips: [], injuryRisks: [] }),
  },
}));

// Import component AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const EMPTY_PROGRESS     = { entries: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

function makeStats(thisWeekCount: number, lastWeekCount: number) {
  return {
    totalSessions: thisWeekCount + lastWeekCount,
    thisWeekCount,
    lastWeekCount,
    streak: 0,
    weeklyGoal: 3,
    weeklyProgress: thisWeekCount,
    streakDays: [],
    drillsMastered: 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function simulateFocus() {
  await act(async () => {
    mockFocusCallback?.();
  });
}

async function waitForLoaded(getByText: (text: string) => any) {
  await waitFor(() => {
    expect(getByText("Progress")).toBeTruthy();
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback = null;
  mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — week-over-week comparison", () => {
  // ── Test 1: positive delta ───────────────────────────────────────────────────

  it("shows '↑ 2 from last week' when thisWeekCount (5) exceeds lastWeekCount (3)", async () => {
    mockProfileStats.mockResolvedValue(makeStats(5, 3));

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    await waitForLoaded(getByText);

    // The numeric this-week count must appear.
    expect(getByText("5")).toBeTruthy();

    // Positive delta: the up-arrow line must be present.
    expect(getByText("↑ 2 from last week")).toBeTruthy();

    // The negative-delta and flat-delta variants must not appear.
    expect(queryByText(/↓ \d+ from last week/)).toBeNull();
    expect(queryByText("same as last week")).toBeNull();
  });

  // ── Test 2: negative delta ───────────────────────────────────────────────────

  it("shows '↓ 3 from last week' when thisWeekCount (2) is less than lastWeekCount (5)", async () => {
    mockProfileStats.mockResolvedValue(makeStats(2, 5));

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    await waitForLoaded(getByText);

    expect(getByText("2")).toBeTruthy();

    // Negative delta: the down-arrow line must be present.
    expect(getByText("↓ 3 from last week")).toBeTruthy();

    // The positive-delta and flat-delta variants must not appear.
    expect(queryByText(/↑ \d+ from last week/)).toBeNull();
    expect(queryByText("same as last week")).toBeNull();
  });

  // ── Test 3: zero delta ───────────────────────────────────────────────────────

  it("shows 'same as last week' when thisWeekCount === lastWeekCount (both 3)", async () => {
    mockProfileStats.mockResolvedValue(makeStats(3, 3));

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    await waitForLoaded(getByText);

    expect(getByText("3")).toBeTruthy();

    // Zero delta: the flat label must appear.
    expect(getByText("same as last week")).toBeTruthy();

    // Arrow variants must not appear.
    expect(queryByText(/↑ \d+ from last week/)).toBeNull();
    expect(queryByText(/↓ \d+ from last week/)).toBeNull();
  });

  // ── Test 4: no prior-week data → no delta line ───────────────────────────────

  it("omits the delta line entirely when lastWeekCount is 0", async () => {
    mockProfileStats.mockResolvedValue(makeStats(4, 0));

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    await waitForLoaded(getByText);

    // This week count must still appear.
    expect(getByText("4")).toBeTruthy();

    // No prior-week data: none of the comparison strings must appear.
    expect(queryByText(/↑ \d+ from last week/)).toBeNull();
    expect(queryByText(/↓ \d+ from last week/)).toBeNull();
    expect(queryByText("same as last week")).toBeNull();
  });

  // ── Test 5: stats API failure → block is absent ──────────────────────────────

  it("hides the week-count block when the stats API call fails", async () => {
    mockProfileStats.mockRejectedValue(new Error("network error"));

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    await waitForLoaded(queryByText as any);

    // Without stats the entire card is not rendered.
    expect(queryByText("This week")).toBeNull();
    expect(queryByText(/↑ \d+ from last week/)).toBeNull();
    expect(queryByText(/↓ \d+ from last week/)).toBeNull();
    expect(queryByText("same as last week")).toBeNull();
  });
});
