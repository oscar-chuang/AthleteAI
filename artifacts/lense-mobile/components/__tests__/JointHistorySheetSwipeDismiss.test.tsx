/**
 * Verifies that dragging the JointHistorySheet downward past the dismissal
 * threshold calls onClose, and that a short drag (below the threshold) does
 * not dismiss the sheet.
 *
 * Strategy:
 *  - PanResponder.create is spied on to capture the onPanResponderRelease
 *    callback so tests can invoke it directly with a controlled gestureState,
 *    without needing to simulate native touch events.
 *  - The spy delegates to the real implementation so panHandlers are still
 *    spread onto the sheet container and the component renders normally.
 *  - react-native-svg is mocked to avoid SVG rendering issues in the test env.
 */

import React from "react";
import { PanResponder, type PanResponderGestureState } from "react-native";
import { render, act } from "@testing-library/react-native";

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Circle: View,
    Line: () => null,
    Path: () => null,
    Polyline: () => null,
    Text: () => null,
    Rect: () => null,
  };
});

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

import JointHistorySheet from "@/components/JointHistorySheet";

const SAMPLE_DATA = [
  { analysisId: "a1", date: "2025-01-01", angle: 42, risk: 0 as const, sport: "running" },
  { analysisId: "a2", date: "2025-02-01", angle: 50, risk: 1 as const, sport: "running" },
  { analysisId: "a3", date: "2025-03-01", angle: 38, risk: 2 as const, sport: "running" },
];

/** Capture the onPanResponderRelease handler from PanResponder.create. */
function spyOnPanResponder() {
  let capturedRelease: ((e: any, gs: PanResponderGestureState) => void) | undefined;

  const original = PanResponder.create.bind(PanResponder);
  const spy = jest.spyOn(PanResponder, "create").mockImplementation((config) => {
    capturedRelease = config.onPanResponderRelease;
    return original(config);
  });

  return {
    spy,
    getRelease: () => capturedRelease,
  };
}

function makeGestureState(dy: number): PanResponderGestureState {
  return { dy, dx: 0, vx: 0, vy: 0.5, moveX: 0, moveY: 0, x0: 0, y0: 0,
    stateID: 0, numberActiveTouches: 1,
  } as PanResponderGestureState;
}

describe("JointHistorySheet — swipe-down dismissal", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls onClose when the downward drag exceeds the threshold (100px)", async () => {
    const { getRelease } = spyOnPanResponder();
    const onClose = jest.fn();

    render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    await act(async () => {});

    const release = getRelease();
    expect(release).toBeDefined();

    act(() => {
      release!({} as any, makeGestureState(100));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when the downward drag is below the threshold (30px)", async () => {
    const { getRelease } = spyOnPanResponder();
    const onClose = jest.fn();

    render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    await act(async () => {});

    const release = getRelease();
    expect(release).toBeDefined();

    act(() => {
      release!({} as any, makeGestureState(30));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose when the gesture is upward (negative dy)", async () => {
    const { getRelease } = spyOnPanResponder();
    const onClose = jest.fn();

    render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    await act(async () => {});

    const release = getRelease();
    expect(release).toBeDefined();

    act(() => {
      release!({} as any, makeGestureState(-120));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the drag handle with the sheet-drag-handle testID", async () => {
    const { queryByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={jest.fn()} />,
    );

    await act(async () => {});

    expect(queryByTestId("sheet-drag-handle")).not.toBeNull();
  });
});
