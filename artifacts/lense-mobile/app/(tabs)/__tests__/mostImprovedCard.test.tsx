/**
 * Unit tests: the 'Most improved joint' card on the Progress screen.
 *
 * The card appears when trends.improvements contains at least one entry where
 * improved === true AND deltaDeg > 0.  The joint with the highest deltaDeg wins
 * the card; ties are broken by whichever appears first in the reduce (last
 * writer does NOT win — the reducer keeps the current best on a tie).
 *
 * Mocking strategy mirrors progressError.test.tsx:
 *   - useFocusEffect is captured so tests control when focus fires.
 *   - @/lib/api mocks give each test full control over jointTrends.get().
 *   - react-native-svg is stubbed to null (crashes in jsdom otherwise).
 *
 * Scenarios covered:
 *   1. Multiple positive improvements → only the largest deltaDeg joint appears.
 *   2. Largest-deltaDeg joint is NOT improved=true → runner-up wins.
 *   3. All deltaDeg <= 0 → card is absent.
 *   4. All improved === false → card is absent.
 *   5. trends is null (API fails) → card is absent.
 *   6. Card visible initially; after period-filter change reduces to a single
 *      scan (deltaDeg = 0 on reload), the card is absent.
 */

import React from "react";
import { render, act, waitFor, fireEvent } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats = jest.fn();
const mockJointTrendsGet = jest.fn();
const mockSports = jest.fn();

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
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    getAllKeys: jest.fn(async () => []),
    multiGet: jest.fn(async () => []),
  },
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#0a0a0a",
    foreground: "#f5f5f5",
    card: "#1a1a1a",
    border: "#2a2a2a",
    primary: "#6c63ff",
    mutedForeground: "#888888",
    muted: "#333333",
    success: "#22c55e",
    warning: "#f59e0b",
    destructive: "#ff4d6d",
    radius: 12,
  }),
}));

jest.mock("@/lib/api", () => ({
  progress: {
    list: (...args: any[]) => mockProgressList(...args),
    sports: (...args: any[]) => mockSports(...args),
    personalRecords: jest.fn().mockResolvedValue({ records: {} }),
    summary: jest.fn().mockResolvedValue({ summary: "" }),
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

const EMPTY_PROGRESS = { entries: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

const MOST_IMPROVED_LABEL = "Most improved · tap to view trend";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fire the captured useFocusEffect callback inside act() so React processes
 * the initial synchronous state updates. Individual tests use waitFor() to
 * drain the remaining async chain — this is robust against variable microtask
 * depth without relying on a fixed flush-round count.
 */
async function simulateFocus() {
  await act(async () => {
    mockFocusCallback?.();
  });
}

/**
 * Wait for the screen's title ("Progress") to appear, which signals that
 * loading has finished and all data-driven state has settled. Use this
 * before asserting element absence so the check runs after the full async
 * chain completes rather than catching a transient pre-load state.
 */
async function waitForLoaded(queryByText: (text: string) => any) {
  await waitFor(() => {
    expect(queryByText("Progress")).toBeTruthy();
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback = null;
  mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
  mockProfileStats.mockRejectedValue(new Error("not needed"));
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
  mockSports.mockResolvedValue({ sports: [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — most improved joint card", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("shows the joint with the highest positive deltaDeg", async () => {
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: [
        { joint: "rightHip",  deltaDeg: 3,  sessions: 2, improved: true },
        { joint: "leftKnee",  deltaDeg: 8,  sessions: 3, improved: true },
        { joint: "rightKnee", deltaDeg: 5,  sessions: 2, improved: true },
      ],
    });

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Wait for the winning joint card to appear — this drains the full async
    // chain (loadData → setAllTrends → re-render) regardless of microtask depth.
    await waitFor(() => expect(getByText("Left Knee +8°")).toBeTruthy());

    // The 'Most improved' subtitle must be present.
    expect(getByText(MOST_IMPROVED_LABEL)).toBeTruthy();

    // The other joints must NOT appear in a 'Most improved' context.
    expect(queryByText("Right Hip +3°")).toBeNull();
    expect(queryByText("Right Knee +5°")).toBeNull();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("ignores entries where improved === false, even if they have the highest deltaDeg", async () => {
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: [
        // Highest deltaDeg but NOT marked improved — must be ignored.
        { joint: "leftHip",   deltaDeg: 20, sessions: 4, improved: false },
        // Runner-up is the actual winner.
        { joint: "rightKnee", deltaDeg: 6,  sessions: 2, improved: true },
        { joint: "leftKnee",  deltaDeg: 2,  sessions: 1, improved: true },
      ],
    });

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    await waitFor(() => expect(getByText("Right Knee +6°")).toBeTruthy());

    expect(getByText(MOST_IMPROVED_LABEL)).toBeTruthy();
    expect(queryByText("Left Hip +20°")).toBeNull();
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("hides the card when all deltaDeg values are zero or negative", async () => {
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: [
        { joint: "leftKnee",  deltaDeg: 0,  sessions: 2, improved: false },
        { joint: "rightHip",  deltaDeg: -3, sessions: 2, improved: false },
      ],
    });

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Wait for loading to fully complete before asserting absence.
    await waitForLoaded(queryByText);
    expect(queryByText(MOST_IMPROVED_LABEL)).toBeNull();
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("hides the card when all entries have improved === false", async () => {
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: [
        { joint: "leftKnee",  deltaDeg: 5, sessions: 2, improved: false },
        { joint: "rightKnee", deltaDeg: 9, sessions: 3, improved: false },
      ],
    });

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    await waitForLoaded(queryByText);
    expect(queryByText(MOST_IMPROVED_LABEL)).toBeNull();
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────

  it("hides the card when the jointTrends API call fails", async () => {
    // mockJointTrendsGet already rejects by default in beforeEach.

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    await waitForLoaded(queryByText);
    expect(queryByText(MOST_IMPROVED_LABEL)).toBeNull();
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────

  it("hides the card after a period-filter change reduces history to a single scan (deltaDeg = 0 )", async () => {
    // Provide a progress entry with a recent date so allEntries.length > 0,
    // which is required for the period-filter buttons ("1W", "1M", "3M", "All")
    // to render (they live inside {allEntries.length > 0 && <View>…</View>}).
    mockProgressList.mockResolvedValue({
      entries: [
        {
          id: "s1",
          userId: "u1",
          analysisId: "a1",
          date: new Date().toISOString(),
          sport: "running",
          overallScore: 74,
          techniqueScore: 70,
          powerScore: 72,
          balanceScore: 68,
          consistencyScore: 75,
          mobilityScore: 80,
          speedScore: 65,
        },
      ],
    });

    // Initial load: two sessions in history → positive deltaDeg → card visible.
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: [
        { joint: "leftKnee", deltaDeg: 8, sessions: 2, improved: true },
      ],
    });

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Card must be present after the initial load.
    await waitFor(() => expect(getByText("Left Knee +8°")).toBeTruthy());
    expect(getByText(MOST_IMPROVED_LABEL)).toBeTruthy();

    // Press the "1W" period-filter button (visible because allEntries.length > 0).
    // This narrows the visible window. In production the next server fetch for
    // joint trends will return only a single session in range, so deltaDeg = 0.
    await act(async () => {
      fireEvent.press(getByText("1W"));
    });

    // Update the mock to reflect single-scan data — deltaDeg = 0 because only
    // one session falls in the selected window (no before/after pair to compare).
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: [
        { joint: "leftKnee", deltaDeg: 0, sessions: 1, improved: false },
      ],
    });

    // Re-focus the screen (user navigates away then back). This triggers
    // loadData, which re-fetches joint trends and sets allTrends to the
    // single-scan result. filteredTrends.improvements then contains only an
    // entry with deltaDeg = 0, so mostImproved reduces to null.
    await simulateFocus();

    await waitForLoaded(queryByText);
    expect(queryByText(MOST_IMPROVED_LABEL)).toBeNull();
  });
});

// ─── Sport-filter tests ────────────────────────────────────────────────────────
//
// filteredTrends in progress.tsx restricts improvements to availableJoints for
// the selected sport.  These tests verify that:
//   7. When a sport filter is active, only that sport's joints are eligible to
//      win the card — the global winner is suppressed if its joint is absent
//      from the sport's joint list.
//   8. A different sport whose joint list DOES include the global winner shows
//      it correctly (baseline check that sport filtering is directional).
//
// Sport choices:
//   tennis  → joints: [leftElbow, rightElbow, leftHip, rightHip]  — no knees
//   running → joints: [leftKnee, rightKnee, leftHip, rightHip]    — no elbows

describe("ProgressScreen — most improved joint card with sport filter", () => {
  // Shared trend data: leftKnee is the global winner (deltaDeg=15), leftElbow
  // is the runner-up (deltaDeg=7).  rightHip trails at deltaDeg=3.
  const SPORT_FILTER_IMPROVEMENTS = [
    { joint: "leftKnee",  deltaDeg: 15, sessions: 4, improved: true },
    { joint: "leftElbow", deltaDeg: 7,  sessions: 3, improved: true },
    { joint: "rightHip",  deltaDeg: 3,  sessions: 2, improved: true },
  ];

  // ── Test 7 ──────────────────────────────────────────────────────────────────

  it("promotes the runner-up when the sport filter excludes the global winner joint", async () => {
    // Tennis has no knee joints → leftKnee must be excluded from eligibility.
    // The runner-up leftElbow (+7°) should win instead.
    mockSports.mockResolvedValue({
      sports: [{ sport: "tennis", count: 5, movementTypes: [] }],
    });
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: SPORT_FILTER_IMPROVEMENTS,
    });

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Runner-up (leftElbow) must win because tennis excludes knee joints.
    await waitFor(() => expect(getByText("Left Elbow +7°")).toBeTruthy());
    expect(getByText(MOST_IMPROVED_LABEL)).toBeTruthy();

    // Global winner (leftKnee) must NOT appear in a Most improved context.
    expect(queryByText("Left Knee +15°")).toBeNull();
  });

  // ── Test 8 ──────────────────────────────────────────────────────────────────

  it("shows the global winner when the sport filter includes its joint", async () => {
    // Running joints include leftKnee → the global winner (leftKnee +15°) wins.
    // leftElbow is excluded because running has no elbow joints.
    mockSports.mockResolvedValue({
      sports: [{ sport: "running", count: 5, movementTypes: [] }],
    });
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: SPORT_FILTER_IMPROVEMENTS,
    });

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Global winner must appear.
    await waitFor(() => expect(getByText("Left Knee +15°")).toBeTruthy());
    expect(getByText(MOST_IMPROVED_LABEL)).toBeTruthy();

    // Runner-up (leftElbow) must not appear — running excludes elbow joints.
    expect(queryByText("Left Elbow +7°")).toBeNull();
  });

  // ── Test 9 ──────────────────────────────────────────────────────────────────

  it("hides the card when the sport filter is switched to a sport whose joints exclude the improved joint", async () => {
    // Two sports available so the chip row renders (requires sportsList.length >= 2).
    // running is sports[0] → auto-selected on load; its joints include leftKnee.
    // tennis is sports[1]; its joints are [leftElbow, rightElbow, leftHip, rightHip] — no knees.
    mockSports.mockResolvedValue({
      sports: [
        { sport: "running", count: 4, movementTypes: [] },
        { sport: "tennis",  count: 3, movementTypes: [] },
      ],
    });
    mockJointTrendsGet.mockResolvedValue({
      joints: {},
      improvements: [
        { joint: "leftKnee", deltaDeg: 12, sessions: 3, improved: true },
      ],
    });

    const { getByText, queryByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // After initial load: running is auto-selected; leftKnee is a running joint → card visible.
    await waitFor(() => expect(getByText("Left Knee +12°")).toBeTruthy());
    expect(getByText(MOST_IMPROVED_LABEL)).toBeTruthy();

    // Press the tennis chip — tennis has no knee joints, so leftKnee is excluded
    // from filteredTrends.improvements and mostImproved reduces to null.
    const [tennisChip] = getAllByText("tennis");
    await act(async () => {
      fireEvent.press(tennisChip!);
    });

    // Card must disappear: no eligible joint survives the tennis joint filter.
    await waitFor(() => expect(queryByText(MOST_IMPROVED_LABEL)).toBeNull());
    expect(queryByText("Left Knee +12°")).toBeNull();
  });
});
