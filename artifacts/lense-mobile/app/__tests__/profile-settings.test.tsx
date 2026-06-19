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

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(async () => {}),
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
    destructive: "#ff4d6d",
    success: "#22c55e",
    warning: "#f59e0b",
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
  // Reset profile to defaults before each test so tests are order-independent.
  mockProfile.avatarUrl = null;
  mockProfile.weeklyGoal = 3;
  mockProfile.trainingDays = [0, 1, 2, 3, 4, 5, 6];
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

// ─── Training-day toggle auto-syncs weekly goal ───────────────────────────────

describe("ProfileSettingsScreen — training-day toggle auto-updates weekly goal", () => {
  beforeEach(() => {
    // Start with all 7 days selected and a goal intentionally different from 7,
    // so any single deselection crosses the "shouldSuggestGoal" threshold.
    mockProfile.trainingDays = [0, 1, 2, 3, 4, 5, 6];
    mockProfile.weeklyGoal = 3;
  });

  it("auto-updates the weekly goal display to match the new training-day count", async () => {
    const { getByText, getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    // Before toggling, the "3" chip is selected and "6" is not.
    expect(getByTestId("weekly-goal-btn-3").props.accessibilityState.selected).toBe(true);
    expect(getByTestId("weekly-goal-btn-6").props.accessibilityState.selected).toBe(false);

    // Toggle off Friday (dayIdx=5, label "F" is unique on the row) →
    // trainingDays: 7→6, weeklyGoal auto-syncs 3→6.
    await act(async () => {
      fireEvent.press(getByText("F"));
    });
    await flush();

    // The "6" chip is now selected and "3" is no longer selected.
    expect(getByTestId("weekly-goal-btn-6").props.accessibilityState.selected).toBe(true);
    expect(getByTestId("weekly-goal-btn-3").props.accessibilityState.selected).toBe(false);

    // updateProfile is called with the auto-synced weekly goal — confirms the
    // change reached the server, not just the local UI state.
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ weeklyGoal: 6 })
    );
  });

  it("shows the inline hint banner with the correct suggested count", async () => {
    // Start with weeklyGoal matching trainingDays.length (7) so neither the
    // mismatch nudge nor the auto-suggest banner is visible on initial render.
    // Toggling a day off will then set trainingDays → 6 and auto-suggest goal=6.
    mockProfile.weeklyGoal = 7;

    const { getByText, queryByText, getAllByText } = render(<ProfileSettingsScreen />);
    await flush();

    // Hint is absent before any toggle (the mismatch nudge text says
    // "doesn't match your training days" — different from the inline hint
    // which says "to match your training days").
    expect(queryByText(/to match your training days/i)).toBeNull();

    // Toggle off Friday → 6 training days selected → hint appears.
    await act(async () => {
      fireEvent.press(getByText("F"));
    });
    await flush();

    // Banner body text is present.
    expect(getByText(/We set your weekly goal to/i)).toBeTruthy();
    expect(getByText(/to match your training days/i)).toBeTruthy();
    // The suggested number (6) appears in both the goal chip row and the hint
    // banner, confirming the banner shows the correct count.
    expect(getAllByText("6").length).toBeGreaterThanOrEqual(2);
  });

  it("dismisses the hint banner when a different goal number is tapped", async () => {
    const { getByText, queryByText } = render(<ProfileSettingsScreen />);
    await flush();

    // Toggle off Friday → hint for "6" appears.
    await act(async () => {
      fireEvent.press(getByText("F"));
    });
    await flush();

    expect(queryByText(/to match your training days/i)).toBeTruthy();

    // Tap "5" to override the auto-suggested goal → hint must disappear.
    await act(async () => {
      fireEvent.press(getByText("5"));
    });
    await flush();

    expect(queryByText(/to match your training days/i)).toBeNull();
  });
});

// ─── Preset color swatch selection ────────────────────────────────────────────

describe("ProfileSettingsScreen — preset color swatches", () => {
  const PRESET_KEY = "preset:#6c63ff";

  it("calls updateProfile with the chosen preset key when a swatch is tapped", async () => {
    mockProfile.avatarUrl = null;

    const { getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId(`preset-swatch-${PRESET_KEY}`));
    });
    await flush();

    expect(mockUpdateProfile).toHaveBeenCalledWith({ avatarUrl: PRESET_KEY });
    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
  });

  it("keeps the Remove photo button hidden after selecting a preset (isPhotoAvatar is false for preset keys)", async () => {
    mockProfile.avatarUrl = null;

    const { getByTestId, queryByText } = render(<ProfileSettingsScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId(`preset-swatch-${PRESET_KEY}`));
    });
    await flush();

    expect(queryByText("Remove photo")).toBeNull();
  });

  it("replaces an existing photo avatar with a preset key and hides Remove photo", async () => {
    mockProfile.avatarUrl = "data:image/jpeg;base64,/9j/abc123==";

    const { getByTestId, queryByText } = render(<ProfileSettingsScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId(`preset-swatch-${PRESET_KEY}`));
    });
    await flush();

    expect(mockUpdateProfile).toHaveBeenCalledWith({ avatarUrl: PRESET_KEY });
    expect(queryByText("Remove photo")).toBeNull();
  });
});

// ─── Mismatch nudge ────────────────────────────────────────────────────────────

describe("ProfileSettingsScreen — goal/training-days mismatch nudge", () => {
  it("shows the nudge when weeklyGoal does not match trainingDays length on mount", async () => {
    mockProfile.weeklyGoal = 5;
    mockProfile.trainingDays = [1, 2, 3]; // 3 days, goal=5 → mismatch

    const { getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    expect(getByTestId("mismatch-nudge")).toBeTruthy();
  });

  it("does NOT show the nudge when weeklyGoal matches trainingDays length on mount", async () => {
    mockProfile.weeklyGoal = 3;
    mockProfile.trainingDays = [1, 2, 3]; // 3 days, goal=3 → match

    const { queryByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    expect(queryByTestId("mismatch-nudge")).toBeNull();
  });

  it("tapping 'Update to N' calls updateProfile with the correct weeklyGoal", async () => {
    mockProfile.weeklyGoal = 5;
    mockProfile.trainingDays = [1, 2, 3]; // 3 days

    const { getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("mismatch-fix-btn"));
    });
    await flush();

    expect(mockUpdateProfile).toHaveBeenCalledWith({ weeklyGoal: 3 });
  });

  it("tapping 'Update to N' hides the nudge", async () => {
    mockProfile.weeklyGoal = 5;
    mockProfile.trainingDays = [1, 2, 3];

    const { getByTestId, queryByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("mismatch-fix-btn"));
    });
    await flush();

    expect(queryByTestId("mismatch-nudge")).toBeNull();
  });

  it("tapping 'Dismiss' hides the nudge without calling updateProfile", async () => {
    mockProfile.weeklyGoal = 5;
    mockProfile.trainingDays = [1, 2, 3];

    const { getByTestId, queryByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    fireEvent.press(getByTestId("mismatch-dismiss-btn"));
    await flush();

    expect(queryByTestId("mismatch-nudge")).toBeNull();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});
