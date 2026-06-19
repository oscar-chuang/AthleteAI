import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";

// ─── Navigation mock ───────────────────────────────────────────────────────────
// Capture the latest beforeRemove listener so tests can fire it manually.
let capturedBeforeRemove: ((e: any) => void) | undefined;
const mockDispatch = jest.fn();
const mockAddListener = jest.fn((event: string, cb: any) => {
  if (event === "beforeRemove") capturedBeforeRemove = cb;
  return jest.fn(); // returns unsubscribe
});

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    addListener: mockAddListener,
    dispatch: mockDispatch,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// ─── Auth mock ─────────────────────────────────────────────────────────────────
const mockUpdateProfile = jest.fn(async () => {});

// Mutable so individual tests can override avatarUrl without re-mocking.
const mockProfile = {
  name: "Alex Smith",
  sport: "Running",
  level: "intermediate",
  goals: ["Improve technique"],
  injuryConcerns: ["No current injuries"],
  weeklyGoal: 3,
  trainingDays: [0, 1, 2, 3, 4, 5, 6],
  avatarUrl: null as string | null,
};

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "athlete@example.com", name: "Alex Smith" },
    profile: mockProfile,
    updateProfile: mockUpdateProfile,
    logout: jest.fn(),
  }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#0a0a0a",
    foreground: "#f5f5f5",
    card: "#1a1a1a",
    border: "#2a2a2a",
    primary: "#6c63ff",
    mutedForeground: "#888888",
    destructive: "#ff4d6d",
    success: "#22c55e",
    radius: 12,
  }),
}));

// Import after all mocks are set up.
import ProfileSettingsScreen from "../profile-settings";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Fire the captured beforeRemove listener with a preventable fake event. */
function fireBeforeRemove() {
  const preventDefault = jest.fn();
  const fakeEvent = {
    preventDefault,
    data: { action: { type: "GO_BACK" } },
  };
  capturedBeforeRemove?.(fakeEvent);
  return { preventDefault };
}

/** Flush pending React microtasks / effect queues. */
async function flush(rounds = 3) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  capturedBeforeRemove = undefined;
  mockAddListener.mockClear();
  mockDispatch.mockClear();
  mockUpdateProfile.mockClear();
  mockUpdateProfile.mockResolvedValue(undefined);
  // Reset profile to default (no photo) before each test.
  mockProfile.avatarUrl = null;
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProfileSettingsScreen — discard-changes prompt", () => {
  it("does NOT show an Alert when closing with no edits", async () => {
    render(<ProfileSettingsScreen />);
    await flush();

    fireBeforeRemove();

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("shows the 'Discard changes?' Alert after editing the name field", async () => {
    const { getByPlaceholderText } = render(<ProfileSettingsScreen />);
    await flush();

    // Edit the name field — makes isDirty true.
    fireEvent.changeText(getByPlaceholderText("e.g. Alex Johnson"), "Alex Modified");
    await flush();

    const { preventDefault } = fireBeforeRemove();

    expect(preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Discard changes?",
      expect.any(String),
      expect.any(Array)
    );
  });

  it("shows the 'Discard changes?' Alert after tapping a sport chip", async () => {
    const { getByText } = render(<ProfileSettingsScreen />);
    await flush();

    // Tap the "Soccer" chip — profile sport is "Running", so this makes isDirty true.
    fireEvent.press(getByText("Soccer"));
    await flush();

    const { preventDefault } = fireBeforeRemove();

    expect(preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Discard changes?",
      expect.any(String),
      expect.any(Array)
    );
  });

  it("does NOT show an Alert after saving the edits and then closing", async () => {
    const { getByPlaceholderText, getByText } = render(<ProfileSettingsScreen />);
    await flush();

    // Edit the name field to make the form dirty.
    fireEvent.changeText(getByPlaceholderText("e.g. Alex Johnson"), "Alex Saved");
    await flush();

    // Tap Save Changes — updates refs → isDirty becomes false.
    await act(async () => {
      fireEvent.press(getByText("Save Changes"));
    });
    await flush();

    fireBeforeRemove();

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("pressing 'Discard' dispatches the pending navigation action", async () => {
    const { getByPlaceholderText } = render(<ProfileSettingsScreen />);
    await flush();

    // Make the form dirty so the alert fires.
    fireEvent.changeText(getByPlaceholderText("e.g. Alex Johnson"), "Alex Modified");
    await flush();

    const goBackAction = { type: "GO_BACK" };
    const preventDefault = jest.fn();
    const fakeEvent = { preventDefault, data: { action: goBackAction } };
    capturedBeforeRemove?.(fakeEvent);

    expect(Alert.alert).toHaveBeenCalledTimes(1);

    // Extract buttons from the Alert call and invoke Discard.
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    const discardBtn = buttons.find((b: any) => b.text === "Discard");
    expect(discardBtn).toBeDefined();

    discardBtn.onPress();

    expect(mockDispatch).toHaveBeenCalledWith(goBackAction);
  });

  it("pressing 'Cancel' does NOT dispatch the navigation action", async () => {
    const { getByPlaceholderText } = render(<ProfileSettingsScreen />);
    await flush();

    // Make the form dirty so the alert fires.
    fireEvent.changeText(getByPlaceholderText("e.g. Alex Johnson"), "Alex Modified");
    await flush();

    fireBeforeRemove();

    expect(Alert.alert).toHaveBeenCalledTimes(1);

    // Extract buttons and confirm Cancel has no onPress that triggers dispatch.
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    const cancelBtn = buttons.find((b: any) => b.text === "Cancel");
    expect(cancelBtn).toBeDefined();
    expect(cancelBtn.style).toBe("cancel");

    // Cancel has no onPress — calling it (if present) must not dispatch.
    cancelBtn.onPress?.();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

// ─── Remove photo resets avatar to initials ────────────────────────────────────

describe("ProfileSettingsScreen — Remove photo button", () => {
  const PHOTO_URI = "data:image/jpeg;base64,/9j/abc123==";

  it("calls updateProfile with { avatarUrl: null } when Remove photo is tapped", async () => {
    mockProfile.avatarUrl = PHOTO_URI;

    const { getByText } = render(<ProfileSettingsScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByText("Remove photo"));
    });
    await flush();

    expect(mockUpdateProfile).toHaveBeenCalledWith({ avatarUrl: null });
    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
  });

  it("hides the Remove photo button after removal (isPhotoAvatar returns false)", async () => {
    mockProfile.avatarUrl = PHOTO_URI;

    const { getByText, queryByText } = render(<ProfileSettingsScreen />);
    await flush();

    // Button is visible while a photo avatar is set.
    expect(getByText("Remove photo")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText("Remove photo"));
    });
    await flush();

    // Button must disappear once avatarUrl is cleared.
    expect(queryByText("Remove photo")).toBeNull();
  });

  it("does NOT show the Remove photo button when the avatar is a preset colour", async () => {
    mockProfile.avatarUrl = "preset:#6c63ff";

    const { queryByText } = render(<ProfileSettingsScreen />);
    await flush();

    expect(queryByText("Remove photo")).toBeNull();
  });

  it("does NOT show the Remove photo button when avatarUrl is null", async () => {
    mockProfile.avatarUrl = null;

    const { queryByText } = render(<ProfileSettingsScreen />);
    await flush();

    expect(queryByText("Remove photo")).toBeNull();
  });
});
