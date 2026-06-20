/**
 * Verifies the fade-in / fade-out animation lifecycle of the tooltip in
 * JointHistorySheet.
 *
 * Strategy:
 *  - react-native-svg is mocked so G renders as a plain View, which lets
 *    testIDs propagate into the test tree.
 *  - Animated.timing is spied on so we can assert the correct parameters
 *    (toValue, duration, useNativeDriver) are passed for both fade-in and
 *    fade-out without needing to run the native animation infrastructure.
 *  - jest.useFakeTimers drives the animation callbacks synchronously so we
 *    can verify that the tooltip is removed from the tree only AFTER the
 *    fade-out completes.
 */

import React from "react";
import { Animated } from "react-native";
import { render, fireEvent, act } from "@testing-library/react-native";

// ── react-native-svg mock ────────────────────────────────────────────────────
// Map every SVG element to a plain View/null so testIDs work and
// Animated.createAnimatedComponent can wrap G without crashing.

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: View,
    Svg: View,
    G: View,
    Rect: () => null,
    Circle: View,
    Polyline: () => null,
    Path: () => null,
    Line: () => null,
    Text: () => null,
  };
});

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

import JointHistorySheet from "@/components/JointHistorySheet";

// ── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_DATA = [
  { analysisId: "a1", date: "2025-01-01", angle: 42, risk: 0 as const, sport: "running" },
  { analysisId: "a2", date: "2025-02-01", angle: 50, risk: 1 as const, sport: "running" },
  { analysisId: "a3", date: "2025-03-01", angle: 38, risk: 2 as const, sport: "running" },
];

const noop = () => {};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Spy on Animated.timing, track calls, delegate to original implementation. */
function spyAnimatedTiming() {
  const original = Animated.timing.bind(Animated);
  const calls: Parameters<typeof Animated.timing>[] = [];
  const spy = jest
    .spyOn(Animated, "timing")
    .mockImplementation((...args: Parameters<typeof Animated.timing>) => {
      calls.push(args);
      return original(...args);
    });
  return { calls, spy };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("JointHistorySheet — tooltip fade animation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("tooltip is not present in the tree on initial render", () => {
    const { queryByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={noop} />,
    );
    expect(queryByTestId("joint-tooltip")).toBeNull();
  });

  it("shows the tooltip after a dot is pressed", async () => {
    const { getAllByTestId, getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={noop} />,
    );

    const dots = getAllByTestId("dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    expect(getByTestId("joint-tooltip")).toBeTruthy();
  });

  it("calls Animated.timing with toValue=1 and duration≤300 for fade-in", async () => {
    const { calls } = spyAnimatedTiming();

    const { getAllByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={noop} />,
    );

    const dots = getAllByTestId("dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    const fadeIn = calls.find(([, config]) => (config as { toValue: number }).toValue === 1);
    expect(fadeIn).toBeDefined();
    const cfg = fadeIn![1] as { toValue: number; duration: number; useNativeDriver: boolean };
    expect(cfg.toValue).toBe(1);
    expect(cfg.duration).toBeLessThanOrEqual(300);
    expect(cfg.useNativeDriver).toBe(true);
  });

  it("calls Animated.timing with toValue=0 and duration≤300 when dismissing", async () => {
    const { calls } = spyAnimatedTiming();

    const { getAllByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={noop} />,
    );

    const dots = getAllByTestId("dot-hit-target");

    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    const fadeOut = calls.find(([, config]) => (config as { toValue: number }).toValue === 0);
    expect(fadeOut).toBeDefined();
    const cfg = fadeOut![1] as { toValue: number; duration: number; useNativeDriver: boolean };
    expect(cfg.toValue).toBe(0);
    expect(cfg.duration).toBeLessThanOrEqual(300);
    expect(cfg.useNativeDriver).toBe(true);
  });

  it("removes the tooltip from the tree after the fade-out animation completes", async () => {
    const { getAllByTestId, queryByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={noop} />,
    );

    const dots = getAllByTestId("dot-hit-target");

    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    await act(async () => {
      fireEvent.press(dots[0]!);
      jest.runAllTimers();
    });

    expect(queryByTestId("joint-tooltip")).toBeNull();
  });

  it("replaces tooltip content immediately when a different dot is tapped", async () => {
    const { getAllByTestId, getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={noop} />,
    );

    const dots = getAllByTestId("dot-hit-target");

    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    await act(async () => {
      fireEvent.press(dots[1]!);
    });

    expect(getByTestId("joint-tooltip")).toBeTruthy();
  });

  it("auto-dismisses the tooltip after 3 s via the auto-timer (fake timers path)", async () => {
    const { calls, spy } = spyAnimatedTiming();

    const { getAllByTestId, queryByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={noop} />,
    );

    const dots = getAllByTestId("dot-hit-target");

    // Tap a dot — tooltip appears and the 3 s auto-dismiss timer starts.
    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    expect(queryByTestId("joint-tooltip")).toBeTruthy();

    // At 2999 ms the timer has not yet fired — tooltip must still be visible.
    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(queryByTestId("joint-tooltip")).toBeTruthy();

    // Advance past the 3 s threshold then flush all animation ticks so the
    // fade-out Animated.timing callback fires synchronously and
    // setDisplayedIndex(null) removes the tooltip from the tree.
    await act(async () => {
      jest.advanceTimersByTime(1);
      jest.runAllTimers();
    });

    // The tooltip must have been removed from the tree.
    expect(queryByTestId("joint-tooltip")).toBeNull();

    // A fade-out call (toValue=0) must have been issued by the auto-dismiss path.
    const autoDismissFadeOut = calls.find(
      ([, config]) => (config as { toValue: number }).toValue === 0,
    );
    expect(autoDismissFadeOut).toBeDefined();
    const cfg = autoDismissFadeOut![1] as { toValue: number; duration: number; useNativeDriver: boolean };
    expect(cfg.toValue).toBe(0);
    expect(cfg.duration).toBeLessThanOrEqual(300);
    expect(cfg.useNativeDriver).toBe(true);

    spy.mockRestore();
  });
});
