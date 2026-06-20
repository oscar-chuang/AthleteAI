import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";

// ─── Navigation mock ───────────────────────────────────────────────────────────
// Capture the latest beforeRemove listener so tests can fire it manually.
let capturedBeforeRemove: ((e: any) => void) | undefined;
const mockDispatch = jest.fn();
const mockSetAccentColor = jest.fn();
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

// ─── CropModal mock ─────────────────────────────────────────────────────────────
// Captures the latest onConfirm prop so tests can trigger a crop confirmation
// without rendering the real CropModal (which requires image-manipulator).
let capturedCropConfirm: ((result: { mimeType: string; base64: string }) => Promise<void>) | null = null;

jest.mock("@/components/CropModal", () => ({
  CropModal: ({ visible, onConfirm }: { visible: boolean; onConfirm: any }) => {
    if (visible && onConfirm) capturedCropConfirm = onConfirm;
    return null;
  },
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

jest.mock("@/lib/themeContext", () => ({
  useTheme: () => ({
    isDark: true,
    toggleTheme: jest.fn(),
    accentColor: "midnight",
    setAccentColor: mockSetAccentColor,
    mode: "dark",
    setMode: jest.fn(),
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
    warning: "#f59e0b",
    radius: 12,
  }),
}));

// Import after all mocks are set up.
import ProfileSettingsScreen from "../profile-settings";
import { ACCENT_PALETTES } from "@/constants/colors";
import type { AccentKey } from "@/constants/colors";

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

const AsyncStorage = require("@react-native-async-storage/async-storage").default as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

beforeEach(() => {
  capturedBeforeRemove = undefined;
  capturedCropConfirm = null;
  mockAddListener.mockClear();
  mockDispatch.mockClear();
  mockUpdateProfile.mockClear();
  mockSetAccentColor.mockClear();
  mockUpdateProfile.mockResolvedValue(undefined);
  // Reset profile to defaults before each test so tests are order-independent.
  mockProfile.avatarUrl = null;
  mockProfile.weeklyGoal = 3;
  mockProfile.trainingDays = [0, 1, 2, 3, 4, 5, 6];
  // Reset AsyncStorage mocks so each test starts with no stored dismissal.
  AsyncStorage.getItem.mockReset().mockResolvedValue(null);
  AsyncStorage.setItem.mockReset().mockResolvedValue(undefined);
  AsyncStorage.removeItem.mockReset().mockResolvedValue(undefined);
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

  it("shows the selected state on the tapped swatch and not on the others", async () => {
    mockProfile.avatarUrl = null;

    const { getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    const targetSwatch = getByTestId(`preset-swatch-${PRESET_KEY}`);
    expect(targetSwatch.props.accessibilityState?.selected).toBe(false);

    await act(async () => {
      fireEvent.press(targetSwatch);
    });
    await flush();

    expect(getByTestId(`preset-swatch-${PRESET_KEY}`).props.accessibilityState?.selected).toBe(true);

    const OTHER_KEY = "preset:#22c55e";
    expect(getByTestId(`preset-swatch-${OTHER_KEY}`).props.accessibilityState?.selected).toBe(false);
  });
});

// ─── Accent colour swatches ────────────────────────────────────────────────────

describe("ProfileSettingsScreen — accent colour swatches", () => {
  it("renders a swatch with the palette label for every AccentKey", async () => {
    const { getByText } = render(<ProfileSettingsScreen />);
    await flush();

    for (const key of Object.keys(ACCENT_PALETTES) as AccentKey[]) {
      expect(getByText(ACCENT_PALETTES[key].label)).toBeTruthy();
    }
  });

  it("calls setAccentColor with the correct key when each swatch is pressed", async () => {
    const { getByLabelText } = render(<ProfileSettingsScreen />);
    await flush();

    for (const key of Object.keys(ACCENT_PALETTES) as AccentKey[]) {
      mockSetAccentColor.mockClear();
      const palette = ACCENT_PALETTES[key];

      await act(async () => {
        fireEvent.press(getByLabelText(palette.label));
      });

      expect(mockSetAccentColor).toHaveBeenCalledTimes(1);
      expect(mockSetAccentColor).toHaveBeenCalledWith(key);
    }
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

  it("tapping 'Dismiss' persists the mismatch signature to AsyncStorage", async () => {
    mockProfile.weeklyGoal = 5;
    mockProfile.trainingDays = [1, 2, 3];

    const { getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    fireEvent.press(getByTestId("mismatch-dismiss-btn"));
    await flush();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "goal_mismatch_dismissed_v1",
      "5_1,2,3"
    );
  });

  it("does NOT show the nudge on mount when the signature matches the stored dismissed key", async () => {
    mockProfile.weeklyGoal = 5;
    mockProfile.trainingDays = [1, 2, 3];
    // Simulate a previously dismissed dismissal for this exact combo.
    AsyncStorage.getItem.mockResolvedValue("5_1,2,3");

    const { queryByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    expect(queryByTestId("mismatch-nudge")).toBeNull();
  });

  it("DOES show the nudge on mount when the stored key is for a different combo", async () => {
    mockProfile.weeklyGoal = 5;
    mockProfile.trainingDays = [1, 2, 3];
    // Dismissed for a different combo — nudge must still appear.
    AsyncStorage.getItem.mockResolvedValue("4_0,1,2,3");

    const { getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    expect(getByTestId("mismatch-nudge")).toBeTruthy();
  });

  it("clears the stored key when the weekly goal changes", async () => {
    mockProfile.weeklyGoal = 5;
    mockProfile.trainingDays = [1, 2, 3];

    const { getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByTestId("mismatch-fix-btn"));
    });
    await flush();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("goal_mismatch_dismissed_v1");
  });

  it("clears the stored key when a training day is toggled", async () => {
    mockProfile.weeklyGoal = 7;
    mockProfile.trainingDays = [0, 1, 2, 3, 4, 5, 6];

    const { getByText } = render(<ProfileSettingsScreen />);
    await flush();

    await act(async () => {
      fireEvent.press(getByText("F"));
    });
    await flush();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("goal_mismatch_dismissed_v1");
  });
});

// ─── Avatar upload rollback when server rejects ────────────────────────────────
//
// Verifies the full rendered component rolls back correctly when updateProfile
// rejects after the optimistic avatarUrl update inside handleCropConfirm.
//
// Test flow:
//   1. Start with an existing photo avatar so the "Remove photo" button is visible.
//   2. Mock ImagePicker to grant permission and return a fake image asset.
//   3. Press the avatar button → handlePickPhoto() runs → CropModal mock captures
//      the onConfirm callback.
//   4. Call the captured callback with a fake CropResult.
//   5. Depending on whether updateProfile resolves or rejects:
//      - reject → avatar reverts to OLD_AVATAR ("Remove photo" still shown,
//        error banner appears).
//      - resolve → new photo is committed ("Remove photo" still shown, no error).

describe("ProfileSettingsScreen — avatar upload rolls back when server rejects", () => {
  const OLD_AVATAR = "data:image/jpeg;base64,OLD==";
  const FAKE_CROP: { mimeType: string; base64: string } = {
    mimeType: "image/jpeg",
    base64: "NEW==",
  };

  const ImagePicker = require("expo-image-picker") as {
    requestMediaLibraryPermissionsAsync: jest.Mock;
    launchImageLibraryAsync: jest.Mock;
  };

  beforeEach(() => {
    mockProfile.avatarUrl = OLD_AVATAR;
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: "granted" });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/test.jpg", width: 800, height: 800 }],
    });
  });

  /** Press the avatar button and wait for ImagePicker to resolve, populating
   *  pendingImageUri so the CropModal mock can capture onConfirm. */
  async function pickPhoto(getByTestId: ReturnType<typeof render>["getByTestId"]) {
    await act(async () => {
      fireEvent.press(getByTestId("avatar-photo-btn"));
    });
    await flush();
  }

  it("reverts the displayed avatar URI to the original when updateProfile rejects", async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error("Server error"));

    const { getByTestId } = render(<ProfileSettingsScreen />);
    await flush();

    // Before picking: the image renders the OLD_AVATAR URI.
    expect(getByTestId("avatar-image").props.source.uri).toBe(OLD_AVATAR);

    await pickPhoto(getByTestId);

    // CropModal mock should have captured the onConfirm callback by now.
    expect(capturedCropConfirm).not.toBeNull();

    // Simulate the user confirming the crop — updateProfile will reject.
    await act(async () => {
      await capturedCropConfirm!(FAKE_CROP);
    });
    await flush();

    // After the failed upload the avatar must have been rolled back to the
    // original URI — NOT left at the optimistic new URI.
    expect(getByTestId("avatar-image").props.source.uri).toBe(OLD_AVATAR);
  });

  it("shows the error banner after a failed upload", async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error("Server error"));

    const { getByTestId, getByText } = render(<ProfileSettingsScreen />);
    await flush();

    await pickPhoto(getByTestId);
    expect(capturedCropConfirm).not.toBeNull();

    await act(async () => {
      await capturedCropConfirm!(FAKE_CROP);
    });
    await flush();

    expect(getByText("Couldn't save photo. Please try again.")).toBeTruthy();
    // The avatar URI must still be the original — error message alone is
    // insufficient to confirm rollback without verifying the URI.
    expect(getByTestId("avatar-image").props.source.uri).toBe(OLD_AVATAR);
  });

  it("keeps the new photo avatar URI when updateProfile resolves (control case)", async () => {
    // updateProfile resolves — avatar should stay at the new URI, not revert.
    mockUpdateProfile.mockResolvedValueOnce(undefined);

    const { getByTestId, queryByText } = render(<ProfileSettingsScreen />);
    await flush();

    await pickPhoto(getByTestId);
    expect(capturedCropConfirm).not.toBeNull();

    await act(async () => {
      await capturedCropConfirm!(FAKE_CROP);
    });
    await flush();

    const expectedNewUri = `data:${FAKE_CROP.mimeType};base64,${FAKE_CROP.base64}`;

    // New photo was committed — avatar image must show the new URI.
    expect(getByTestId("avatar-image").props.source.uri).toBe(expectedNewUri);
    // No error banner.
    expect(queryByText("Couldn't save photo. Please try again.")).toBeNull();
  });
});
