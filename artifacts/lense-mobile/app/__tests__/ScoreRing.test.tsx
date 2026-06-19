import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Native module mocks ────────────────────────────────────────────────────

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Circle: View,
  };
});

// Import after mocks are in place.
import { ScoreRing } from "@/components/ScoreRing";

// ─── ScoreRing count-up animation ───────────────────────────────────────────

describe("ScoreRing count-up animation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("displays 0 immediately on mount when animate=true", async () => {
    const { getByText } = render(
      <ScoreRing score={75} color="#6c63ff" animate />,
    );

    // Before any timers run the displayed score must be 0.
    expect(getByText("0")).toBeTruthy();
  });

  it("displays the target score after the 800ms animation completes", async () => {
    const { getByText, queryByText } = render(
      <ScoreRing score={75} color="#6c63ff" animate />,
    );

    // Confirm the count-up starts at 0.
    expect(getByText("0")).toBeTruthy();

    // Advance past the full 800ms duration and flush resulting state updates.
    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    // The displayed number must have reached the target.
    expect(getByText("75")).toBeTruthy();
    // 0 should no longer be visible.
    expect(queryByText("0")).toBeNull();
  });

  it("displays the target score immediately when animate=false", () => {
    const { getByText } = render(
      <ScoreRing score={75} color="#6c63ff" />,
    );

    // No animation — score should be rendered on the first frame.
    expect(getByText("75")).toBeTruthy();
  });
});
