import React from "react";
import { render, act } from "@testing-library/react-native";

// ─── Native module mocks ─────────────────────────────────────────────────────

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
import * as Haptics from "expo-haptics";

// ─── Haptic pulse timing ─────────────────────────────────────────────────────

describe("ScoreRing — haptic pulse", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires impactAsync(Light) exactly once when animate=true completes", async () => {
    render(<ScoreRing score={80} color="#6c63ff" animate />);

    // Haptic must NOT have fired before the animation finishes.
    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    // Advance past the full 800 ms animation duration and flush state updates.
    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it("does NOT fire impactAsync when animate=false", async () => {
    render(<ScoreRing score={80} color="#6c63ff" animate={false} />);

    // Advance well beyond any animation window to be certain nothing fires.
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
