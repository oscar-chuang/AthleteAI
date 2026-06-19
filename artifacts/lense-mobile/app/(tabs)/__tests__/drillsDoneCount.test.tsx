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
});
