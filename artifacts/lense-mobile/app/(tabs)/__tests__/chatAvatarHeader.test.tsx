/**
 * Unit tests: AvatarDisplay in the AI Coach header.
 *
 * Covers two concerns:
 *   1. Rendering — initials fallback and preset-colour circle.
 *   2. Navigation — tapping the avatar calls router.push("/profile-settings")
 *      for both the Pro header (canAccess = true) and the paywall header
 *      (canAccess = false).
 *
 * Uses the REAL AvatarDisplay (not mocked) so the tests exercise the actual
 * rendering logic. All other dependencies are stubbed to the minimum needed
 * for a successful render.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Module-level mock state ──────────────────────────────────────────────────

let mockProfile: {
  name: string;
  avatarUrl: string | null;
  sport: string;
  level: string;
} | null = null;

const mockRefreshProfile = jest.fn(async () => {});

// Shared router mock — lifted to module level so tap tests can assert on it.
const mockPush = jest.fn();

// Controls whether the user has Pro access (true → main chat header,
// false → paywall header).
let mockCanAccess = true;

// Capture useFocusEffect callback so we control when focus fires.
let mockFocusCallback: (() => (() => void) | void) | null = null;

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
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
  useCanAccessFeature: () => mockCanAccess,
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
  mockCanAccess = true;
  mockPush.mockClear();
  mockRefreshProfile.mockClear();
  mockProfile = {
    name: "Alex Smith",
    avatarUrl: null,
    sport: "Running",
    level: "intermediate",
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ChatScreen — AvatarDisplay in the AI Coach header", () => {
  // ── Rendering ────────────────────────────────────────────────────────────────

  it("renders initials when the profile has no avatar (avatarUrl is null)", async () => {
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

  // ── Navigation: Pro header (canAccess = true) ─────────────────────────────

  it("navigates to /profile-settings when the avatar is tapped in the Pro (main chat) header", async () => {
    // mockCanAccess = true → the full chat header is rendered (not paywall).
    mockCanAccess = true;

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The avatar renders initials "AS"; pressing them fires the wrapping
    // TouchableOpacity's onPress → router.push("/profile-settings").
    fireEvent.press(getByText("AS"));

    expect(mockPush).toHaveBeenCalledWith("/profile-settings");
  });

  // ── Navigation: Paywall header (canAccess = false) ────────────────────────

  it("navigates to /profile-settings when the avatar is tapped in the paywall header", async () => {
    // mockCanAccess = false → the paywall variant of the header is rendered.
    mockCanAccess = false;

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The paywall header also wraps AvatarDisplay in a TouchableOpacity that
    // navigates to /profile-settings when pressed.
    fireEvent.press(getByText("AS"));

    expect(mockPush).toHaveBeenCalledWith("/profile-settings");
  });
});

// ─── Sport / level tag navigation ────────────────────────────────────────────

describe("ChatScreen — sport/level tag in the AI Coach header", () => {
  // ── Pro header (canAccess = true) ─────────────────────────────────────────

  it("navigates to /profile-settings when the sport/level tag is tapped in the Pro (main chat) header", async () => {
    // mockCanAccess = true → the full chat header is rendered.
    mockCanAccess = true;
    // mockProfile already has sport: "Running" and level: "intermediate".

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The TouchableOpacity wrapping the sport/level text fires
    // router.push("/profile-settings") when pressed.
    fireEvent.press(getByText("Running · Intermediate"));

    expect(mockPush).toHaveBeenCalledWith("/profile-settings");
  });

  it("navigates to /profile-settings when the sport/level tag is tapped in the paywall header", async () => {
    // mockCanAccess = false → the paywall variant of the header is rendered.
    mockCanAccess = false;
    // mockProfile already has sport: "Running" and level: "intermediate".

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The paywall header also wraps the sport/level text in a TouchableOpacity
    // that navigates to /profile-settings.
    fireEvent.press(getByText("Running · Intermediate"));

    expect(mockPush).toHaveBeenCalledWith("/profile-settings");
  });

  // ── Fallback labels when sport/level are missing ──────────────────────────

  it('navigates to /profile-settings when the "Set sport & level →" fallback is tapped in the Pro header', async () => {
    // mockCanAccess = true → full chat header rendered.
    mockCanAccess = true;
    // Profile exists but sport and level are empty strings → fallback label shown.
    mockProfile = { name: "Alex Smith", avatarUrl: null, sport: "", level: "" };

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The TouchableOpacity wrapping the fallback text still navigates to
    // /profile-settings so the user can fill in their sport and level.
    fireEvent.press(getByText("Set sport & level →"));

    expect(mockPush).toHaveBeenCalledWith("/profile-settings");
  });

  it('navigates to /profile-settings when the "Set sport & level →" fallback is tapped in the paywall header', async () => {
    // mockCanAccess = false → paywall header rendered.
    mockCanAccess = false;
    // Profile exists but sport and level are empty strings → fallback label shown.
    mockProfile = { name: "Alex Smith", avatarUrl: null, sport: "", level: "" };

    const { getByText } = render(<ChatScreen />);
    await simulateFocus();

    // The TouchableOpacity wrapping the fallback also navigates to /profile-settings
    // so the user can fill in their sport and level.
    fireEvent.press(getByText("Set sport & level →"));

    expect(mockPush).toHaveBeenCalledWith("/profile-settings");
  });
});
