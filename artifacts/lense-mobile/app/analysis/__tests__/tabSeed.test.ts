/**
 * Tests for tab-seed logic in the Analysis Detail screen.
 *
 * Covers:
 *   1. seedActiveTab — valid param → correct tab returned.
 *   2. seedActiveTab — invalid param → falls back to "scores".
 *   3. seedActiveTab — undefined / missing param → falls back to "scores".
 *   4. seedActiveTab — array param (expo-router can return string[]) → first
 *      element used when valid, fallback when invalid.
 *   5. navigateTo() passes ?tab=<activeTab> to router.replace, preserving the
 *      current tab when the user navigates to an adjacent session.
 *   6. navigateTo() passes ?tab=scores when no tab param was in the URL.
 *
 * Mocking strategy for navigateTo tests:
 *   - mockTabParam is a mutable variable read by useLocalSearchParams. Tests
 *     mutate it before rendering — no jest.doMock / jest.resetModules needed.
 *   - mockReplace is captured so we can assert the exact router.replace arg.
 *   - analysesApi.list resolves with two complete sessions so the Next button
 *     becomes enabled (currIndex < siblingIds.length - 1).
 */

// ── Mutable mock state shared across all tests in this file ───────────────────

let mockTabParam: string | undefined = undefined;
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockAnalysesGet = jest.fn();
const mockAnalysesList = jest.fn();
const mockResolveSwipeDirection = jest.fn();

// ── Module mocks (hoisted by Jest before any imports) ─────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "session-a", tab: mockTabParam }),
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    back: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
  // Invoke the callback immediately so load() fires on mount.
  useFocusEffect: (cb: () => (() => void) | void) => { cb(); },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn() }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
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
    destructive: "#ff4d6d",
    warning: "#f59e0b",
  }),
}));

jest.mock("@/hooks/useSharePreview", () => ({
  useSharePreview: () => ({
    showSharePreview: false,
    handleShare: jest.fn(),
    handleCancelShare: jest.fn(),
  }),
}));

jest.mock("@/utils/formatBiomechanics", () => ({
  formatBiomechanicsText: (t: string) => t,
}));

jest.mock("@/utils/shareCardCapture", () => ({
  SHARE_CARD_CAPTURE_OPTIONS: { format: "png", quality: 1, result: "tmpfile" },
  HIDDEN_SHARE_CARD_STYLE: { position: "absolute", opacity: 0 },
}));

jest.mock("@/lib/api", () => ({
  analyses: {
    get: (...args: unknown[]) => mockAnalysesGet(...args),
    list: (...args: unknown[]) => mockAnalysesList(...args),
    delete: jest.fn(),
  },
  profile: {
    stats: jest.fn(() => Promise.resolve({ thisWeekCount: 0 })),
    get: jest.fn(() =>
      Promise.resolve({ profile: { weeklyGoal: 3, sport: "running" } })
    ),
  },
  jointTrends: { get: jest.fn().mockResolvedValue({ joints: {} }) },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile: {
      weeklyGoal: 3,
      sport: "running",
      level: "intermediate",
      name: "Test Athlete",
      avatarUrl: null,
    },
    refreshProfile: jest.fn(async () => {}),
  }),
  useCanAccessFeature: () => true,
}));

jest.mock("@/components/ScoreRing", () => ({ ScoreRing: () => null }));
jest.mock("@/components/analysis/ScoreCard", () => ({
  ScoreCard: () => null,
  getScoreBand: () => ({ label: "Good", color: "#22c55e" }),
}));
jest.mock("@/components/analysis/SectionHeader", () => ({
  SectionHeader: () => null,
}));
jest.mock("@/components/analysis/NextFocusCard", () => ({
  NextFocusCard: () => null,
}));
jest.mock("@/components/analysis/AnimatedLoadingState", () => ({
  AnimatedLoadingState: () => null,
}));
jest.mock("@/components/analysis/ShareCard", () => ({
  ShareCard: () => null,
  SHARE_CARD_DARK: {},
  SHARE_CARD_LIGHT: {},
}));

jest.mock("@/utils/swipeNavigation", () => ({
  ...jest.requireActual("@/utils/swipeNavigation"),
  resolveSwipeDirection: (...args: unknown[]) => mockResolveSwipeDirection(...args as any),
}));

// ── Imports (after all mocks are registered) ──────────────────────────────────

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { Animated } from "react-native";
import { seedActiveTab, VALID_TABS } from "../[id]";
import AnalysisDetailScreen from "../[id]";

// ── Fixture: two complete sessions so Next/Prev buttons are enabled ─────────

const COMPLETE_ANALYSIS_A = {
  id: "session-a",
  title: "Squat Session",
  sport: "weightlifting",
  uploadedAt: "2024-06-01T10:00:00Z",
  status: "complete",
  overallScore: 80,
  techniqueScore: 80,
  powerScore: 80,
  balanceScore: 80,
  consistencyScore: 80,
  mobilityScore: 80,
  speedScore: 80,
  jointAngles: null,
  jointRisks: null,
  biomechanicsApplied: false,
  thumbnailUrl: null,
  strengths: [],
  improvements: [],
};

const COMPLETE_ANALYSIS_B = {
  ...COMPLETE_ANALYSIS_A,
  id: "session-b",
  // Newer than A so it sorts first; A becomes currIndex=1 and has a nextId=null,
  // prevId=session-b.  We want prevId to be available so the Prev button works.
  uploadedAt: "2024-06-02T10:00:00Z",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

// ── 1–4: seedActiveTab pure-function tests ────────────────────────────────────

describe("seedActiveTab — pure tab-seed logic", () => {
  it("returns the exact tab when a valid string param is supplied", () => {
    for (const tab of VALID_TABS) {
      expect(seedActiveTab(tab)).toBe(tab);
    }
  });

  it("returns 'scores' when param is an unknown string", () => {
    expect(seedActiveTab("unknown")).toBe("scores");
    expect(seedActiveTab("coaching")).toBe("scores");
    expect(seedActiveTab("")).toBe("scores");
    expect(seedActiveTab("SCORES")).toBe("scores"); // case-sensitive
  });

  it("returns 'scores' when param is undefined (missing from URL)", () => {
    expect(seedActiveTab(undefined)).toBe("scores");
  });

  it("uses the first element when param is an array (expo-router multi-value)", () => {
    // Valid first element
    expect(seedActiveTab(["tips", "scores"])).toBe("tips");
    // Invalid first element → fallback
    expect(seedActiveTab(["bad", "scores"])).toBe("scores");
    // Empty array → fallback
    expect(seedActiveTab([])).toBe("scores");
  });
});

// ── 5 & 6: navigateTo carries ?tab= in the router.replace call ───────────────

describe("navigateTo — tab param is preserved in router.replace", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockAnalysesGet.mockReset();
    mockAnalysesList.mockReset();

    // Default API responses for the detail screen to finish loading.
    mockAnalysesGet.mockResolvedValue({
      analysis: COMPLETE_ANALYSIS_A,
      tips: [],
      injuryRisks: [],
    });

    // Two sessions: B is newer → sorted first.
    // A is at currIndex = 1; prevId = session-b (so Prev button is active).
    mockAnalysesList.mockResolvedValue({
      analyses: [COMPLETE_ANALYSIS_B, COMPLETE_ANALYSIS_A],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("router.replace receives ?tab=tips when activeTab is 'tips'", async () => {
    mockTabParam = "tips";

    const { getByLabelText } = render(React.createElement(AnalysisDetailScreen));
    await flush();

    // Session A is at currIndex=1 in [B, A] → prevId = "session-b".
    const prevBtn = getByLabelText("Previous session");
    fireEvent.press(prevBtn);

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const callArg: string = mockReplace.mock.calls[0][0];
    expect(callArg).toMatch(/\?tab=tips$/);
  });

  it("router.replace receives ?tab=scores when no tab param is in the URL", async () => {
    mockTabParam = undefined;

    const { getByLabelText } = render(React.createElement(AnalysisDetailScreen));
    await flush();

    const prevBtn = getByLabelText("Previous session");
    fireEvent.press(prevBtn);

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const callArg: string = mockReplace.mock.calls[0][0];
    expect(callArg).toMatch(/\?tab=scores$/);
  });
});

// ── 7 & 8: Skeleton CTA push carries ?tab= so expo-router restores it on Back ─

describe("Skeleton CTA — tab param is included in the router.push to person-select", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockAnalysesGet.mockReset();
    mockAnalysesList.mockReset();

    mockAnalysesGet.mockResolvedValue({
      analysis: COMPLETE_ANALYSIS_A,
      tips: [],
      injuryRisks: [],
    });

    mockAnalysesList.mockResolvedValue({
      analyses: [COMPLETE_ANALYSIS_B, COMPLETE_ANALYSIS_A],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("router.push includes ?tab=tips when the active tab is 'tips'", async () => {
    mockTabParam = "tips";

    const { getByText } = render(React.createElement(AnalysisDetailScreen));
    await flush();

    fireEvent.press(getByText("Skeleton"));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const callArg: string = mockPush.mock.calls[0][0];
    expect(callArg).toContain("person-select/session-a");
    expect(callArg).toMatch(/\?tab=tips$/);
  });

  it("router.push includes ?tab=scores when no tab param was in the URL", async () => {
    mockTabParam = undefined;

    const { getByText } = render(React.createElement(AnalysisDetailScreen));
    await flush();

    fireEvent.press(getByText("Skeleton"));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const callArg: string = mockPush.mock.calls[0][0];
    expect(callArg).toContain("person-select/session-a");
    expect(callArg).toMatch(/\?tab=scores$/);
  });
});

// ── 9 & 10: Swipe gesture carries ?tab= in the router.replace call ────────────
//
// Strategy:
//   - Mock resolveSwipeDirection (at module level) to return "prev", so the
//     PanResponder's internal gesture state (all zeros — no simulated moves)
//     doesn't matter.  The component calls resolveSwipeDirection(dx, vx, …)
//     and we force it to the "prev" branch.
//   - Trigger the gesture via swipe-container's onResponderRelease prop so
//     PanResponder calls onPanResponderRelease naturally.
//   - Spy on Animated.timing to call its start callback synchronously.  The
//     callback must receive { finished: true } to satisfy Animated.parallel's
//     internal bookkeeping (which reads result.finished).

describe("swipe gesture — tab param is preserved in router.replace", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockAnalysesGet.mockReset();
    mockAnalysesList.mockReset();

    // Force the swipe direction to "prev" regardless of gesture state values.
    mockResolveSwipeDirection.mockReturnValue("prev");

    // Animated.timing must call its start callback synchronously so that the
    // replace() call inside the animation completion handler fires immediately.
    // Must pass { finished: true } so Animated.parallel's internal finished
    // handler doesn't throw on a missing result.finished property.
    jest.spyOn(Animated, "timing").mockImplementation(() => ({
      start: (cb?: (result: { finished: boolean }) => void) => {
        cb?.({ finished: true });
      },
      stop: jest.fn(),
      reset: jest.fn(),
    } as any));

    mockAnalysesGet.mockResolvedValue({
      analysis: COMPLETE_ANALYSIS_A,
      tips: [],
      injuryRisks: [],
    });
    // B is newer (sorted first) → A is at index 1 → prevId = "session-b".
    mockAnalysesList.mockResolvedValue({
      analyses: [COMPLETE_ANALYSIS_B, COMPLETE_ANALYSIS_A],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("router.replace receives ?tab=tips when swiping to the previous session", async () => {
    mockTabParam = "tips";

    const { getByTestId } = render(React.createElement(AnalysisDetailScreen));
    await flush();

    const swipeContainer = getByTestId("swipe-container");
    await act(async () => {
      swipeContainer.props.onResponderRelease?.({ nativeEvent: {} }, {});
    });
    await flush();

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const callArg: string = mockReplace.mock.calls[0][0];
    expect(callArg).toMatch(/\?tab=tips$/);
  });

  it("router.replace receives ?tab=scores when swiping with no tab param in URL", async () => {
    mockTabParam = undefined;

    const { getByTestId } = render(React.createElement(AnalysisDetailScreen));
    await flush();

    const swipeContainer = getByTestId("swipe-container");
    await act(async () => {
      swipeContainer.props.onResponderRelease?.({ nativeEvent: {} }, {});
    });
    await flush();

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const callArg: string = mockReplace.mock.calls[0][0];
    expect(callArg).toMatch(/\?tab=scores$/);
  });
});
