/**
 * Regression tests: injury concerns appear correctly in the Coach paywall view.
 *
 * The paywall branch (canChat = false) renders a body section that surfaces
 * any real injury concerns from the athlete's profile.  These tests confirm:
 *
 *   • null injuryConcerns  → no injury text rendered
 *   • empty array          → no injury text rendered
 *   • ["No current injuries"] (sentinel) → no injury text rendered
 *   • real concerns        → injury text is present
 *   • mixed (some real + sentinel) → only real concerns appear
 *   • profile updates mid-render → text updates immediately
 *
 * Mocking strategy mirrors chatSportChange.test.tsx:
 *   - useCanAccessFeature always returns false (paywall path).
 *   - useAuth backed by a mutable variable so rerenders see the updated profile.
 *   - useFocusEffect is captured but never fired; the paywall renders without it.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockProfile: {
  sport: string;
  level: string;
  name: string;
  avatarUrl: null;
  injuryConcerns: string[] | null;
} | null = {
  sport: "running",
  level: "intermediate",
  name: "Test Athlete",
  avatarUrl: null,
  injuryConcerns: null,
};

const mockRefreshProfile = jest.fn(async () => {});

let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
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
    borderStrong: "#3a3a3a",
    surface2: "#1e1e1e",
    surface3: "#2a2a2a",
    surface4: "#333333",
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
  // Always render the paywall variant for this test suite.
  useCanAccessFeature: () => false,
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

import ChatScreen from "../chat";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 3) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockProfile = {
    sport: "running",
    level: "intermediate",
    name: "Test Athlete",
    avatarUrl: null,
    injuryConcerns: null,
  };
  mockFocusCallback = null;
  mockRefreshProfile.mockClear();

  mockChatHistory.mockResolvedValue({ messages: [] });
  mockChatSuggestions.mockResolvedValue({
    suggestions: [],
    hasCompletedAnalyses: false,
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ChatScreen paywall — injury concerns display", () => {
  it("renders no injury text when injuryConcerns is null", async () => {
    mockProfile = { ...mockProfile!, injuryConcerns: null };

    const { queryByTestId } = render(<ChatScreen />);
    await flush();

    expect(queryByTestId("paywall-injury-concerns")).toBeNull();
  });

  it("renders no injury text when injuryConcerns is an empty array", async () => {
    mockProfile = { ...mockProfile!, injuryConcerns: [] };

    const { queryByTestId } = render(<ChatScreen />);
    await flush();

    expect(queryByTestId("paywall-injury-concerns")).toBeNull();
  });

  it("renders no injury text when the only concern is the sentinel value", async () => {
    mockProfile = {
      ...mockProfile!,
      injuryConcerns: ["No current injuries"],
    };

    const { queryByTestId } = render(<ChatScreen />);
    await flush();

    expect(queryByTestId("paywall-injury-concerns")).toBeNull();
  });

  it("renders injury text when a real concern is present", async () => {
    mockProfile = { ...mockProfile!, injuryConcerns: ["knee pain"] };

    const { getByTestId } = render(<ChatScreen />);
    await flush();

    const el = getByTestId("paywall-injury-concerns");
    expect(el).toBeTruthy();
  });

  it("lists all real concerns in the injury text", async () => {
    mockProfile = {
      ...mockProfile!,
      injuryConcerns: ["knee pain", "lower back"],
    };

    const { getByTestId } = render(<ChatScreen />);
    await flush();

    const el = getByTestId("paywall-injury-concerns");
    expect(el.props.children).toEqual(
      expect.arrayContaining(["Injury concerns on file: ", "knee pain, lower back"])
    );
  });

  it("filters out the sentinel value when mixed with real concerns", async () => {
    mockProfile = {
      ...mockProfile!,
      injuryConcerns: ["No current injuries", "shoulder strain"],
    };

    const { getByTestId } = render(<ChatScreen />);
    await flush();

    const el = getByTestId("paywall-injury-concerns");
    expect(el).toBeTruthy();
    expect(el.props.children).toEqual(
      expect.arrayContaining(["Injury concerns on file: ", "shoulder strain"])
    );
    expect(JSON.stringify(el.props.children)).not.toContain("No current injuries");
  });

  it("updates injury text immediately when profile injuryConcerns change", async () => {
    mockProfile = { ...mockProfile!, injuryConcerns: null };

    const { queryByTestId, rerender } = render(<ChatScreen />);
    await flush();

    expect(queryByTestId("paywall-injury-concerns")).toBeNull();

    mockProfile = { ...mockProfile!, injuryConcerns: ["hamstring tightness"] };
    rerender(<ChatScreen />);
    await flush();

    const el = queryByTestId("paywall-injury-concerns");
    expect(el).toBeTruthy();
  });

  it("removes injury text when profile injuryConcerns are cleared", async () => {
    mockProfile = { ...mockProfile!, injuryConcerns: ["knee pain"] };

    const { queryByTestId, rerender } = render(<ChatScreen />);
    await flush();

    expect(queryByTestId("paywall-injury-concerns")).toBeTruthy();

    mockProfile = { ...mockProfile!, injuryConcerns: [] };
    rerender(<ChatScreen />);
    await flush();

    expect(queryByTestId("paywall-injury-concerns")).toBeNull();
  });
});
