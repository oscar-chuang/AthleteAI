/**
 * Unit tests: the inline weekly goal picker on the Home screen.
 *
 * The picker is a modal sheet triggered by tapping the "Goal: X sessions/week"
 * label in the "This Week" card.  Tapping an option calls updateProfile with
 * the new weeklyGoal and the label updates immediately via an optimistic local
 * state update (localWeeklyGoal) without any navigation.
 *
 * Mocking strategy mirrors progressError.test.tsx / chatSportChange.test.tsx:
 *   - useFocusEffect is captured so tests fire it manually.
 *   - @/lib/authContext is backed by mutable module-level vars so each test
 *     can control profile.weeklyGoal and inspect updateProfile calls.
 *   - @/lib/api stubs return minimal fixtures — just enough for allAnalyses to
 *     be non-empty so the "This Week" card is rendered.
 *   - Heavy native dependencies (SVG, Haptics, Sharing, ShareCard, etc.) are
 *     stubbed to null / no-op so the component mounts in jsdom.
 *
 * Covered scenarios:
 *   1. Tapping a goal option calls updateProfile with { weeklyGoal: <n> }.
 *   2. The goal label updates immediately without navigation (optimistic).
 *   3. Tapping the already-selected value does NOT call updateProfile.
 *   4. If updateProfile rejects, the label reverts to the previous value.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mutable state ──────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;
let mockUpdateProfile: jest.Mock;
let mockProfile: Record<string, unknown>;

const mockAnalysesList    = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats    = jest.fn();
const mockJointTrendsGet  = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: () => (() => void) | void) => { mockFocusCallback = cb; },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: () => null,
  Svg: () => null, Line: () => null, Path: () => null,
  Polyline: () => null, Circle: () => null, Text: () => null,
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

jest.mock("expo-haptics", () => ({
  impactAsync:        jest.fn(async () => {}),
  notificationAsync:  jest.fn(async () => {}),
  ImpactFeedbackStyle:   { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync:       jest.fn(async () => {}),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#0a0a0a", foreground: "#f5f5f5", card: "#1a1a1a",
    border: "#2a2a2a", primary: "#6c63ff", mutedForeground: "#888888",
    muted: "#333333", success: "#22c55e", warning: "#f59e0b",
    destructive: "#ff4d6d", radius: 12,
  }),
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Test Athlete", email: "test@test.com" },
    profile: mockProfile,
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  }),
  useTier: () => "free",
}));

jest.mock("@/lib/api", () => ({
  analyses:    { list: (...args: any[]) => mockAnalysesList(...args) },
  achievements:{ list: (...args: any[]) => mockAchievementsList(...args) },
  profile:     { stats: (...args: any[]) => mockProfileStats(...args) },
  jointTrends: { get: (...args: any[]) => mockJointTrendsGet(...args) },
}));

jest.mock("@/app/profile-settings", () => ({
  AvatarDisplay: () => null,
}));

jest.mock("@/components/JointHistorySheet", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/ConfettiBurst", () => ({
  ConfettiBurst: () => null,
}));

jest.mock("@/utils/confettiGate", () => ({
  checkConfettiGate: jest.fn(async () => false),
}));

jest.mock("@/lib/sessionDelta", () => ({
  buildDeltaMap: jest.fn(() => new Map()),
}));

jest.mock("@/components/ShareCard", () => {
  const ReactLib = require("react");
  return {
    __esModule: true,
    default: ReactLib.forwardRef(() => null),
  };
});

jest.mock("@/components/WeekDotRow", () => ({
  WeekDotRow: () => null,
}));

// Import AFTER all mocks are registered.
import HomeScreen from "../index";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ONE_ANALYSIS = {
  id: "analysis-1",
  title: "Morning Run",
  sport: "running",
  status: "complete",
  uploadedAt: new Date().toISOString(),
  overallScore: 72,
  thumbnailUrl: null,
};

const EMPTY_ACHIEVEMENTS = { achievements: [] };

const BASE_STATS = {
  thisWeekCount: 1,
  lastWeekCount: 0,
  streak: 0,
  totalAnalyses: 1,
  scoreDelta: null,
  personalBests: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

async function simulateFocus() {
  await act(async () => { mockFocusCallback?.(); });
  await flush();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockFocusCallback = null;
  mockUpdateProfile = jest.fn(async () => {});
  mockProfile = {
    weeklyGoal: 3,
    name: "Test Athlete",
    level: "intermediate",
    sport: "running",
    avatarUrl: null,
    trainingDays: [0, 1, 2, 3, 4, 5, 6],
    weeklyProgress: 1,
  };
  mockAnalysesList.mockResolvedValue({ analyses: [ONE_ANALYSIS] });
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
  mockProfileStats.mockResolvedValue(BASE_STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — weekly goal picker", () => {
  // ── Test 1 ────────────────────────────────────────────────────────────────

  it("calls updateProfile with the correct weeklyGoal when a new option is tapped", async () => {
    const { getByText } = render(<HomeScreen />);
    await simulateFocus();

    // Open the picker sheet by tapping the goal label.
    fireEvent.press(getByText("Goal: 3 sessions/week"));

    // Tap the goal option for 5 sessions.
    fireEvent.press(getByText("5"));
    await flush();

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfile).toHaveBeenCalledWith({ weeklyGoal: 5 });
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────

  it("updates the home card in place immediately without navigation", async () => {
    const { getByText } = render(<HomeScreen />);
    await simulateFocus();

    // Baseline: label shows the current goal.
    expect(getByText("Goal: 3 sessions/week")).toBeTruthy();

    // Open picker, select 5.
    fireEvent.press(getByText("Goal: 3 sessions/week"));
    fireEvent.press(getByText("5"));
    await flush();

    // After a successful save the component shows the "Goal saved!" confirmation
    // badge (via an Animated fade-in/out) instead of the static label.
    // useNativeDriver animations don't resolve callbacks in Jest, so the badge
    // remains visible — asserting it confirms the success path ran and the card
    // updated without any navigation.
    expect(getByText("Goal saved!")).toBeTruthy();

    // The Sessions completed counter must also reflect the new goal (1 / 5),
    // proving the weeklyGoal update propagated into the card immediately.
    expect(getByText("1 / 5")).toBeTruthy();
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────

  it("does NOT call updateProfile when the already-selected value is tapped", async () => {
    const { getByText } = render(<HomeScreen />);
    await simulateFocus();

    // Open picker then tap the current value (3).
    fireEvent.press(getByText("Goal: 3 sessions/week"));
    // "3" is the isolated Text inside the goal button for n=3 in the picker.
    fireEvent.press(getByText("3"));
    await flush();

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────

  it("reverts the label to the previous value when updateProfile rejects", async () => {
    mockUpdateProfile = jest.fn(async () => {
      throw new Error("Server error");
    });

    const { getByText } = render(<HomeScreen />);
    await simulateFocus();

    // Open picker, select 5.
    fireEvent.press(getByText("Goal: 3 sessions/week"));
    fireEvent.press(getByText("5"));
    await flush();

    // After the rejection, localWeeklyGoal is rolled back to 3.
    expect(getByText("Goal: 3 sessions/week")).toBeTruthy();
    // And updateProfile was still called (the attempt happened).
    expect(mockUpdateProfile).toHaveBeenCalledWith({ weeklyGoal: 5 });
  });
});
