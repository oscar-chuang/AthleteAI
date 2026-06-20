/**
 * Regression tests: formatBiomechanicsTextSafe is applied to assistant
 * messages in the Coach chat list, and user messages are left verbatim.
 *
 * Mocking strategy mirrors chatSportChange.test.tsx:
 *   - chatApi.history() is seeded with pre-built messages so we can assert
 *     exactly what text the FlatList renders.
 *   - MarkdownText renders its `text` prop as a plain <Text> node so
 *     translated phrases are directly queryable via getByText().
 *   - useFocusEffect is captured manually; tests call simulateFocus() to
 *     trigger the initial load.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

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

let mockFocusCallback: (() => (() => void) | void) | null = null;

let mockCanAccess = true;

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
    primary: "#6c63ff",
    mutedForeground: "#888888",
    muted: "#333333",
    success: "#22c55e",
    destructive: "#ff4d6d",
    surface2: "#111111",
    surface3: "#222222",
    surface4: "#333333",
    borderStrong: "#3a3a3a",
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
  useCanAccessFeature: () => mockCanAccess,
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

async function flush(rounds = 4) {
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
  mockCanAccess = true;
  mockProfile = {
    sport: "running",
    level: "intermediate",
    name: "Test Athlete",
    avatarUrl: null,
  };
  mockFocusCallback = null;
  mockRefreshProfile.mockClear();
  mockChatSuggestions.mockResolvedValue({
    suggestions: [],
    hasCompletedAnalyses: true,
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ChatScreen — term translation in chat messages", () => {
  // ── Test 1 ─────────────────────────────────────────────────────────────────
  // Assistant messages containing anatomical terms must be translated before
  // rendering.  "knee valgus" → "knee caving inward" is the canonical example
  // from the task spec.

  it("translates anatomical terms in assistant messages (knee valgus → knee caving inward)", async () => {
    mockChatHistory.mockResolvedValue({
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: "You are showing knee valgus during your squat descent.",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The translated phrase must appear in the rendered output.
    expect(
      getByText("You are showing knee caving inward during your squat descent."),
    ).toBeTruthy();
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  // User messages must be rendered verbatim — no term translation applied.

  it("renders user messages verbatim without translation", async () => {
    mockChatHistory.mockResolvedValue({
      messages: [
        {
          id: "msg-u1",
          role: "user",
          content: "What is knee valgus?",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The original text must be present, untouched.
    expect(getByText("What is knee valgus?")).toBeTruthy();
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  // Both message types can appear in the same list; each must be treated
  // independently — user verbatim, assistant translated.

  it("applies translation only to the assistant bubble when both roles are present", async () => {
    mockChatHistory.mockResolvedValue({
      messages: [
        {
          id: "msg-u1",
          role: "user",
          content: "Tell me about knee valgus.",
          createdAt: new Date().toISOString(),
        },
        {
          id: "msg-a1",
          role: "assistant",
          content: "Knee valgus means your knees cave inward.",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // User bubble is unchanged.
    expect(getByText("Tell me about knee valgus.")).toBeTruthy();

    // Assistant bubble has the term translated.
    expect(
      getByText("Knee caving inward means your knees cave inward."),
    ).toBeTruthy();
  });
});
