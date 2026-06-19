/**
 * Component-level regression test: AI Coach picks up a sport change without
 * restarting the app.
 *
 * This test renders the real ChatScreen component (not a hand-rolled
 * simulation) and verifies two complementary behaviours:
 *
 *   1. On tab focus, refreshProfile() is called and loadHistory runs, which
 *      calls chatApi.suggestions() and sets initialLoadDone — establishing the
 *      baseline profile context for Claude.
 *
 *   2. When profile.sport changes mid-session (user goes to Settings, updates
 *      sport, then returns to Coach tab), the useEffect([profileSport, …])
 *      dependency fires, calls loadSuggestions(), and chatApi.suggestions() is
 *      invoked again so the chip set reflects the new sport — all without an
 *      app restart.
 *
 * Mocking strategy:
 *   - expo-router's useFocusEffect is replaced with a capture-and-manual-fire
 *     helper so tests control exactly when focus events arrive.
 *   - useAuth is backed by a mutable variable so rerenders see the updated
 *     profile.sport without reloading any module.
 *   - chatApi.suggestions() and chatApi.history() are jest.fn() spies so we
 *     can assert call counts precisely.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────
// Must use 'mock' prefix for jest variable hoisting to work correctly.

let mockProfile: {
  sport: string;
  level: string;
  name: string;
  avatarUrl: null;
} | null = {
  sport: "running",
  level: "intermediate",
  name: "Test Athlete",
  avatarUrl: null,
};

const mockRefreshProfile = jest.fn(async () => {});

// Capture useFocusEffect callback so tests can fire it on demand.
let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  // Capture the registered callback but do NOT auto-execute — tests call it
  // manually to simulate focus events with full control over timing.
  useFocusEffect: (cb: () => (() => void) | void) => {
    mockFocusCallback = cb;
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
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
  }),
}));

const mockChatSuggestions = jest.fn();
const mockChatHistory = jest.fn();

jest.mock("@/lib/api", () => ({
  chat: {
    history: (...args: any[]) => mockChatHistory(...args),
    suggestions: (...args: any[]) => mockChatSuggestions(...args),
    send: jest.fn(),
    clear: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    code = "";
  },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile: mockProfile,
    refreshProfile: mockRefreshProfile,
  }),
  useCanAccessFeature: () => true,
}));

jest.mock("@/components/MarkdownText", () => ({
  MarkdownText: ({ text }: { text: string }) => {
    const ReactLocal = require("react");
    const { Text } = require("react-native");
    return ReactLocal.createElement(Text, null, text);
  },
}));

jest.mock("@/app/profile-settings", () => ({
  AvatarDisplay: () => null,
}));

// Import component AFTER all mocks are set up.
import ChatScreen from "../chat";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending React state updates / async effects. */
async function flush(rounds = 4) {
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
  mockProfile = {
    sport: "running",
    level: "intermediate",
    name: "Test Athlete",
    avatarUrl: null,
  };
  mockFocusCallback = null;
  mockRefreshProfile.mockClear();

  // Default: history returns empty, suggestions return running content.
  mockChatHistory.mockResolvedValue({ messages: [] });
  mockChatSuggestions.mockResolvedValue({
    suggestions: [
      "Improve your running cadence",
      "Core drills for running",
    ],
    hasCompletedAnalyses: true,
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ChatScreen — sport-change propagates to suggestion chips", () => {
  // ── Test 1 ─────────────────────────────────────────────────────────────────

  it("calls refreshProfile on focus so the server profile is always current", async () => {
    render(<ChatScreen />);
    await simulateFocus();

    expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  it("calls chatApi.suggestions() on initial focus to populate suggestion chips", async () => {
    render(<ChatScreen />);
    await simulateFocus();

    // loadHistory calls chatApi.history() + chatApi.suggestions() in parallel.
    expect(mockChatHistory).toHaveBeenCalledTimes(1);
    expect(mockChatSuggestions).toHaveBeenCalledTimes(1);
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  it("re-calls chatApi.suggestions() when profile.sport changes mid-session", async () => {
    const { rerender } = render(<ChatScreen />);
    await simulateFocus(); // initial load → initialLoadDone = true

    // Confirm baseline: running suggestions loaded.
    expect(mockChatSuggestions).toHaveBeenCalledTimes(1);

    // Athlete updates their sport in Settings and returns to Coach tab.
    mockProfile = {
      sport: "swimming",
      level: "intermediate",
      name: "Test Athlete",
      avatarUrl: null,
    };
    mockChatSuggestions.mockResolvedValue({
      suggestions: [
        "Freestyle stroke drill for swimming",
        "Breathing technique for swimming",
      ],
      hasCompletedAnalyses: true,
    });

    // Rerender with the updated profile (mirrors what React context does when
    // the auth state updates after Settings saves).
    rerender(<ChatScreen />);
    await flush();

    // Sport changed → useEffect([profileSport, …]) fires → loadSuggestions()
    // → chatApi.suggestions() called a second time.
    expect(mockChatSuggestions).toHaveBeenCalledTimes(2);
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  it("does NOT call loadSuggestions before initialLoadDone (no double-fetch on mount)", async () => {
    // Render but do NOT simulate focus (initialLoadDone stays false).
    render(<ChatScreen />);
    await flush();

    // The sport-change useEffect guard must block the call until focus arrives.
    expect(mockChatSuggestions).not.toHaveBeenCalled();
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────

  it("re-fetches suggestions on a second focus (user leaves and returns to tab)", async () => {
    render(<ChatScreen />);

    // First focus: initial load
    await simulateFocus();
    expect(mockChatSuggestions).toHaveBeenCalledTimes(1);

    // User navigates away, then back — a second focus event fires.
    await simulateFocus();

    // loadHistory is called again → suggestions re-fetched.
    expect(mockChatSuggestions).toHaveBeenCalledTimes(2);
  });
});

// ─── Header subtitle reflects profile sport/level ─────────────────────────────
//
// The Coach header subtitle (`sport · level`) is derived directly from
// authContext.profile.  When the user saves new profile settings the context
// updates synchronously (setUserProfile is called inside updateProfile right
// after the API responds), so the header must reflect the change on the very
// next render — no focus event, no app reload required.

describe("ChatScreen — Coach header subtitle reflects current profile", () => {
  // ── Test 1 ─────────────────────────────────────────────────────────────────

  it("displays the initial sport and level in the header subtitle", async () => {
    mockProfile = {
      sport: "running",
      level: "intermediate",
      name: "Test Athlete",
      avatarUrl: null,
    };

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The header subtitle must show the concatenated sport · level string (title-cased).
    expect(getByText("Running · Intermediate")).toBeTruthy();
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  it("updates the header subtitle immediately when profile sport/level change", async () => {
    mockProfile = {
      sport: "running",
      level: "intermediate",
      name: "Test Athlete",
      avatarUrl: null,
    };

    const { getByText, rerender } = render(<ChatScreen />);
    await simulateFocus();

    // Baseline: Running · Intermediate is visible (title-cased by the component).
    expect(getByText("Running · Intermediate")).toBeTruthy();

    // Athlete opens profile settings and saves a new sport + level.
    // AuthContext calls setUserProfile synchronously, which triggers a rerender.
    mockProfile = {
      sport: "swimming",
      level: "advanced",
      name: "Test Athlete",
      avatarUrl: null,
    };

    // Rerender mirrors the React context update that follows setUserProfile().
    rerender(<ChatScreen />);
    await flush();

    // The header subtitle must show the new values immediately — no focus
    // event or app reload should be needed.
    expect(getByText("Swimming · Advanced")).toBeTruthy();
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  it("falls back to 'Online · Ready to help' when profile has no sport/level", async () => {
    mockProfile = {
      sport: "",
      level: "",
      name: "Test Athlete",
      avatarUrl: null,
    };

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    expect(getByText("Online · Ready to help")).toBeTruthy();
  });
});
