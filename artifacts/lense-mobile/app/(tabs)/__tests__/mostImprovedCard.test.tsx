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
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

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
    sports: jest.fn().mockResolvedValue({ sports: [] }),
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

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
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

    // Card header must mention the winning joint and its delta.
    expect(getByText("Left Knee +8°")).toBeTruthy();
    // The 'Most improved' subtitle must be present.
    expect(getByText(MOST_IMPROVED_LABEL)).toBeTruthy();

    // The other joints must NOT appear in a 'Most improved' context.
    // (They may appear elsewhere — asserting just the card label text is absent
    //  is sufficient: neither runner-up appears as "Joint +Xdeg".)
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

    expect(getByText("Right Knee +6°")).toBeTruthy();
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

    expect(queryByText(MOST_IMPROVED_LABEL)).toBeNull();
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────

  it("hides the card when the jointTrends API call fails", async () => {
    // mockJointTrendsGet already rejects by default in beforeEach.

    const { queryByText } = render(<ProgressScreen />);
    await simulateFocus();

    expect(queryByText(MOST_IMPROVED_LABEL)).toBeNull();
  });
});
