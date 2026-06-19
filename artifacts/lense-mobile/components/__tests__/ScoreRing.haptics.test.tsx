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

// ─── Score change re-trigger ──────────────────────────────────────────────────

describe("ScoreRing — animation re-trigger on score change", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires impactAsync a second time when score prop changes while animate=true", async () => {
    const { rerender } = render(<ScoreRing score={50} color="#6c63ff" animate />);

    // Complete the first animation — haptic fires once.
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    // Re-render with a different score while animate remains true.
    rerender(<ScoreRing score={85} color="#6c63ff" animate />);

    // Complete the second animation — haptic should fire again.
    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it("does NOT fire a second haptic when animate stays false across re-renders", async () => {
    const { rerender } = render(
      <ScoreRing score={50} color="#6c63ff" animate={false} />,
    );

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    // Re-render with a new score — animate is still false.
    rerender(<ScoreRing score={85} color="#6c63ff" animate={false} />);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
