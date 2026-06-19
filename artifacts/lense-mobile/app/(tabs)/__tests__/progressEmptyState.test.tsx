/**
 * Rendered component test: the Progress tab shows the primary empty-state card
 * when progressApi.list() returns { entries: [] } after a successful load.
 *
 * The empty-state card is rendered by the JSX guard:
 *   {allEntries.length === 0 ? <View style={s.emptyCard}>…</View> : …}
 *
 * Mocking strategy mirrors progressError.test.tsx / mostImprovedCard.test.tsx:
 *   - useFocusEffect is captured so tests fire focus manually.
 *   - @/lib/api mocks control what progress.list() returns.
 *   - react-native-svg is stubbed to null (crashes in the RN test environment).
 *
 * Key invariants under test:
 *   1. When progress.list() returns { entries: [] }, the primary empty-state card
 *      text and CTA button are present.
 *   2. When progress.list() returns one or more entries, the primary empty-state
 *      card text is absent (session log renders instead).
 *   3. The empty-state card is absent while the initial load is still in flight
 *      (loading spinner shows, not the empty-state card).
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList    = jest.fn();
const mockProgressSports  = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats    = jest.fn();
const mockJointTrendsGet  = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => (() => void) | void) => {
    mockFocusCallback = cb;
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: () => null,
  Svg: () => null,
  Line: () => null,
  Path: () => null,
  Polyline: () => null,
  Circle: () => null,
  Text: () => null,
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
    sports:          (...args: any[]) => mockProgressSports(...args),
    personalRecords: jest.fn().mockResolvedValue({ records: {} }),
    summary:         jest.fn().mockResolvedValue({ summary: "", cached: false }),
  },
  achievements: {
    list: (...args: any[]) => mockAchievementsList(...args),
  },
  profile: {
    stats: (...args: any[]) => mockProfileStats(...args),
  },
  jointTrends: {
    get: (...args: any[]) => mockJointTrendsGet(...args),
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

const EMPTY_PROGRESS      = { entries: [] };
const EMPTY_SPORTS        = { sports: [] };
const EMPTY_ACHIEVEMENTS  = { achievements: [] };

// Text content of the primary empty-state card (allEntries.length === 0 path).
const EMPTY_STATE_TEXT = "Complete your first analysis to start tracking progress.";
const EMPTY_STATE_BTN  = "Analyze a Video";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending React state updates and async effects. */
async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

/** Simulate the tab gaining focus (fires the useFocusEffect callback). */
async function simulateFocus() {
  await act(async () => {
    mockFocusCallback?.();
  });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback = null;
  mockProgressList.mockReset();
  mockProgressSports.mockResolvedValue(EMPTY_SPORTS);
  mockAchievementsList.mockReset();
  mockProfileStats.mockRejectedValue(new Error("not needed"));
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — primary empty state (no sessions logged)", () => {
  // ── Test 1 ───────────────────────────────────────────────────────────────────

  it("shows the empty-state card when progress.list() returns no entries", async () => {
    mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // The primary empty-state copy and its CTA button must be rendered.
    expect(getByText(EMPTY_STATE_TEXT)).toBeTruthy();
    expect(getByText(EMPTY_STATE_BTN)).toBeTruthy();
  });

  // ── Test 2 ───────────────────────────────────────────────────────────────────

  it("hides the empty-state card when progress.list() returns at least one entry", async () => {
    mockProgressList.mockResolvedValue({
      entries: [
        {
          id:               "s1",
          userId:           "u1",
          analysisId:       "a1",
          date:             "2026-06-01T10:00:00Z",
          sport:            "running",
          overallScore:     74,
          techniqueScore:   70,
          powerScore:       72,
          balanceScore:     68,
          consistencyScore: 75,
          mobilityScore:    80,
          speedScore:       65,
        },
      ],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Empty-state copy must NOT appear when there is data.
    expect(queryByText(EMPTY_STATE_TEXT)).toBeNull();
    expect(queryByText(EMPTY_STATE_BTN)).toBeNull();
  });

  // ── Test 3 ───────────────────────────────────────────────────────────────────

  it("does not show the empty-state card while the initial load is in flight", async () => {
    // Never resolve so the screen stays in the loading spinner state.
    mockProgressList.mockReturnValue(new Promise(() => {}));
    mockAchievementsList.mockReturnValue(new Promise(() => {}));

    const { queryByText } = render(<ProgressScreen />);
    // Do NOT call simulateFocus — render immediately captures the loading state.

    expect(queryByText(EMPTY_STATE_TEXT)).toBeNull();
    expect(queryByText(EMPTY_STATE_BTN)).toBeNull();
  });
});

// ─── Tests: filter-scoped empty state ────────────────────────────────────────
//
// Covers the second empty-state branch in the JSX:
//
//   {allEntries.length === 0 ? <primary empty state> : filteredEntries.length === 0 ? <filter empty state> : <session log>}
//
// The filter-scoped state fires when the user has sessions overall but the
// active sport / period filter excludes all of them.
//
// Key invariants under test:
//   4. When allEntries has data but filteredEntries is empty (period filter
//      excludes every entry), the filter-scoped empty-state card appears with
//      the appropriate text and a "Show All Time" CTA.
//   5. Pressing "Show All Time" resets the period back to "All" and the
//      filter-scoped empty-state card disappears.

describe("ProgressScreen — filter-scoped empty state (sport/period filter excludes all entries)", () => {
  // A "running" entry with a date well outside any rolling-window filter.
  // "2020-01-01" is excluded by 1W, 1M, and 3M period filters.
  const RUNNING_ENTRY_OLD = {
    id:               "s1",
    userId:           "u1",
    analysisId:       "a1",
    date:             "2020-01-01T10:00:00Z",
    sport:            "running",
    overallScore:     74,
    techniqueScore:   70,
    powerScore:       72,
    balanceScore:     68,
    consistencyScore: 75,
    mobilityScore:    80,
    speedScore:       65,
  };

  // ── Test 4 ───────────────────────────────────────────────────────────────────

  it("shows the filter-scoped empty state when the period filter excludes all entries", async () => {
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_OLD] });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // allEntries has data — primary empty state must NOT be visible.
    expect(queryByText(EMPTY_STATE_TEXT)).toBeNull();
    expect(queryByText(EMPTY_STATE_BTN)).toBeNull();

    // Apply the "1W" period filter — the 2020 entry falls outside the window,
    // so filteredEntries becomes empty while allEntries still has 1 entry.
    await act(async () => {
      fireEvent.press(getByText("1W"));
    });
    await flush();

    // The filter-scoped empty-state text is rendered in two places inside the
    // component (the trend-chart inline notice and the session-log card).
    // Use getAllByText to confirm at least one instance is visible.
    expect(getAllByText(/No sessions in this period/).length).toBeGreaterThan(0);
    expect(getByText("Show All Time")).toBeTruthy();
  });

  // ── Test 5 ───────────────────────────────────────────────────────────────────

  it("hides the filter-scoped empty state after pressing Show All Time", async () => {
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_OLD] });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryAllByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Apply the "1W" filter to trigger the filter-scoped empty state.
    await act(async () => {
      fireEvent.press(getByText("1W"));
    });
    await flush();

    expect(queryAllByText(/No sessions in this period/).length).toBeGreaterThan(0);

    // Pressing "Show All Time" resets period to "All" — filteredEntries is
    // repopulated with the single running entry, so the empty state disappears.
    await act(async () => {
      fireEvent.press(getByText("Show All Time"));
    });
    await flush();

    expect(queryAllByText(/No sessions in this period/).length).toBe(0);
    expect(queryByText("Show All Time")).toBeNull();
  });
});
