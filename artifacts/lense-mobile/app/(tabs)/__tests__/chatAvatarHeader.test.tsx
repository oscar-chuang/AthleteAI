/**
 * Unit tests: AvatarDisplay appears correctly in the AI Coach header.
 *
 * Uses the REAL AvatarDisplay (not mocked) so the tests exercise the actual
 * rendering logic — initials fallback when avatarUrl is null, and coloured
 * circle when avatarUrl is a preset colour string.
 *
 * All other dependencies of ChatScreen / profile-settings are stubbed to the
 * minimum needed for a successful render.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockProfile: {
  name: string;
  avatarUrl: string | null;
  sport: string;
  level: string;
} | null = null;

const mockRefreshProfile = jest.fn(async () => {});

// Capture useFocusEffect callback so we control when focus fires.
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
    destructive: "#ff4d6d",
  }),
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    profile: mockProfile,
    refreshProfile: mockRefreshProfile,
    user: { id: "u1", email: "athlete@test.com", name: mockProfile?.name ?? "" },
    updateProfile: jest.fn(async () => {}),
    logout: jest.fn(),
  }),
  useCanAccessFeature: () => true,
}));

jest.mock("@/lib/api", () => ({
  chat: {
    history: jest.fn(async () => ({ messages: [] })),
    suggestions: jest.fn(async () => ({ suggestions: [], hasCompletedAnalyses: false })),
    send: jest.fn(),
    clear: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    code = "";
  },
}));

jest.mock("@/components/MarkdownText", () => ({
  MarkdownText: ({ text }: { text: string }) => {
    const ReactLocal = require("react");
    const { Text } = require("react-native");
    return ReactLocal.createElement(Text, null, text);
  },
}));

// NOTE: @/app/profile-settings is NOT mocked — we render the real AvatarDisplay.

// Import component AFTER all mocks are set up.
import ChatScreen from "../chat";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function flush(rounds = 4) {
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
  mockRefreshProfile.mockClear();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ChatScreen — AvatarDisplay in the AI Coach header", () => {
  it("renders initials when the profile has no avatar (avatarUrl is null)", async () => {
    mockProfile = {
      name: "Alex Smith",
      avatarUrl: null,
      sport: "Running",
      level: "intermediate",
    };

    const { getByText } = render(<ChatScreen />);
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
    };

    const { getByText } = render(<ChatScreen />);
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
