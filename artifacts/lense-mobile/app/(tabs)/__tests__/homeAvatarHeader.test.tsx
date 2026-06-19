/**
 * Unit tests: AvatarDisplay appears correctly in the Home screen header.
 *
 * Uses the REAL AvatarDisplay (not mocked) so the tests exercise the actual
 * rendering logic — initials fallback when avatarUrl is null, and coloured
 * circle when avatarUrl is a preset colour string.
 *
 * All other dependencies of HomeScreen are stubbed to the minimum needed for a
 * successful render. The mock setup mirrors homeBarAnimation.test.tsx.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Mutable profile — mutated per test ───────────────────────────────────────

let mockProfile: {
  name: string;
  avatarUrl: string | null;
  sport?: string;
  level?: string;
  weeklyGoal?: number;
  weeklyProgress?: number;
  trainingDays?: number[];
} | null = null;

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockFocusCallback: (() => (() => void) | void) | null = null;

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

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "Light" },
  NotificationFeedbackType: { Success: "Success" },
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

// profile-settings also imports these; stub them so the module loads cleanly.
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    addListener: jest.fn(() => jest.fn()),
    dispatch: jest.fn(),
  }),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
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
    user: { id: "u1", email: "athlete@test.com", name: mockProfile?.name ?? "" },
    profile: mockProfile,
    updateProfile: jest.fn(async () => {}),
    logout: jest.fn(),
  }),
  useTier: () => "free",
  useCanAccessFeature: () => true,
}));

jest.mock("@/lib/api", () => ({
  analyses: {
    list: jest.fn(async () => ({ analyses: [] })),
    get: jest.fn().mockRejectedValue(new Error("not needed")),
  },
  achievements: { list: jest.fn(async () => ({ achievements: [] })) },
  profile: { stats: jest.fn(async () => null) },
  jointTrends: { get: jest.fn().mockRejectedValue(new Error("not needed")) },
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
  retryCelebrationSync: jest.fn(async () => {}),
  persistCelebrationToServer: jest.fn(async () => {}),
}));

jest.mock("@/lib/sessionDelta", () => ({
  buildDeltaMap: jest.fn(() => new Map()),
}));

jest.mock("@/components/WeekDotRow", () => ({
  WeekDotRow: () => null,
}));

jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard:       () => null,
  SHARE_CARD_DARK:  {},
  SHARE_CARD_LIGHT: {},
}));

jest.mock("@/utils/shareUtils", () => ({
  buildGoalShareMessage: jest.fn(() => "Share message"),
  buildSessionDeepLink: jest.fn(() => "athleteai://analysis/a1"),
  buildSessionShareMessage: jest.fn(() => "Session share message"),
  buildSessionSharePayload: jest.fn(() => ({ message: "", url: "" })),
  SESSION_DEEP_LINK_SCHEME: "athleteai://analysis",
}));

jest.mock("@/utils/scheduleUtils", () => ({
  SCHEDULE_DAY_LABELS: ["S", "M", "T", "W", "T", "F", "S"],
  computeScheduleSummary: jest.fn(() => null),
}));

jest.mock("@/utils/shareCardCapture", () => ({
  HIDDEN_SHARE_CARD_STYLE: { position: "absolute", opacity: 0 },
  SHARE_CARD_CAPTURE_OPTIONS: { format: "png", quality: 1, result: "tmpfile" },
}));

// profile-settings also imports these; stub them so the module loads cleanly.
jest.mock("@/lib/themeContext", () => ({
  useTheme: () => ({ theme: "dark", setTheme: jest.fn() }),
}));

jest.mock("@/components/CropModal", () => ({
  CropModal: () => null,
}));

jest.mock("@/utils/notifications", () => ({
  persistCheckInHour: jest.fn(async () => {}),
}));

// NOTE: @/app/profile-settings is NOT mocked — we render the real AvatarDisplay.

// Import component AFTER all mocks are set up.
import HomeScreen from "../index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 6) {
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
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HomeScreen — AvatarDisplay in the home header", () => {
  it("renders initials when the profile has no avatar (avatarUrl is null)", async () => {
    mockProfile = {
      name: "Alex Smith",
      avatarUrl: null,
      sport: "Running",
      level: "intermediate",
      weeklyGoal: 3,
      weeklyProgress: 0,
      trainingDays: [0, 1, 2, 3, 4, 5, 6],
    };

    const { getByText } = render(<HomeScreen />);
    await simulateFocus();

    // AvatarDisplay derives initials from the name: "Alex Smith" → "AS"
    expect(getByText("AS")).toBeTruthy();
  });

  it("renders initials inside a coloured circle when a preset avatar is active", async () => {
    mockProfile = {
      name: "Jordan Lee",
      avatarUrl: "preset:#22c55e",
      sport: "Swimming",
      level: "advanced",
      weeklyGoal: 3,
      weeklyProgress: 0,
      trainingDays: [0, 1, 2, 3, 4, 5, 6],
    };

    const { getByText } = render(<HomeScreen />);
    await simulateFocus();

    // AvatarDisplay still renders initials for a preset-colour avatar: "Jordan Lee" → "JL"
    const initialsEl = getByText("JL");
    expect(initialsEl).toBeTruthy();

    // getByText returns the text node; .parent is the <Text> component;
    // .parent.parent is the circle <View> that holds the background colour.
    const circleView = initialsEl.parent?.parent;
    expect(circleView?.props?.style).toMatchObject(
      expect.objectContaining({ backgroundColor: "#22c55e" })
    );
  });
});
