/**
 * Rendered component tests: sport selector chips, movement type sub-filter,
 * AI summary card loading/resolved states, and personal records grid.
 *
 * Mocking strategy mirrors progressError.test.tsx:
 *   - useFocusEffect is captured so tests control when focus events arrive.
 *   - @/lib/api mocks let each test control individual API responses.
 *   - react-native-svg is stubbed to null so SVG rendering doesn't crash
 *     in the jsdom/RN test environment.
 *
 * Key assertions:
 *   1. Sport chips render for each sport when there are ≥2 sports.
 *   2. Pressing a sport chip filters the session log to that sport only.
 *   3. Selecting a sport chip triggers personal records to load for that sport.
 *   4. Movement type chips are hidden when a sport has ≤1 movement type.
 *   5. Movement type chips appear when a sport has ≥2 movement types.
 *   6. AI summary card shows "Generating insight…" while the summary loads.
 *   7. AI summary card shows the resolved summary text once the API responds.
 *   8. Personal records grid renders metric values returned by the API.
 *   9. Pressing a movement type chip filters the session log to matching entries.
 *  10. Pressing "All Movements" restores the full sport-filtered list.
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

// Import component AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_ACHIEVEMENTS = { achievements: [] };

const RUNNING_SPORT = { sport: "running", count: 2, movementTypes: [] };
const SWIMMING_SPORT = { sport: "swimming", count: 1, movementTypes: [] };
const TWO_SPORTS = { sports: [RUNNING_SPORT, SWIMMING_SPORT] };

const RUNNING_ENTRY_1 = {
  id: "r1",
  title: "Morning Run",
  sport: "running",
  movementType: null,
  date: "2026-06-10T00:00:00Z",
  overallScore: 74,
};
const RUNNING_ENTRY_2 = {
  id: "r2",
  title: "Interval Session",
  sport: "running",
  movementType: null,
  date: "2026-06-15T00:00:00Z",
  overallScore: 78,
};
const SWIMMING_ENTRY = {
  id: "s1",
  title: "Pool Practice",
  sport: "swimming",
  movementType: null,
  date: "2026-06-12T00:00:00Z",
  overallScore: 81,
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

  // Default: silent failures for stats and trends (caught internally)
  mockProfileStats.mockRejectedValue(new Error("not needed"));
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));

  // Default: no personal records
  mockProgressPersonalRecords.mockResolvedValue({ records: {} });
  // Default: empty summary
  mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Suite 1: Sport selector chips ───────────────────────────────────────────

describe("ProgressScreen — sport selector chips", () => {
  it("renders a chip for each sport when there are ≥2 sports", async () => {
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1, SWIMMING_ENTRY] });
    mockProgressSports.mockResolvedValue(TWO_SPORTS);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Each sport name appears as a chip label (textTransform: capitalize in RN
    // does not change the JS string, so the text node still holds the lowercase value).
    expect(getAllByText("running").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("swimming").length).toBeGreaterThanOrEqual(1);
  });

  it("filters the session log to the selected sport after pressing its chip", async () => {
    mockProgressList.mockResolvedValue({
      entries: [RUNNING_ENTRY_1, RUNNING_ENTRY_2, SWIMMING_ENTRY],
    });
    mockProgressSports.mockResolvedValue(TWO_SPORTS);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Initially running is auto-selected — running entries should be visible.
    expect(getByText("Morning Run")).toBeTruthy();
    expect(getByText("Interval Session")).toBeTruthy();
    expect(queryByText("Pool Practice")).toBeNull();

    // Press the swimming chip.
    const [swimmingChip] = getAllByText("swimming");
    await act(async () => {
      fireEvent.press(swimmingChip!);
    });
    await flush();

    // Now only the swimming entry should appear in the session log.
    expect(getByText("Pool Practice")).toBeTruthy();
    expect(queryByText("Morning Run")).toBeNull();
    expect(queryByText("Interval Session")).toBeNull();
  });

  it("calls personalRecords with the newly selected sport after pressing its chip", async () => {
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1, SWIMMING_ENTRY] });
    mockProgressSports.mockResolvedValue(TWO_SPORTS);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Clear call history from the initial auto-selection of "running".
    mockProgressPersonalRecords.mockClear();

    // Press swimming chip.
    const [swimmingChip] = getAllByText("swimming");
    await act(async () => {
      fireEvent.press(swimmingChip!);
    });
    await flush();

    expect(mockProgressPersonalRecords).toHaveBeenCalledWith("swimming");
  });
});

// ─── Suite 2: Movement type sub-filter chips ──────────────────────────────────

describe("ProgressScreen — movement type sub-filter", () => {
  it("does not render movement type chips when the sport has only one movement type", async () => {
    const sportsWithOneMovement = {
      sports: [
        { sport: "running", count: 1, movementTypes: ["Sprint"] },
        { sport: "swimming", count: 1, movementTypes: [] },
      ],
    };
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue(sportsWithOneMovement);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // The sub-filter only appears when movementTypes.length >= 2.
    expect(queryByText("Sprint")).toBeNull();
    expect(queryByText("All Movements")).toBeNull();
  });

  it("renders movement type chips when the selected sport has ≥2 movement types", async () => {
    const sportsWithTwoMovements = {
      sports: [
        { sport: "running", count: 3, movementTypes: ["Sprint", "Long Distance"] },
        { sport: "swimming", count: 1, movementTypes: [] },
      ],
    };
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue(sportsWithTwoMovements);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // "All Movements" catch-all chip plus each named type should be visible.
    expect(getByText("All Movements")).toBeTruthy();
    expect(getByText("Sprint")).toBeTruthy();
    expect(getByText("Long Distance")).toBeTruthy();
  });

  it("hides movement type chips when a sport with no movement types is selected", async () => {
    const mixedSports = {
      sports: [
        { sport: "running", count: 3, movementTypes: ["Sprint", "Long Distance"] },
        { sport: "swimming", count: 2, movementTypes: [] },
      ],
    };
    mockProgressList.mockResolvedValue({
      entries: [RUNNING_ENTRY_1, SWIMMING_ENTRY],
    });
    mockProgressSports.mockResolvedValue(mixedSports);
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText, queryByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Running is auto-selected — movement chips should be visible.
    expect(getByText("All Movements")).toBeTruthy();

    // Switch to swimming which has no movement types.
    const [swimmingChip] = getAllByText("swimming");
    await act(async () => {
      fireEvent.press(swimmingChip!);
    });
    await flush();

    // Movement chips should disappear.
    expect(queryByText("All Movements")).toBeNull();
    expect(queryByText("Sprint")).toBeNull();
  });
});

// ─── Suite 3: AI summary card ─────────────────────────────────────────────────

describe("ProgressScreen — AI summary card", () => {
  it("shows 'Generating insight…' while the summary is loading", async () => {
    // Use a never-resolving promise so the loading state persists after flush.
    mockProgressSummary.mockReturnValue(new Promise(() => {}));
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "running", count: 1, movementTypes: [] }],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText("Generating insight…")).toBeTruthy();
  });

  it("shows the summary text once the API resolves", async () => {
    const SUMMARY_TEXT = "Your running technique shows steady improvement across all sessions.";
    mockProgressSummary.mockResolvedValue({ summary: SUMMARY_TEXT, cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "running", count: 1, movementTypes: [] }],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText(SUMMARY_TEXT)).toBeTruthy();
    // "AI Progress Insight" label should also be present.
    expect(getByText("AI Progress Insight")).toBeTruthy();
  });

  it("does not render the AI summary card when no sport is selected", async () => {
    // Provide only 1 sport so the sport selector doesn't render but the
    // auto-selection still fires — however we test: when sports list is empty
    // no sport is selected so the card is hidden.
    mockProgressList.mockResolvedValue({ entries: [] });
    mockProgressSports.mockResolvedValue({ sports: [] });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText("AI Progress Insight")).toBeNull();
    expect(queryByText("Generating insight…")).toBeNull();
  });

  it("hides the AI summary card when the summary API rejects", async () => {
    // When summary rejects: aiSummary stays null, aiSummaryLoading goes false.
    // Condition: selectedSport && (aiSummary || aiSummaryLoading) → false → card hidden.
    mockProgressSummary.mockRejectedValue(new Error("Summary unavailable"));
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "running", count: 1, movementTypes: [] }],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText("AI Progress Insight")).toBeNull();
    expect(queryByText("Generating insight…")).toBeNull();
  });

  it("passes the selected movement type to the summary API", async () => {
    mockProgressSummary.mockResolvedValue({ summary: "Good work.", cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "running", count: 2, movementTypes: ["Sprint", "Long Distance"] }],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Clear after initial auto-selection.
    mockProgressSummary.mockClear();
    mockProgressSummary.mockResolvedValue({ summary: "Sprint insight.", cached: false });

    // Press the "Sprint" movement type chip.
    const sprintChip = getByText("Sprint");
    await act(async () => {
      fireEvent.press(sprintChip);
    });
    await flush();

    // summary should have been called with the sport + movement type.
    expect(mockProgressSummary).toHaveBeenCalledWith("running", "Sprint");
  });
});

// ─── Suite 4: Personal records grid ──────────────────────────────────────────

describe("ProgressScreen — personal records grid", () => {
  it("renders the Personal Records section title when records exist", async () => {
    mockProgressPersonalRecords.mockResolvedValue({
      records: {
        technique: { value: 88, date: "2026-05-20T00:00:00Z", movementType: null },
      },
    });
    mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "running", count: 1, movementTypes: [] }],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText("Personal Records")).toBeTruthy();
  });

  it("renders the best score value for each returned metric", async () => {
    // Running's valid metric keys come from constants/sportConfig.ts → SPORT_CONFIGS.running.metrics:
    //   ["overall", "technique", "speed", "consistency", "mobility"]
    // If that list changes, update the keys used below to match.
    // "power" is NOT in the running config — use "consistency" instead.
    mockProgressPersonalRecords.mockResolvedValue({
      records: {
        technique:   { value: 91, date: "2026-05-10T00:00:00Z", movementType: null },
        consistency: { value: 76, date: "2026-04-28T00:00:00Z", movementType: null },
      },
    });
    mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "running", count: 1, movementTypes: [] }],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // The score is rendered via Math.round(rec.value).
    expect(getByText("91")).toBeTruthy();
    expect(getByText("76")).toBeTruthy();
  });

  it("does not render Personal Records when the selected sport has no records", async () => {
    mockProgressPersonalRecords.mockResolvedValue({ records: {} });
    mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
    mockProgressList.mockResolvedValue({ entries: [RUNNING_ENTRY_1] });
    mockProgressSports.mockResolvedValue({
      sports: [{ sport: "running", count: 1, movementTypes: [] }],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText("Personal Records")).toBeNull();
  });
});

// ─── Suite 5: Movement type chip filtering of the session log ─────────────────

describe("ProgressScreen — movement type chip filters session log", () => {
  const RUNNING_WITH_TWO_MOVEMENTS = {
    sports: [
      { sport: "running", count: 3, movementTypes: ["Sprint", "Long Distance"] },
    ],
  };

  const SPRINT_ENTRY_1 = {
    id: "sp1",
    title: "Sprint Drills A",
    sport: "running",
    movementType: "Sprint",
    date: "2026-06-01T00:00:00Z",
    overallScore: 80,
  };
  const SPRINT_ENTRY_2 = {
    id: "sp2",
    title: "Sprint Drills B",
    sport: "running",
    movementType: "Sprint",
    date: "2026-06-08T00:00:00Z",
    overallScore: 83,
  };
  const LONG_DISTANCE_ENTRY = {
    id: "ld1",
    title: "Long Distance Run",
    sport: "running",
    movementType: "Long Distance",
    date: "2026-06-05T00:00:00Z",
    overallScore: 77,
  };

  beforeEach(() => {
    mockProgressSports.mockResolvedValue(RUNNING_WITH_TWO_MOVEMENTS);
    mockProgressList.mockResolvedValue({
      entries: [SPRINT_ENTRY_1, SPRINT_ENTRY_2, LONG_DISTANCE_ENTRY],
    });
    mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
    mockProgressSummary.mockResolvedValue({ summary: "", cached: false });
  });

  it("shows all sport entries when 'All Movements' is the default selection", async () => {
    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // All three entries should be visible before any chip is tapped.
    expect(getByText("Sprint Drills A")).toBeTruthy();
    expect(getByText("Sprint Drills B")).toBeTruthy();
    expect(getByText("Long Distance Run")).toBeTruthy();
  });

  it("filters session log to only Sprint entries when the Sprint chip is tapped", async () => {
    const { getByText, queryByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // "Sprint" appears as both the chip label and in each sprint entry's movement badge.
    // The chip is always the first occurrence in render order (chips render above the log).
    const [sprintChip] = getAllByText("Sprint");
    await act(async () => {
      fireEvent.press(sprintChip!);
    });
    await flush();

    // Only sprint entries should appear.
    expect(getByText("Sprint Drills A")).toBeTruthy();
    expect(getByText("Sprint Drills B")).toBeTruthy();
    expect(queryByText("Long Distance Run")).toBeNull();
  });

  it("filters session log to only Long Distance entries when that chip is tapped", async () => {
    const { getByText, queryByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // "Long Distance" also appears in each entry's movement badge, so take the first.
    const [longDistanceChip] = getAllByText("Long Distance");
    await act(async () => {
      fireEvent.press(longDistanceChip!);
    });
    await flush();

    // Only the long distance entry should appear.
    expect(getByText("Long Distance Run")).toBeTruthy();
    expect(queryByText("Sprint Drills A")).toBeNull();
    expect(queryByText("Sprint Drills B")).toBeNull();
  });

  it("restores the full list when 'All Movements' is tapped after a chip filter", async () => {
    const { getByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // First narrow down to Sprint.
    const [sprintChip] = getAllByText("Sprint");
    await act(async () => {
      fireEvent.press(sprintChip!);
    });
    await flush();

    // Now reset via "All Movements".
    const allMovementsChip = getByText("All Movements");
    await act(async () => {
      fireEvent.press(allMovementsChip);
    });
    await flush();

    // All three entries should be visible again.
    expect(getByText("Sprint Drills A")).toBeTruthy();
    expect(getByText("Sprint Drills B")).toBeTruthy();
    expect(getByText("Long Distance Run")).toBeTruthy();
  });
});
