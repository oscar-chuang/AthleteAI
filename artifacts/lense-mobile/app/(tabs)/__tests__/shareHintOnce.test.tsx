/**
 * Unit tests confirming the 'Tap to share' hint appears at most once per user.
 *
 * The hint is gated by the AsyncStorage key `share_hint_shown`.  loadData sets
 * showShareHint=true only when the weekly goal is reached AND the key is absent.
 * dismissShareHint writes the key so subsequent loads always skip the hint.
 *
 * Mocking strategy mirrors drillsDoneCount.test.tsx:
 *   - useFocusEffect is captured so tests fire it manually.
 *   - @react-native-async-storage/async-storage is overridden so each test can
 *     program getItem/setItem independently.
 *   - All heavy UI dependencies (SVG, Haptics, expo-sharing, ShareCard…) are
 *     stubbed to null so the component renders without native modules.
 *
 * Covered scenarios:
 *   1. Key absent + goal reached  → hint is shown ("Tap to share 🎉" in tree).
 *   2. Key present + goal reached → hint is NOT shown.
 *   3. dismissShareHint called    → AsyncStorage.setItem("share_hint_shown", "true").
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

const mockAnalysesList    = jest.fn();
const mockAchievementsList = jest.fn();
const mockProfileStats    = jest.fn();
const mockJointTrendsGet  = jest.fn();

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
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    getAllKeys:  jest.fn(async () => []),
    multiGet:   jest.fn(async () => []),
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

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@test.com" },
    profile: { weeklyGoal: 3, weeklyProgress: 3, sport: "basketball", trainingDays: [1, 2, 3, 4, 5] },
    updateProfile: jest.fn(),
  }),
  useTier: () => "free",
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
  checkConfettiGate:          jest.fn(async () => false),
  retryCelebrationSync:       jest.fn(async () => {}),
  persistCelebrationToServer: jest.fn(async () => {}),
}));

jest.mock("@/lib/sessionDelta", () => ({
  buildDeltaMap: jest.fn(() => new Map()),
}));

jest.mock("@/components/WeekDotRow", () => ({
  WeekDotRow: () => null,
}));

jest.mock("@/components/ShareCard", () => ({
  __esModule: true,
  default: (_: any, ref: any) => null,
}));

jest.mock("expo-haptics", () => ({
  notificationAsync:       jest.fn(async () => {}),
  impactAsync:             jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle:     { Light: "light" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync:       jest.fn(async () => {}),
}));

jest.mock("@/lib/api", () => ({
  analyses:    {
    list: (...args: any[]) => mockAnalysesList(...args),
    get:  jest.fn().mockRejectedValue(new Error("not needed")),
  },
  achievements:{ list: (...args: any[]) => mockAchievementsList(...args) },
  profile:     { stats: (...args: any[]) => mockProfileStats(...args) },
  jointTrends: { get: (...args: any[]) => mockJointTrendsGet(...args) },
}));

jest.mock("../../../utils/shareUtils", () => ({
  buildGoalShareMessage: jest.fn(() => "I reached my weekly goal!"),
}));

jest.mock("../../../utils/scheduleUtils", () => ({
  computeScheduleSummary: jest.fn(() => "Mon–Fri"),
}));

// ─── Import component AFTER mocks ─────────────────────────────────────────────

import HomeScreen from "../index";

// ─── Shared test data ─────────────────────────────────────────────────────────

const HINT_TEXT = "Tap to share 🎉";

const GOAL_REACHED_STATS = {
  thisWeekCount: 3,
  lastWeekCount: 2,
  totalAnalyses: 5,
  streak: 1,
  scoreDelta: 0,
  weeklyGoal: 3,
  weeklyProgress: 3,
  personalBests: {
    technique: 0,
    power: 0,
    balance: 0,
    consistency: 0,
    mobility: 0,
    speed: 0,
  },
};

const ONE_ANALYSIS = {
  analyses: [
    {
      id: "a1",
      status: "complete",
      sport: "basketball",
      overallScore: 78,
      uploadedAt: new Date().toISOString(),
      techniqueScore: 78,
      powerScore: 72,
      balanceScore: 80,
      consistencyScore: 70,
      mobilityScore: 75,
      speedScore: 68,
    },
  ],
};

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
  mockAnalysesList.mockResolvedValue(ONE_ANALYSIS);
  mockAchievementsList.mockResolvedValue(EMPTY_ACHIEVEMENTS);
  mockProfileStats.mockResolvedValue(GOAL_REACHED_STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
  // Default: key is absent (hint not yet shown)
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — share hint visibility", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("shows the hint when the goal is reached and share_hint_shown is absent", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { queryByText } = render(<HomeScreen />);
    await simulateFocus();

    expect(queryByText(HINT_TEXT)).toBeTruthy();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("does NOT show the hint when share_hint_shown is already 'true'", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "share_hint_shown") return "true";
      return null;
    });

    const { queryByText } = render(<HomeScreen />);
    await simulateFocus();

    expect(queryByText(HINT_TEXT)).toBeNull();
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("writes share_hint_shown='true' to AsyncStorage when dismissShareHint is called", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { getByText } = render(<HomeScreen />);
    await simulateFocus();

    // Hint must be present so the banner's onPress is wired to dismissShareHint.
    expect(getByText(HINT_TEXT)).toBeTruthy();

    // Press the goal banner — its onPress is dismissShareHint when hint is shown.
    await act(async () => {
      fireEvent.press(getByText("Weekly goal reached!"));
    });
    await flush();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith("share_hint_shown", "true");
  });
});
