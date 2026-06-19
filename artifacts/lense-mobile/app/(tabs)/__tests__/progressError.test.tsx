/**
 * Rendered component test: the Progress tab shows an error banner when data
 * fails to load, and the banner disappears after a successful pull-to-refresh.
 *
 * Mocking strategy (mirrors chatSportChange.test.tsx):
 *   - useFocusEffect is captured so tests control when focus events arrive.
 *   - @/lib/api mocks let each test control whether progress.list() succeeds
 *     or rejects, without touching the real network.
 *   - react-native-svg is stubbed to null so SVG rendering doesn't crash
 *     in the jsdom/RN test environment.
 *
 * Key assertions:
 *   1. When progress.list() rejects, the error banner text appears.
 *   2. When achievements.list() rejects, the same banner appears.
 *   3. After a failed load, triggering the RefreshControl's onRefresh with a
 *      succeeding API call removes the banner from the tree.
 *   4. A clean initial load never renders the banner.
 */

import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { render, act, within } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

// Capture useFocusEffect so tests fire it manually.
let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList = jest.fn();
const mockProgressSports = jest.fn();
const mockProgressPersonalRecords = jest.fn();
const mockProgressSummary = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats = jest.fn();
const mockJointTrendsGet = jest.fn();

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
    list:            (...args: any[]) => mockProgressList(...args),
    sports:          (...args: any[]) => mockProgressSports(...args),
    personalRecords: (...args: any[]) => mockProgressPersonalRecords(...args),
    summary:         (...args: any[]) => mockProgressSummary(...args),
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
}));

// Import component AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ERROR_BANNER_TEXT = "Couldn't load your progress. Pull down to try again.";

const EMPTY_PROGRESS = { entries: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

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

/**
 * Find the ScrollView's RefreshControl and call its onRefresh prop to
 * simulate a pull-to-refresh gesture.
 */
async function triggerRefresh(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getByType: (type: any) => any,
) {
  const scrollView = getByType(ScrollView);
  // refreshControl is typed as unknown in the RN test renderer; cast explicitly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rc = scrollView.props.refreshControl as React.ReactElement<{ onRefresh: () => void }>;
  await act(async () => {
    rc.props.onRefresh();
  });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

const EMPTY_SPORTS = { sports: [] };

beforeEach(() => {
  mockFocusCallback = null;
  mockProgressList.mockReset();
  mockAchievementsList.mockReset();
  // These are caught internally; default to success with empty payloads.
  mockProgressSports.mockResolvedValue(EMPTY_SPORTS);
  mockProgressPersonalRecords.mockResolvedValue({ records: {} });
  mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
  mockProfileStats.mockRejectedValue(new Error("not needed"));
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — error banner", () => {
  // ── Test 1 ───────────────────────────────────────────────────────────────────

  it("shows the error banner when progress.list() rejects", async () => {
    mockProgressList.mockRejectedValueOnce(new Error("Network request failed"));
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText(ERROR_BANNER_TEXT)).toBeTruthy();
  });

  // ── Test 2 ───────────────────────────────────────────────────────────────────

  it("shows the error banner when achievements.list() rejects", async () => {
    mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
    mockAchievementsList.mockRejectedValueOnce(new Error("Server error"));

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText(ERROR_BANNER_TEXT)).toBeTruthy();
  });

  // ── Test 3 ───────────────────────────────────────────────────────────────────

  it("hides the banner after a successful pull-to-refresh", async () => {
    // Initial load fails.
    mockProgressList.mockRejectedValueOnce(new Error("Timeout"));
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryByText, UNSAFE_getByType } = render(<ProgressScreen />);
    await simulateFocus();

    // Banner must be visible after the failed load.
    expect(getByText(ERROR_BANNER_TEXT)).toBeTruthy();

    // Refresh load succeeds.
    mockProgressList.mockResolvedValueOnce(EMPTY_PROGRESS);
    mockProgressSports.mockResolvedValueOnce(EMPTY_SPORTS);

    await triggerRefresh(UNSAFE_getByType);

    // Banner must be gone after the successful refresh.
    expect(queryByText(ERROR_BANNER_TEXT)).toBeNull();
  });

  // ── Test 4 ───────────────────────────────────────────────────────────────────

  it("never renders the banner when the initial load succeeds", async () => {
    mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText(ERROR_BANNER_TEXT)).toBeNull();
  });
});
