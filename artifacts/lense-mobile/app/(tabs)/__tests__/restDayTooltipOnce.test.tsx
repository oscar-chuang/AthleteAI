/**
 * Unit tests confirming the rest-day tooltip appears at most once per user.
 *
 * The tooltip is gated by the AsyncStorage key `rest_day_tooltip_dismissed`.
 * A useEffect keyed on trainingDaysKey sets showRestDayTooltip=true only when
 * the profile has rest days (trainingDays.length < 7) AND the key is absent.
 * dismissRestDayTooltip writes the key so subsequent mounts always skip it.
 *
 * Mocking strategy mirrors shareHintOnce.test.tsx:
 *   - useFocusEffect is captured so tests fire it manually (component needs it
 *     to load data and render the weekly-dot row that hosts the tooltip).
 *   - @react-native-async-storage/async-storage is overridden so each test can
 *     program getItem/setItem independently.
 *   - All heavy UI dependencies (SVG, Haptics, expo-sharing, ShareCard…) are
 *     stubbed to null so the component renders without native modules.
 *
 * Covered scenarios:
 *   1. Key absent  + profile has rest days → tooltip is shown.
 *   2. Key present + profile has rest days → tooltip stays hidden.
 *   3. Dismiss button pressed              → AsyncStorage.setItem("rest_day_tooltip_dismissed", "true").
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

// Profile with only 5 training days → 2 rest days → tooltip should appear.
jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@test.com" },
    profile: {
      weeklyGoal: 3,
      weeklyProgress: 2,
      sport: "basketball",
      trainingDays: [1, 2, 3, 4, 5],
    },
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

jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard: () => null,
}));

jest.mock("expo-haptics", () => ({
  notificationAsync:        jest.fn(async () => {}),
  impactAsync:              jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle:      { Light: "light" },
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

const TOOLTIP_TEXT = "Grey = rest day (not in your schedule)";

const STATS = {
  thisWeekCount: 2,
  lastWeekCount: 1,
  totalAnalyses: 3,
  streak: 0,
  scoreDelta: 0,
  weeklyGoal: 3,
  weeklyProgress: 2,
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
  mockProfileStats.mockResolvedValue(STATS);
  mockJointTrendsGet.mockRejectedValue(new Error("not needed"));
  // Default: key is absent (tooltip not yet dismissed)
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — rest-day tooltip visibility", () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("shows the tooltip when the profile has rest days and rest_day_tooltip_dismissed is absent", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { queryByTestId } = render(<HomeScreen />);
    await simulateFocus();

    expect(queryByTestId("rest-day-tooltip")).toBeTruthy();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("does NOT show the tooltip when rest_day_tooltip_dismissed is already 'true'", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "rest_day_tooltip_dismissed") return "true";
      return null;
    });

    const { queryByTestId } = render(<HomeScreen />);
    await simulateFocus();

    expect(queryByTestId("rest-day-tooltip")).toBeNull();
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("writes rest_day_tooltip_dismissed='true' to AsyncStorage when the dismiss button is pressed", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { getByTestId, queryByText } = render(<HomeScreen />);
    await simulateFocus();

    // Tooltip must be visible before we can press the dismiss button.
    expect(queryByText(TOOLTIP_TEXT)).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("rest-day-tooltip-dismiss"));
    });
    await flush();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "rest_day_tooltip_dismissed",
      "true",
    );
  });
});
