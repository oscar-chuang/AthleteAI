import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), push: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUpdateProfile = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({ updateProfile: mockUpdateProfile }),
}));

const mockRequestPermission = jest.fn().mockResolvedValue(true);
jest.mock("@/utils/notifications", () => ({
  requestNotificationPermission: (...args: unknown[]) => mockRequestPermission(...args),
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#000",
    foreground: "#fff",
    primary: "#4f46e5",
    card: "#111",
    border: "#222",
    muted: "#333",
    mutedForeground: "#888",
  }),
}));

import OnboardingScreen from "../onboarding";

function advanceToStep(getByText: ReturnType<typeof render>["getByText"], n: number) {
  const stepTitles = [
    "What's your sport?",
    "What's your level?",
    "What are your goals?",
    "Any injury concerns?",
    "Weekly training goal",
    "You're all set!",
  ];

  const selectors: Record<number, () => void> = {
    1: () => fireEvent.press(getByText("Running")),
    2: () => fireEvent.press(getByText("Beginner")),
    3: () => fireEvent.press(getByText("Improve technique")),
    4: () => fireEvent.press(getByText("No current injuries")),
  };

  for (let i = 1; i < n; i++) {
    if (selectors[i]) selectors[i]();
    fireEvent.press(getByText(i < 5 ? "Continue" : i === 5 ? "Continue" : "Go to Dashboard →"));
  }
}

describe("onboarding notification permission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the in-app notification explanation on the final step", async () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("Running"));
    fireEvent.press(getByText("Continue"));
    fireEvent.press(getByText("Beginner"));
    fireEvent.press(getByText("Continue"));
    fireEvent.press(getByText("Improve technique"));
    fireEvent.press(getByText("Continue"));
    fireEvent.press(getByText("No current injuries"));
    fireEvent.press(getByText("Continue"));
    fireEvent.press(getByText("Continue"));

    expect(
      getByText(/celebrate your progress/i)
    ).toBeTruthy();
  });

  it("calls requestNotificationPermission when completing onboarding", async () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("Running"));
    fireEvent.press(getByText("Continue"));
    fireEvent.press(getByText("Beginner"));
    fireEvent.press(getByText("Continue"));
    fireEvent.press(getByText("Improve technique"));
    fireEvent.press(getByText("Continue"));
    fireEvent.press(getByText("No current injuries"));
    fireEvent.press(getByText("Continue"));
    fireEvent.press(getByText("Continue"));

    await act(async () => {
      fireEvent.press(getByText("Go to Dashboard →"));
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it("does not call requestNotificationPermission on intermediate steps", async () => {
    const { getByText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("Running"));
    fireEvent.press(getByText("Continue"));

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});
