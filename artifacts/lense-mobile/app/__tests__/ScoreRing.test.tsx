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

  it("does not reset to 0 when re-rendered with the same score", async () => {
    const { getByText, rerender } = render(
      <ScoreRing score={75} color="#6c63ff" animate />,
    );

    // Advance past the full animation.
    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    expect(getByText("75")).toBeTruthy();

    // Re-render with the exact same score — the ring must NOT reset to 0.
    await act(async () => {
      rerender(<ScoreRing score={75} color="#6c63ff" animate />);
    });

    // Score must still show 75, not 0.
    expect(getByText("75")).toBeTruthy();
  });
});

// ─── ScoreRing custom children ───────────────────────────────────────────────

describe("ScoreRing custom children", () => {
  it("renders the custom child and suppresses the numeric score", () => {
    const { Text } = require("react-native");
    const { getByText, queryByText } = render(
      <ScoreRing score={75} color="#fff">
        <Text>Custom</Text>
      </ScoreRing>,
    );

    // Custom child must be present.
    expect(getByText("Custom")).toBeTruthy();
    // Numeric score must NOT appear anywhere in the tree.
    expect(queryByText("75")).toBeNull();
  });

  it("suppresses both the numeric score and the label when a custom child is provided", () => {
    const { Text } = require("react-native");
    const { getByText, queryByText } = render(
      <ScoreRing score={75} color="#fff" label="Overall">
        <Text>Custom</Text>
      </ScoreRing>,
    );

    // Custom child must be present.
    expect(getByText("Custom")).toBeTruthy();
    // Numeric score must NOT appear anywhere in the tree.
    expect(queryByText("75")).toBeNull();
    // Label must NOT appear anywhere in the tree.
    expect(queryByText("Overall")).toBeNull();
  });
});
