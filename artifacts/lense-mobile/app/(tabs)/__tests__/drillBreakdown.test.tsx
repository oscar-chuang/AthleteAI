/**
 * Unit tests: Corrective / Performance drill-type breakdown on the Progress tab.
 *
 * The breakdown is computed in loadDrillsDone():
 *  1. AsyncStorage.getAllKeys() returns all stored keys; those starting with
 *     "drill_done_" identify analyses with completed drills.
 *  2. AsyncStorage.multiGet() fetches the completed tip-ID arrays.
 *  3. analyses.get() is called for each analysis so tips can be classified.
 *  4. Tips with tipType === "injury" count as Corrective; all others as Performance.
 *
 * Mocking strategy mirrors progressError.test.tsx and mostImprovedCard.test.tsx:
 *  - useFocusEffect is captured so tests fire it manually.
 *  - @react-native-async-storage/async-storage is mocked with per-test control
 *    over getAllKeys and multiGet.
 *  - @/lib/api is mocked; mockAnalysesGet is overridable per test.
 *  - react-native-svg is stubbed to null (crashes in jsdom otherwise).
 *
 * Scenarios covered:
 *  1. Mix of injury and performance tips → correct Corrective and Performance
 *     counts appear as sub-labels beneath the total.
 *  2. analyses.get() rejects for every analysis → total drill count is shown
 *     but neither "Corrective" nor "Performance" sub-label appears.
 *  3. AsyncStorage returns no drill_done_ keys → the entire drills section is
 *     hidden (drillsDoneCount === 0), so neither sub-label appears.
 *  4. Partial failure: one analysis resolves, one rejects → breakdown is shown
 *     with the partial counts and a "Some sessions couldn't be classified" note.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList = jest.fn();
const mockAchievementsList = jest.fn();
const mockAnalysesGet = jest.fn();
const mockAsyncStorageGetAllKeys = jest.fn();
const mockAsyncStorageMultiGet = jest.fn();

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
    getAllKeys: (...args: any[]) => mockAsyncStorageGetAllKeys(...args),
    multiGet: (...args: any[]) => mockAsyncStorageMultiGet(...args),
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
    sports:          jest.fn().mockResolvedValue({ sports: [] }),
    personalRecords: jest.fn().mockResolvedValue({ records: {} }),
    summary:         jest.fn().mockResolvedValue({ summary: "" }),
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
    get: jest.fn().mockResolvedValue({ history: [] }),
  },
  analyses: {
    get: (...args: any[]) => mockAnalysesGet(...args),
  },
}));

// Import component AFTER all mocks are set up.
import ProgressScreen from "../progress";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const EMPTY_PROGRESS = { entries: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
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
  mockFocusCallback = null;
  mockProgressList.mockResolvedValue(EMPTY_PROGRESS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
  // Default: no drill keys
  mockAsyncStorageGetAllKeys.mockResolvedValue([]);
  mockAsyncStorageMultiGet.mockResolvedValue([]);
  mockAnalysesGet.mockResolvedValue({ analysis: {}, tips: [], injuryRisks: [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressScreen — drill breakdown (Corrective / Performance)", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("shows correct Corrective and Performance counts for a mix of tip types", async () => {
    // Two analyses: first has 3 corrective + 2 performance, second has 1 corrective.
    // Total completed drills: 6  |  Corrective: 4  |  Performance: 2
    const analysis1CompletedIds = ["t1", "t2", "t3", "t4", "t5"];
    const analysis2CompletedIds = ["t6"];

    mockAsyncStorageGetAllKeys.mockResolvedValue([
      "drill_done_analysis1",
      "drill_done_analysis2",
    ]);
    mockAsyncStorageMultiGet.mockResolvedValue([
      ["drill_done_analysis1", JSON.stringify(analysis1CompletedIds)],
      ["drill_done_analysis2", JSON.stringify(analysis2CompletedIds)],
    ]);

    mockAnalysesGet.mockImplementation(async (id: string) => {
      if (id === "analysis1") {
        return {
          analysis: {},
          injuryRisks: [],
          tips: [
            { id: "t1", tipType: "injury",      text: "Corrective tip 1" },
            { id: "t2", tipType: "injury",      text: "Corrective tip 2" },
            { id: "t3", tipType: "injury",      text: "Corrective tip 3" },
            { id: "t4", tipType: "performance", text: "Performance tip 1" },
            { id: "t5", tipType: "performance", text: "Performance tip 2" },
          ],
        };
      }
      // analysis2: 1 corrective tip completed
      return {
        analysis: {},
        injuryRisks: [],
        tips: [
          { id: "t6", tipType: "injury", text: "Corrective tip from analysis 2" },
        ],
      };
    });

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Total drills section must be visible.
    expect(getByText("6")).toBeTruthy();
    expect(getByText("Drills completed · all sessions")).toBeTruthy();

    // Sub-labels must be present.
    expect(getByText("Corrective")).toBeTruthy();
    expect(getByText("Performance")).toBeTruthy();

    // Counts must be correct: 4 corrective (3+1), 2 performance.
    expect(getByText("4")).toBeTruthy();
    expect(getByText("2")).toBeTruthy();

    // Sanity: the breakdown section is rendered (not just the total row).
    expect(queryByText("Corrective")).not.toBeNull();
    expect(queryByText("Performance")).not.toBeNull();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("shows only the total count when analyses.get() rejects for every analysis", async () => {
    // One analysis with 3 completed drill IDs.
    mockAsyncStorageGetAllKeys.mockResolvedValue(["drill_done_analysis1"]);
    mockAsyncStorageMultiGet.mockResolvedValue([
      ["drill_done_analysis1", JSON.stringify(["tip-a", "tip-b", "tip-c"])],
    ]);

    // analyses.get() rejects → Promise.allSettled catches it; corrective + performance = 0
    // → breakdown state stays null → sub-labels not rendered.
    mockAnalysesGet.mockRejectedValue(new Error("Network error"));

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Total count must still appear.
    expect(getByText("3")).toBeTruthy();
    expect(getByText("Drills completed · all sessions")).toBeTruthy();

    // Sub-labels must be absent.
    expect(queryByText("Corrective")).toBeNull();
    expect(queryByText("Performance")).toBeNull();
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("shows breakdown with a caveat note when only some analyses fail (partial failure)", async () => {
    // Two analyses: analysis1 resolves (1 corrective), analysis2 rejects.
    // Expected: breakdown is shown with partial counts + caveat note.
    mockAsyncStorageGetAllKeys.mockResolvedValue([
      "drill_done_analysis1",
      "drill_done_analysis2",
    ]);
    mockAsyncStorageMultiGet.mockResolvedValue([
      ["drill_done_analysis1", JSON.stringify(["tip-ok"])],
      ["drill_done_analysis2", JSON.stringify(["tip-fail"])],
    ]);

    mockAnalysesGet.mockImplementation(async (id: string) => {
      if (id === "analysis1") {
        return {
          analysis: {},
          injuryRisks: [],
          tips: [{ id: "tip-ok", tipType: "injury", text: "Corrective tip" }],
        };
      }
      throw new Error("Network error");
    });

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Total count reflects both analyses' completed tips.
    expect(getByText("2")).toBeTruthy();
    expect(getByText("Drills completed · all sessions")).toBeTruthy();

    // Breakdown is still shown (at least one succeeded).
    expect(getByText("Corrective")).toBeTruthy();
    expect(getByText("Performance")).toBeTruthy();

    // Caveat note must be visible (rendered with a right-single-quote \u2019).
    const caveatNote = "Some sessions couldn\u2019t be classified";
    expect(getByText(caveatNote)).toBeTruthy();

    // Sanity: queryByText also finds it (ensures we're testing render, not just API calls).
    expect(queryByText(caveatNote)).not.toBeNull();
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("hides the entire drills section when AsyncStorage has no drill keys", async () => {
    // Default beforeEach already sets getAllKeys → [] and multiGet → [].
    // drillsDoneCount will be 0, so the section is not rendered at all.

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText("Corrective")).toBeNull();
    expect(queryByText("Performance")).toBeNull();
    expect(queryByText("Drills completed · all sessions")).toBeNull();
  });
});
