/**
 * Unit tests for the loadDrillsDone function in the Progress tab.
 *
 * The function scans AsyncStorage for keys beginning with "drill_done_",
 * parses each as a JSON array, sums the array lengths, and stores the total
 * in drillsDoneCount state — which controls whether the drills card renders.
 *
 * Mocking strategy mirrors progressError.test.tsx:
 *   - useFocusEffect is captured so tests fire it manually.
 *   - @react-native-async-storage/async-storage is overridden inline so each
 *     test can program getAllKeys / multiGet independently.
 *   - @/lib/api, react-native-svg, and other heavy dependencies are stubbed.
 *
 * Covered scenarios:
 *   1. Multiple analyses each with drills done — counts are summed correctly.
 *   2. One malformed JSON value — does not crash; valid keys are still counted.
 *   3. No drill_done_ keys present — the drills card is not rendered at all.
 *   4. getAllKeys returns an empty list — same: card absent.
 *   5. Exactly one drill completed — singular label is used.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockProgressList = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats = jest.fn();
const mockJointTrendsGet = jest.fn();
const mockAnalysesGet = jest.fn();

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
  analyses: {
    get: (...args: any[]) => mockAnalysesGet(...args),
  },
}));

import ProgressScreen from "../progress";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DRILLS_LABEL_PLURAL   = "Drills completed · all sessions";
const DRILLS_LABEL_SINGULAR = "Drill completed · all sessions";

const EMPTY_PROGRESS     = { entries: [] };
const EMPTY_ACHIEVEMENTS = { achievements: [] };

async function flush(rounds = 5) {
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
  mockProfileStats.mockRejectedValue(new Error("not needed"));
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
  mockAnalysesGet.mockRejectedValue(new Error("not found"));
  (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
  (AsyncStorage.multiGet  as jest.Mock).mockResolvedValue([]);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Progress — loadDrillsDone", () => {
  // ── Test 1 ────────────────────────────────────────────────────────────────

  it("sums drill counts correctly across multiple analysis sessions", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "drill_done_analysis-abc",
      "drill_done_analysis-def",
      "unrelated_key",
    ]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ["drill_done_analysis-abc", JSON.stringify(["drill1", "drill2", "drill3"])],
      ["drill_done_analysis-def", JSON.stringify(["drill4", "drill5"])],
    ]);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText("5")).toBeTruthy();
    expect(getByText(DRILLS_LABEL_PLURAL)).toBeTruthy();
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────

  it("skips malformed JSON values without crashing and counts the valid ones", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "drill_done_analysis-valid",
      "drill_done_analysis-corrupt",
    ]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ["drill_done_analysis-valid",  JSON.stringify(["drillA", "drillB"])],
      ["drill_done_analysis-corrupt", "not valid JSON {{{"],
    ]);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText("2")).toBeTruthy();
    expect(getByText(DRILLS_LABEL_PLURAL)).toBeTruthy();
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────

  it("does not render the drills card when no drill_done_ keys are present", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "auth_token",
      "theme_preference",
    ]);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText(DRILLS_LABEL_PLURAL)).toBeNull();
    expect(queryByText(DRILLS_LABEL_SINGULAR)).toBeNull();
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────

  it("does not render the drills card when getAllKeys returns an empty list", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText(DRILLS_LABEL_PLURAL)).toBeNull();
    expect(queryByText(DRILLS_LABEL_SINGULAR)).toBeNull();
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────

  it("uses the singular label when exactly one drill is completed across all sessions", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "drill_done_analysis-solo",
    ]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ["drill_done_analysis-solo", JSON.stringify(["drillX"])],
    ]);

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText("1")).toBeTruthy();
    expect(getByText(DRILLS_LABEL_SINGULAR)).toBeTruthy();
  });

  // ── Test 6 ────────────────────────────────────────────────────────────────

  it("shows breakdown when at least one analysis fetch succeeds even if others fail", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "drill_done_analysis-ok",
      "drill_done_analysis-fail",
    ]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ["drill_done_analysis-ok",   JSON.stringify(["drill-c1", "drill-p1"])],
      ["drill_done_analysis-fail", JSON.stringify(["drill-c2"])],
    ]);

    // Only the first analysis fetch succeeds; the second rejects
    mockAnalysesGet
      .mockResolvedValueOnce({
        analysis: { id: "analysis-ok" },
        tips: [
          { id: "drill-c1", tipType: "injury" },
          { id: "drill-p1", tipType: "performance" },
        ],
        injuryRisks: [],
      })
      .mockRejectedValueOnce(new Error("not found"));

    const { getByText, getAllByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Total should include drills from both analyses (3)
    expect(getByText("3")).toBeTruthy();
    expect(getByText(DRILLS_LABEL_PLURAL)).toBeTruthy();
    // Breakdown must be visible — "Corrective" and "Performance" labels appear
    expect(getByText("Corrective")).toBeTruthy();
    expect(getByText("Performance")).toBeTruthy();
    // Corrective=1 and Performance=1 — both counts should appear
    expect(getAllByText("1").length).toBeGreaterThanOrEqual(2);
  });

  // ── Test 7 ────────────────────────────────────────────────────────────────

  it("shows an unclassified footnote when some fetches fail and the counts don't add up to the total", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "drill_done_analysis-ok",
      "drill_done_analysis-fail",
    ]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ["drill_done_analysis-ok",   JSON.stringify(["drill-c1", "drill-p1"])],
      ["drill_done_analysis-fail", JSON.stringify(["drill-unknown"])],
    ]);

    // Only the first analysis fetch succeeds — the second drill can't be classified
    mockAnalysesGet
      .mockResolvedValueOnce({
        analysis: { id: "analysis-ok" },
        tips: [
          { id: "drill-c1", tipType: "injury" },
          { id: "drill-p1", tipType: "performance" },
        ],
        injuryRisks: [],
      })
      .mockRejectedValueOnce(new Error("not found"));

    const { getByText } = render(<ProgressScreen />);
    await simulateFocus();

    // Total = 3; classified = 2 (corrective + performance from analysis-ok);
    // one drill (from analysis-fail) can't be attributed — partial-failure
    // branch fires, showing the caveat note instead of a raw count.
    expect(getByText("3")).toBeTruthy();
    expect(getByText("Some sessions couldn\u2019t be classified")).toBeTruthy();
  });

  // ── Test 8 ────────────────────────────────────────────────────────────────

  it("hides breakdown when all analysis fetches fail", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "drill_done_analysis-a",
      "drill_done_analysis-b",
    ]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ["drill_done_analysis-a", JSON.stringify(["drill1"])],
      ["drill_done_analysis-b", JSON.stringify(["drill2"])],
    ]);

    // All fetches reject — mockAnalysesGet is already set to reject in beforeEach

    const { getByText, queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(getByText("2")).toBeTruthy();
    expect(getByText(DRILLS_LABEL_PLURAL)).toBeTruthy();
    // Breakdown rows should not appear (Corrective / Performance labels absent)
    expect(queryByText("Corrective")).toBeNull();
    expect(queryByText("Performance")).toBeNull();
  });
});
