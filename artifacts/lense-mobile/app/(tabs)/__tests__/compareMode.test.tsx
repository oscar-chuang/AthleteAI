/**
 * Rendered component tests: compare mode toggle and rendering on the Progress screen.
 *
 * Mocking strategy mirrors progressSportSelector.test.tsx:
 *   - useFocusEffect is captured so tests control when focus events arrive.
 *   - @/lib/api mocks let each test control individual API responses.
 *   - react-native-svg is stubbed to null so SVG rendering doesn't crash.
 *
 * Key assertions:
 *   1. The Compare toggle appears when the selected sport has ≥2 movement types.
 *   2. The Compare toggle is absent when the selected sport has <2 movement types.
 *   3. Tapping the Compare toggle enters compare mode — A hint becomes visible.
 *   4. After entering compare mode and tapping a second movement type, the B hint appears.
 *   5. The Personal Records section header shows "X vs Y" when both A and B are set.
 *   6. Compare mode resets (hint disappears) when the athlete switches sports.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

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
  movementSummaryHistory: {
    get: jest.fn().mockResolvedValue({ history: [] }),
  },
  analyses: {
    get: jest.fn().mockResolvedValue({ analysis: {}, tips: [], injuryRisks: [] }),
  },
}));

// Import AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_ACHIEVEMENTS = { achievements: [] };

/** Sport with two named movement types — unlocks the compare sub-filter row. */
const RUNNING_TWO_MOVEMENTS = {
  sport: "running",
  count: 4,
  movementTypes: ["Sprint", "Long Distance"],
};

/** Sport with only one movement type — compare toggle must stay hidden. */
const CYCLING_ONE_MOVEMENT = {
  sport: "cycling",
  count: 2,
  movementTypes: ["Road"],
};

/** Two sports (so the sport selector renders) — running has 2 movements, cycling has 1. */
const TWO_SPORTS_MIXED = {
  sports: [RUNNING_TWO_MOVEMENTS, CYCLING_ONE_MOVEMENT],
};

const RUNNING_ENTRY = {
  id: "r1",
  title: "Morning Run",
  sport: "running",
  movementType: "Sprint",
  date: "2026-06-10T00:00:00Z",
  overallScore: 74,
  techniqueScore: 80,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending React state updates and async effects. */
async function flush(rounds = 8) {
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
  mockProgressSports.mockReset();
  mockProgressPersonalRecords.mockReset();
  mockProgressSummary.mockReset();
  mockAchievementsList.mockReset();

  // Default: silent failures for optional endpoints
  mockProfileStats.mockRejectedValue(new Error("not needed"));
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
  mockProgressPersonalRecords.mockResolvedValue({ records: {} });
  mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Suite 1: Compare toggle visibility ──────────────────────────────────────

describe("ProgressScreen — compare toggle visibility", () => {
  it("renders the Compare toggle when the selected sport has ≥2 movement types", async () => {
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY] });
    mockProgressSports.mockResolvedValue({
      sports: [RUNNING_TWO_MOVEMENTS],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText("Compare")).toBeTruthy();
  });

  it("does not render the Compare toggle when the selected sport has <2 movement types", async () => {
    mockProgressList.mockResolvedValue({ entries: [] });
    mockProgressSports.mockResolvedValue({
      sports: [CYCLING_ONE_MOVEMENT],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText("Compare")).toBeNull();
  });

  it("does not render the Compare toggle when the sport has no movement types at all", async () => {
    mockProgressList.mockResolvedValue({ entries: [] });
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "swimming", count: 3, movementTypes: [] }],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText("Compare")).toBeNull();
  });
});

// ─── Suite 2: Entering compare mode ──────────────────────────────────────────

describe("ProgressScreen — entering compare mode", () => {
  it("shows the A hint after tapping the Compare toggle", async () => {
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY] });
    mockProgressSports.mockResolvedValue({ sports: [RUNNING_TWO_MOVEMENTS] });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Tap Compare to enter compare mode.
    const compareBtn = getByText("Compare");
    await act(async () => {
      fireEvent.press(compareBtn);
    });
    await flush();

    // Auto-selects first movement as A → hint shows "tap another to set B"
    expect(
      getByText(/A: Sprint — tap another to set B/i)
    ).toBeTruthy();
  });

  it("shows the B hint text after tapping a second movement pill", async () => {
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY] });
    mockProgressSports.mockResolvedValue({ sports: [RUNNING_TWO_MOVEMENTS] });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Enter compare mode — Sprint auto-selected as A.
    await act(async () => {
      fireEvent.press(getByText("Compare"));
    });
    await flush();

    // Tap "Long Distance" to assign it as B.
    await act(async () => {
      fireEvent.press(getByText("Long Distance"));
    });
    await flush();

    // Hint should now confirm both sides are set.
    expect(
      getByText(/Comparing Sprint vs Long Distance/i)
    ).toBeTruthy();
  });

  it("renders the A badge directly on the Sprint pill and the B badge on Long Distance", async () => {
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY] });
    mockProgressSports.mockResolvedValue({ sports: [RUNNING_TWO_MOVEMENTS] });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryAllByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Initially neither badge is visible.
    expect(queryAllByText("A").length).toBe(0);
    expect(queryAllByText("B").length).toBe(0);

    // Enter compare mode — Sprint auto-selected as A badge.
    await act(async () => {
      fireEvent.press(getByText("Compare"));
    });
    await flush();

    // "A" badge text node is now rendered inside the Sprint pill.
    expect(getAllByText("A").length).toBeGreaterThanOrEqual(1);
    // "B" badge is not yet visible.
    expect(queryAllByText("B").length).toBe(0);

    // Tap Long Distance to assign it as B.
    await act(async () => {
      fireEvent.press(getByText("Long Distance"));
    });
    await flush();

    // Both badge text nodes are now visible in their respective pills.
    expect(getAllByText("A").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("B").length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Suite 3: Personal Records header in compare mode ────────────────────────

describe("ProgressScreen — Personal Records header in compare mode", () => {
  it("shows 'X vs Y' in the section header when both A and B movement types are selected", async () => {
    mockProgressPersonalRecords.mockResolvedValue({
      records: {
        technique: { value: 85, date: "2026-05-01T00:00:00Z", movementType: null },
      },
    });
    mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY] });
    mockProgressSports.mockResolvedValue({ sports: [RUNNING_TWO_MOVEMENTS] });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Enter compare mode — Sprint auto-selected as A.
    await act(async () => {
      fireEvent.press(getByText("Compare"));
    });
    await flush();

    // Assign Long Distance as B.
    await act(async () => {
      fireEvent.press(getByText("Long Distance"));
    });
    await flush();

    // The section count should now read "Sprint vs Long Distance".
    expect(getByText("Sprint vs Long Distance")).toBeTruthy();
  });

  it("does not show 'X vs Y' header when only A is set (B not yet chosen)", async () => {
    mockProgressPersonalRecords.mockResolvedValue({
      records: {
        technique: { value: 85, date: "2026-05-01T00:00:00Z", movementType: null },
      },
    });
    mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY] });
    mockProgressSports.mockResolvedValue({ sports: [RUNNING_TWO_MOVEMENTS] });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Enter compare mode — Sprint auto-selected as A, B not yet set.
    await act(async () => {
      fireEvent.press(getByText("Compare"));
    });
    await flush();

    // "Sprint vs Long Distance" must not appear yet.
    expect(queryByText("Sprint vs Long Distance")).toBeNull();
  });
});

// ─── Suite 4: Compare mode resets on sport change ────────────────────────────

describe("ProgressScreen — compare mode resets on sport change", () => {
  it("clears compare mode when the athlete switches to a different sport", async () => {
    mockProgressPersonalRecords.mockResolvedValue({ records: {} });
    mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY] });
    mockProgressSports.mockResolvedValue(TWO_SPORTS_MIXED);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Enter compare mode on running (which has 2 movement types).
    await act(async () => {
      fireEvent.press(getByText("Compare"));
    });
    await flush();

    // Confirm we are in compare mode — A hint is present.
    expect(
      getByText(/A: Sprint — tap another to set B/i)
    ).toBeTruthy();

    // Switch to cycling — it has only 1 movement type, so the sub-filter row disappears.
    const [cyclingChip] = getAllByText("cycling");
    await act(async () => {
      fireEvent.press(cyclingChip!);
    });
    await flush();

    // The compare hint must be gone — compare mode was reset.
    expect(queryByText(/A: Sprint — tap another to set B/i)).toBeNull();
    expect(queryByText(/Comparing Sprint vs Long Distance/i)).toBeNull();
    // The Compare button itself disappears because cycling has <2 movement types.
    expect(queryByText("Compare")).toBeNull();
  });

  it("hides the 'Comparing X vs Y' hint after switching sports mid-compare", async () => {
    mockProgressPersonalRecords.mockResolvedValue({ records: {} });
    mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY] });
    mockProgressSports.mockResolvedValue(TWO_SPORTS_MIXED);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Enter compare mode and set both A and B.
    await act(async () => { fireEvent.press(getByText("Compare")); });
    await flush();
    await act(async () => { fireEvent.press(getByText("Long Distance")); });
    await flush();

    // Confirm both sides are set.
    expect(getByText(/Comparing Sprint vs Long Distance/i)).toBeTruthy();

    // Switch sport — compare state must clear.
    const [cyclingChip] = getAllByText("cycling");
    await act(async () => { fireEvent.press(cyclingChip!); });
    await flush();

    expect(queryByText(/Comparing Sprint vs Long Distance/i)).toBeNull();
  });
});
