/**
 * Rendered component test: the Progress tab shows the Movement Quality section
 * only when `movementSummaryHistory.get()` returns at least one data point, and
 * correctly renders the five dimension labels, delta text, and sport filter.
 *
 * The Movement Quality section is rendered by the JSX guard:
 *   {filteredMovementHistory.length >= 1 ? <View>…MOVEMENT_DIMENSIONS…</View> : null}
 *
 * `filteredMovementHistory` is derived from `allMovementHistory` (loaded via
 * `movementSummaryHistoryApi.get()`) filtered by `selectedSport` and `period`.
 *
 * Mocking strategy mirrors progressEmptyState.test.tsx:
 *   - useFocusEffect is captured so tests fire focus manually.
 *   - @/lib/api mocks control what movementSummaryHistory.get() returns.
 *   - react-native-svg is stubbed to null (crashes in the RN test environment).
 *
 * Key invariants under test:
 *   1. Section is hidden when movementSummaryHistory.get() returns { history: [] }.
 *   2. Section renders all five dimension labels (Flow, Efficiency, Control,
 *      Consistency, Rhythm) when history contains at least one session.
 *   3. Delta text ("over N scans") is absent when only 1 session is present;
 *      present for all five dimensions when 2+ sessions exist.
 *   4. Sport filter is respected: section hides when the auto-selected sport has
 *      no matching movement history entries.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList              = jest.fn();
const mockProgressSports            = jest.fn();
const mockAchievementsList          = jest.fn();
const mockMovementSummaryHistoryGet = jest.fn();

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
  default:    () => null,
  Svg:        () => null,
  Line:       () => null,
  Path:       () => null,
  Polyline:   () => null,
  Circle:     () => null,
  Text:       () => null,
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
    stats: jest.fn().mockRejectedValue(new Error("not needed")),
  },
  jointTrends: {
    get: jest.fn().mockRejectedValue(new Error("not needed")),
  },
  movementSummaryHistory: {
    get: (...args: any[]) => mockMovementSummaryHistoryGet(...args),
  },
  analyses: {
    get: jest.fn().mockResolvedValue({ analysis: {}, tips: [], injuryRisks: [] }),
  },
}));

// Import component AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const EMPTY_PROGRESS     = { entries: [] };
const EMPTY_SPORTS       = { sports: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

/** One movement summary data point for "running". */
const MQ_SESSION_RUNNING = {
  analysisId:       "a1",
  date:             "2026-06-01T10:00:00Z",
  sport:            "running",
  flowScore:        72,
  efficiencyScore:  68,
  bodyControlScore: 75,
  consistencyScore: 80,
  rhythmScore:      65,
  overallScore:     72,
};

/** A second movement summary data point for "running", one week later. */
const MQ_SESSION_RUNNING_2 = {
  analysisId:       "a2",
  date:             "2026-06-08T10:00:00Z",
  sport:            "running",
  flowScore:        78,
  efficiencyScore:  74,
  bodyControlScore: 81,
  consistencyScore: 85,
  rhythmScore:      70,
  overallScore:     78,
};

const DIMENSION_LABELS = ["Flow", "Efficiency", "Control", "Consistency", "Rhythm"];
const SECTION_HEADING  = "Movement Quality";

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
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback = null;
  mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
  mockProgressSports.mockResolvedValue(EMPTY_SPORTS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
  mockMovementSummaryHistoryGet.mockResolvedValue({ history: [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — Movement Quality section", () => {
  // ── Test 1 ───────────────────────────────────────────────────────────────────

  it("hides the Movement Quality section when movementSummaryHistory returns an empty history", async () => {
    mockMovementSummaryHistoryGet.mockResolvedValue({ history: [] });

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText(SECTION_HEADING)).toBeNull();
  });

  // ── Test 2 ───────────────────────────────────────────────────────────────────

  it("renders all five dimension labels when history contains at least one session", async () => {
    mockMovementSummaryHistoryGet.mockResolvedValue({ history: [MQ_SESSION_RUNNING] });

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText(SECTION_HEADING)).toBeTruthy();
    for (const label of DIMENSION_LABELS) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  // ── Test 3a ──────────────────────────────────────────────────────────────────

  it("omits delta text when only one session is present", async () => {
    mockMovementSummaryHistoryGet.mockResolvedValue({ history: [MQ_SESSION_RUNNING] });

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // The "over N scans" delta row is gated on scores.length >= 2; with a
    // single session it must not appear.
    expect(queryByText(/over \d+ scans?/)).toBeNull();
  });

  // ── Test 3b ──────────────────────────────────────────────────────────────────

  it("shows delta text for each dimension when two or more sessions are present", async () => {
    mockMovementSummaryHistoryGet.mockResolvedValue({
      history: [MQ_SESSION_RUNNING, MQ_SESSION_RUNNING_2],
    });

    const { getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Each of the 5 dimensions renders "… over 2 scans".
    const deltaMatches = getAllByText(/over 2 scans/);
    expect(deltaMatches.length).toBe(DIMENSION_LABELS.length);
  });

  // ── Test 4 ───────────────────────────────────────────────────────────────────

  it("hides the section when the auto-selected sport has no matching movement history", async () => {
    // The sports list auto-selects "swimming". The movement history only
    // contains "running" entries, so filteredMovementHistory becomes empty.
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "swimming", count: 1, movementTypes: [] }],
    });
    mockMovementSummaryHistoryGet.mockResolvedValue({ history: [MQ_SESSION_RUNNING] });

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText(SECTION_HEADING)).toBeNull();
  });

  // ── Test 5 ───────────────────────────────────────────────────────────────────

  it("hides the Movement Quality section when the period filter excludes all history entries", async () => {
    // The only movement history entry is from 2020 — well outside the 1W window.
    const OLD_SESSION = {
      ...MQ_SESSION_RUNNING,
      analysisId: "a-old",
      date: "2020-01-01T10:00:00Z",
    };
    mockMovementSummaryHistoryGet.mockResolvedValue({ history: [OLD_SESSION] });

    // Provide a recent ProgressRecord so `allEntries.length > 0` renders the
    // period-selector row ("1W" / "1M" / "3M" / "All" buttons).
    const PROGRESS_ENTRY = {
      id: "p1",
      title: "Running session",
      sport: "running",
      movementType: null,
      date: new Date().toISOString(),
      overallScore: 72,
    };
    mockProgressList.mockResolvedValue({ entries: [PROGRESS_ENTRY] });

    const { queryByText, getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // With the default "All" period the movement quality section must be visible.
    expect(getByText(SECTION_HEADING)).toBeTruthy();

    // Switch to "1W" — the 2020 entry falls outside the 7-day window.
    await act(async () => {
      fireEvent.press(getByText("1W"));
    });
    await flush();

    expect(queryByText(SECTION_HEADING)).toBeNull();
  });
});
